import { Database, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MarketplaceFeature } from "@/lib/marketplace-data";
import { cn } from "@/lib/utils";

interface FeatureCardProps {
  feature: MarketplaceFeature;
  onInstall: (feature: MarketplaceFeature) => void;
}

export function FeatureCard({ feature, onInstall }: FeatureCardProps) {
  const installed = feature.installationStatus === "installed";

  return (
    <article className="flex h-full flex-col rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
            <PackagePlus className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground">{feature.name}</h3>
            <p className="mt-0.5 text-xs font-medium text-text-muted">Version {feature.version}</p>
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
            installed ? "bg-success-light text-success" : "bg-muted text-text-secondary",
          )}
        >
          {installed ? "Installed" : "Available"}
        </span>
      </div>

      <p className="mt-4 flex-1 text-sm leading-6 text-text-secondary">{feature.description}</p>

      <div className="mt-5 flex items-center justify-between gap-4 border-t border-border pt-4">
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <Database className="h-4 w-4" aria-hidden="true" />
          <span>{feature.has_migration ? "Database change required" : "No database change"}</span>
        </div>
        <Button type="button" size="sm" disabled={installed} onClick={() => onInstall(feature)}>
          {installed ? "Installed" : "Install"}
        </Button>
      </div>
    </article>
  );
}
