import { useQuery } from "@tanstack/react-query";
import {
  TENANT_NAME,
  controlPlaneSupabase,
  isControlPlaneConfigured,
} from "@/integrations/supabase/control-plane-client";

export type CatalogueScope = "all" | "named";
export type MarketplaceInstallationStatus = "available" | "installed";

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

  const { data, error } = await controlPlaneSupabase.rpc("list_catalogue");
  if (error) throw error;

  return groupMarketplaceCatalogue((data ?? []) as CatalogueFeature[], TENANT_NAME);
}

export function groupMarketplaceCatalogue(
  catalogue: CatalogueFeature[],
  tenantName: string,
): MarketplaceCatalogue {
  const entitledFeatures = catalogue
    .filter(
      (feature) =>
        feature.scope === "all" ||
        (feature.scope === "named" && feature.audience.includes(tenantName)),
    )
    .map(
      (feature): MarketplaceFeature => ({
        ...feature,
        installationStatus: "available",
      }),
    )
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
  });
}
