import { CircleAlert, Database, LoaderCircle, PackageCheck, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MarketplaceFeature } from "@/lib/marketplace-data";
import { cn } from "@/lib/utils";

interface FeatureCardProps {
  feature: MarketplaceFeature;
  onInstall: (feature: MarketplaceFeature) => void;
  canManageInstalls: boolean;
}

export function FeatureCard({ feature, onInstall, canManageInstalls }: FeatureCardProps) {
  const status = feature.installationStatus;
  const canInstall = canManageInstalls && (status === "available" || status === "failed");
  const statusLabel = {
    available: "Available",
    requested: "Requested",
    installing: "Installing",
    live: "Live",
    failed: "Failed",
  }[status];

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
            status === "live" && "bg-success-light text-success",
            status === "failed" && "bg-destructive/10 text-destructive",
            ["requested", "installing"].includes(status) && "bg-warning-light text-warning",
            status === "available" && "bg-muted text-text-secondary",
          )}
        >
          {statusLabel}
        </span>
      </div>

      <p className="mt-4 flex-1 text-sm leading-6 text-text-secondary">{feature.description}</p>

      {status === "failed" ? (
        <div className="mt-4 flex gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{feature.installError || "Installation failed. You can retry the request."}</span>
        </div>
      ) : null}

      <div className="mt-5 flex items-center justify-between gap-4 border-t border-border pt-4">
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <Database className="h-4 w-4" aria-hidden="true" />
          <span>{feature.has_migration ? "Database change required" : "No database change"}</span>
        </div>
        {canInstall ? (
          <Button type="button" size="sm" onClick={() => onInstall(feature)}>
            {status === "failed" ? "Retry" : "Install"}
          </Button>
        ) : status !== "available" && status !== "failed" ? (
          <div className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
            {status === "live" ? (
              <PackageCheck className="h-4 w-4 text-success" aria-hidden="true" />
            ) : (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            {status === "live" ? "Installed" : statusLabel}
          </div>
        ) : null}
      </div>
    </article>
  );
}
