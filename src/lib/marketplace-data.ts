import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  TENANT_NAME,
  controlPlaneSupabase,
  isControlPlaneConfigured,
} from "@/integrations/supabase/control-plane-client";

export type CatalogueScope = "all" | "named";
export type TenantFeatureStatus = "requested" | "installing" | "live" | "failed";
export type MarketplaceInstallationStatus = "available" | TenantFeatureStatus;

export interface CatalogueFeature {
  feature_key: string;
  name: string;
  description: string;
  version: string;
  scope: CatalogueScope;
  audience: string[];
  has_migration: boolean;
  source_branch: string;
  published_at: string;
  updated_at: string;
}

export interface MarketplaceFeature extends CatalogueFeature {
  installationStatus: MarketplaceInstallationStatus;
  installError: string | null;
}

export interface TenantFeature {
  id: string;
  tenant_name: string;
  feature_key: string;
  version: string;
  status: TenantFeatureStatus;
  requested_by: string;
  requested_at: string;
  updated_at: string;
  error: string | null;
}

export interface MarketplaceCatalogue {
  publicFeatures: MarketplaceFeature[];
  privateFeatures: MarketplaceFeature[];
}

export const marketplaceCatalogueKey = ["marketplace", "catalogue"] as const;

export async function fetchMarketplaceCatalogue(): Promise<MarketplaceCatalogue> {
  if (!isControlPlaneConfigured()) {
    throw new Error("Marketplace configuration is incomplete.");
  }

  const [catalogueResult, installsResult] = await Promise.all([
    controlPlaneSupabase.rpc("list_catalogue"),
    controlPlaneSupabase.rpc("list_tenant_features", { p_tenant_name: TENANT_NAME }),
  ]);
  if (catalogueResult.error) throw catalogueResult.error;
  if (installsResult.error) throw installsResult.error;

  return groupMarketplaceCatalogue(
    (catalogueResult.data ?? []) as CatalogueFeature[],
    (installsResult.data ?? []) as TenantFeature[],
    TENANT_NAME,
  );
}

export function groupMarketplaceCatalogue(
  catalogue: CatalogueFeature[],
  installs: TenantFeature[],
  tenantName: string,
): MarketplaceCatalogue {
  const installsByFeature = new Map(installs.map((install) => [install.feature_key, install]));
  const entitledFeatures = catalogue
    .filter(
      (feature) =>
        feature.scope === "all" ||
        (feature.scope === "named" && feature.audience.includes(tenantName)),
    )
    .map((feature): MarketplaceFeature => {
      const install = installsByFeature.get(feature.feature_key);
      return {
        ...feature,
        installationStatus: install?.status ?? "available",
        installError: install?.error ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    publicFeatures: entitledFeatures.filter((feature) => feature.scope === "all"),
    privateFeatures: entitledFeatures.filter((feature) => feature.scope === "named"),
  };
}

export function useMarketplaceCatalogue() {
  return useQuery({
    queryKey: [...marketplaceCatalogueKey, TENANT_NAME],
    queryFn: fetchMarketplaceCatalogue,
    enabled: isControlPlaneConfigured(),
    refetchInterval: (query) =>
      hasPendingInstall(query.state.data as MarketplaceCatalogue | undefined) ? 10_000 : false,
  });
}

export async function requestFeatureInstall(featureKey: string, requestedBy: string) {
  if (!isControlPlaneConfigured()) {
    throw new Error("Marketplace configuration is incomplete.");
  }

  const { data, error } = await controlPlaneSupabase.rpc("request_feature_install", {
    p_tenant_name: TENANT_NAME,
    p_feature_key: featureKey,
    p_requested_by: requestedBy,
  });
  if (error) throw error;

  return ((data ?? []) as TenantFeature[])[0];
}

export function useRequestFeatureInstall() {
  const queryClient = useQueryClient();
  const queryKey = [...marketplaceCatalogueKey, TENANT_NAME];

  return useMutation({
    mutationFn: ({ featureKey, requestedBy }: { featureKey: string; requestedBy: string }) =>
      requestFeatureInstall(featureKey, requestedBy),
    onMutate: async ({ featureKey }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<MarketplaceCatalogue>(queryKey);
      queryClient.setQueryData<MarketplaceCatalogue>(queryKey, (current) =>
        current ? updateFeatureStatus(current, featureKey, "requested", null) : current,
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
}

function hasPendingInstall(catalogue: MarketplaceCatalogue | undefined) {
  if (!catalogue) return false;
  return [...catalogue.publicFeatures, ...catalogue.privateFeatures].some((feature) =>
    ["requested", "installing"].includes(feature.installationStatus),
  );
}

function updateFeatureStatus(
  catalogue: MarketplaceCatalogue,
  featureKey: string,
  status: MarketplaceInstallationStatus,
  error: string | null,
): MarketplaceCatalogue {
  const update = (feature: MarketplaceFeature) =>
    feature.feature_key === featureKey
      ? { ...feature, installationStatus: status, installError: error }
      : feature;

  return {
    publicFeatures: catalogue.publicFeatures.map(update),
    privateFeatures: catalogue.privateFeatures.map(update),
  };
}
