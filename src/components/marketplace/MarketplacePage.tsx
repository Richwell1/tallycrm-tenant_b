import { useState } from "react";
import { PackageOpen, RefreshCw, Store } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/common";
import { PageHeader, ToolbarButton } from "@/components/layout";
import {
  isControlPlaneConfigured,
  missingControlPlaneConfigMessage,
} from "@/integrations/supabase/control-plane-client";
import { type MarketplaceFeature, useMarketplaceCatalogue } from "@/lib/marketplace-data";
import { FeatureCard } from "./FeatureCard";
import { InstallFeatureDialog } from "./InstallFeatureDialog";

export function MarketplacePage() {
  const configured = isControlPlaneConfigured();
  const { data, isLoading, isError, error, refetch, isFetching } = useMarketplaceCatalogue();
  const [selectedFeature, setSelectedFeature] = useState<MarketplaceFeature | null>(null);
  const featureCount = (data?.publicFeatures.length ?? 0) + (data?.privateFeatures.length ?? 0);

  return (
    <>
      <PageHeader
        title="Marketplace"
        count={data ? featureCount : undefined}
        actions={
          configured ? (
            <ToolbarButton icon="refresh" onClick={() => refetch()} disabled={isFetching}>
              Refresh
            </ToolbarButton>
          ) : undefined
        }
      />

      {!configured ? (
        <ErrorState
          title="Marketplace not configured"
          description={missingControlPlaneConfigMessage()}
        />
      ) : isLoading ? (
        <MarketplaceSkeleton />
      ) : isError ? (
        <ErrorState
          title="Marketplace unavailable"
          description={(error as Error)?.message ?? "Could not load the feature catalogue."}
          onRetry={() => refetch()}
        />
      ) : featureCount === 0 ? (
        <EmptyState
          icon={<PackageOpen className="h-7 w-7" aria-hidden="true" />}
          title="No features are available"
          description="There are no marketplace features available for this organisation yet."
        />
      ) : (
        <div className="space-y-10">
          <MarketplaceSection
            title="Available for you"
            description="Features available to every organisation using Tally CRM."
            features={data?.publicFeatures ?? []}
            onInstall={setSelectedFeature}
            emptyMessage="There are no public marketplace features available right now."
          />

          {(data?.privateFeatures.length ?? 0) > 0 ? (
            <MarketplaceSection
              title="Private to your organisation"
              description="These features were built specifically for your organisation."
              features={data?.privateFeatures ?? []}
              onInstall={setSelectedFeature}
            />
          ) : null}
        </div>
      )}

      <InstallFeatureDialog
        feature={selectedFeature}
        onOpenChange={(open) => {
          if (!open) setSelectedFeature(null);
        }}
      />
    </>
  );
}

interface MarketplaceSectionProps {
  title: string;
  description: string;
  features: MarketplaceFeature[];
  onInstall: (feature: MarketplaceFeature) => void;
  emptyMessage?: string;
}

function MarketplaceSection({
  title,
  description,
  features,
  onInstall,
  emptyMessage,
}: MarketplaceSectionProps) {
  return (
    <section aria-labelledby={`marketplace-${title.toLowerCase().replaceAll(" ", "-")}`}>
      <div className="mb-4 flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
          <Store className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2
            id={`marketplace-${title.toLowerCase().replaceAll(" ", "-")}`}
            className="text-lg font-semibold text-foreground"
          >
            {title}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">{description}</p>
        </div>
      </div>

      {features.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {features.map((feature) => (
            <FeatureCard key={feature.feature_key} feature={feature} onInstall={onInstall} />
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-surface px-5 py-6 text-sm text-text-secondary">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {emptyMessage}
        </div>
      )}
    </section>
  );
}

function MarketplaceSkeleton() {
  return (
    <div className="space-y-5" aria-label="Loading marketplace">
      <div className="h-6 w-48 animate-pulse rounded bg-muted" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="h-56 animate-pulse rounded-xl border border-border bg-muted/60"
          />
        ))}
      </div>
    </div>
  );
}
