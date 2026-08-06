import { AlertTriangle, CheckCircle2, Cloud, CloudOff, RefreshCw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentRole } from "@/lib/auth-context";
import { formatRelative } from "@/lib/format";
import { useBrowserOnlineStatus, useSyncStatus, type LatestSyncRun } from "@/lib/sync-status-data";
import { cn } from "@/lib/utils";

export function SyncStatusIndicator() {
  const online = useBrowserOnlineStatus();
  const role = useCurrentRole();
  const canReadSyncStatus = role === "admin" || role === "manager";
  const { data, isError, isLoading } = useSyncStatus(canReadSyncStatus);
  const latestRun = data?.latestRun ?? null;

  const tone = getTone({
    online,
    latestRun,
    hasConflict: Boolean(data?.unresolvedConflicts),
    hasPendingChanges: Boolean(data?.pendingChanges),
    isError,
  });
  const Icon = tone.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
            tone.buttonClass,
          )}
          title={tone.label}
          aria-label={tone.label}
        >
          <Icon className={cn("h-5 w-5", tone.iconClass, tone.spin && "animate-spin")} />
          {data?.unresolvedConflicts ? (
            <span className="absolute right-1.5 top-1 h-2.5 w-2.5 rounded-full border-2 border-card bg-danger" />
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={10} className="w-[320px] p-0">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold text-foreground">Sync</h2>
              <p className={cn("mt-0.5 text-[12px]", tone.textClass)}>{tone.label}</p>
            </div>
            <div
              className={cn("flex h-9 w-9 items-center justify-center rounded-lg", tone.badgeClass)}
            >
              <Icon className={cn("h-5 w-5", tone.spin && "animate-spin")} />
            </div>
          </div>
        </div>

        <div className="space-y-3 px-4 py-3 text-[12px]">
          <SyncRow label="Network" value={online ? "Online" : "Offline"} />
          {canReadSyncStatus ? (
            isLoading ? (
              <SyncRow label="Latest run" value="Checking..." />
            ) : data?.unavailableReason ? (
              <SyncRow label="Latest run" value={data.unavailableReason} />
            ) : latestRun ? (
              <LatestRunDetails run={latestRun} />
            ) : (
              <SyncRow label="Latest run" value="No sync run yet" />
            )
          ) : (
            <SyncRow label="Latest run" value="Admin/manager only" />
          )}
          {canReadSyncStatus ? (
            <SyncRow label="Conflicts" value={String(data?.unresolvedConflicts ?? 0)} />
          ) : null}
          {canReadSyncStatus ? (
            <SyncRow label="Pending changes" value={String(data?.pendingChanges ?? 0)} />
          ) : null}
          {isError ? <p className="text-danger">Could not read sync status.</p> : null}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LatestRunDetails({ run }: { run: LatestSyncRun }) {
  const time = run.finished_at ?? run.started_at;
  return (
    <>
      <SyncRow label="Latest run" value={run.status} />
      <SyncRow label="Direction" value={run.direction} />
      <SyncRow label="Rows changed" value={String(run.rows_changed)} />
      <SyncRow label="Updated" value={formatRelative(time)} />
      {run.error_message ? <p className="text-danger">{run.error_message}</p> : null}
    </>
  );
}

function SyncRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-text-secondary">{label}</span>
      <span className="truncate text-right font-semibold text-foreground">{value}</span>
    </div>
  );
}

function getTone({
  online,
  latestRun,
  hasConflict,
  hasPendingChanges,
  isError,
}: {
  online: boolean;
  latestRun: LatestSyncRun | null;
  hasConflict: boolean;
  hasPendingChanges: boolean;
  isError: boolean;
}) {
  if (!online) {
    return {
      label: "Offline",
      icon: CloudOff,
      spin: false,
      buttonClass: "text-warning",
      iconClass: "text-warning",
      textClass: "text-warning",
      badgeClass: "bg-warning-light text-warning",
    };
  }

  if (latestRun?.status === "running") {
    return {
      label: "Syncing",
      icon: RefreshCw,
      spin: true,
      buttonClass: "text-info",
      iconClass: "text-info",
      textClass: "text-info",
      badgeClass: "bg-info-light text-info",
    };
  }

  if (isError || latestRun?.status === "failed" || hasConflict) {
    return {
      label: hasConflict ? "Conflict review needed" : "Sync issue",
      icon: AlertTriangle,
      spin: false,
      buttonClass: "text-danger",
      iconClass: "text-danger",
      textClass: "text-danger",
      badgeClass: "bg-danger-light text-danger",
    };
  }

  if (hasPendingChanges) {
    return {
      label: "Pending sync",
      icon: Cloud,
      spin: false,
      buttonClass: "text-warning",
      iconClass: "text-warning",
      textClass: "text-warning",
      badgeClass: "bg-warning-light text-warning",
    };
  }

  if (latestRun?.status === "success") {
    return {
      label: `Synced ${formatRelative(latestRun.finished_at ?? latestRun.started_at)}`,
      icon: CheckCircle2,
      spin: false,
      buttonClass: "text-success",
      iconClass: "text-success",
      textClass: "text-success",
      badgeClass: "bg-success-light text-success",
    };
  }

  return {
    label: "Online",
    icon: Cloud,
    spin: false,
    buttonClass: "text-text-secondary",
    iconClass: "text-text-secondary",
    textClass: "text-text-secondary",
    badgeClass: "bg-muted text-text-secondary",
  };
}
