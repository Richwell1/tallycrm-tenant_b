import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SyncRunStatus = "running" | "success" | "failed";
export type SyncRunDirection = "push" | "pull" | "bidirectional";

export interface LatestSyncRun {
  id: string;
  direction: SyncRunDirection;
  status: SyncRunStatus;
  started_at: string;
  finished_at: string | null;
  rows_processed: number;
  rows_changed: number;
  error_message: string | null;
}

export interface SyncStatusSnapshot {
  latestRun: LatestSyncRun | null;
  unresolvedConflicts: number;
  pendingChanges: number;
  pendingChangesByTable: Record<string, number>;
  leadLastPushedAt: string | null;
  unavailableReason: string | null;
}

const PENDING_SYNC_TABLES = [
  "pipeline_stages",
  "loss_reasons",
  "app_settings",
  "automation_rules",
  "companies",
  "contacts",
  "deals",
  "leads",
  "tasks",
  "activities",
] as const;

function isMissingSyncBackend(error: unknown) {
  const err = error as { code?: string; message?: string; status?: number } | null;
  const message = err?.message?.toLowerCase() ?? "";
  return (
    err?.status === 404 ||
    err?.code === "42P01" ||
    message.includes("sync_runs") ||
    message.includes("sync_conflicts") ||
    message.includes("permission denied")
  );
}

export function useBrowserOnlineStatus() {
  const [online, setOnline] = useState(() => {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine;
  });

  useEffect(() => {
    function handleOnline() {
      setOnline(true);
    }
    function handleOffline() {
      setOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return online;
}

export function useSyncStatus(enabled: boolean) {
  return useQuery<SyncStatusSnapshot>({
    queryKey: ["sync_status"],
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: (failureCount, error) => !isMissingSyncBackend(error) && failureCount < 2,
    queryFn: async () => {
      const latestRunRes = await supabase
        .from("sync_runs")
        .select(
          "id,direction,status,started_at,finished_at,rows_processed,rows_changed,error_message",
        )
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestRunRes.error) {
        if (isMissingSyncBackend(latestRunRes.error)) {
          return {
            latestRun: null,
            unresolvedConflicts: 0,
            pendingChanges: 0,
            pendingChangesByTable: {},
            leadLastPushedAt: null,
            unavailableReason: "Sync status unavailable",
          };
        }
        throw latestRunRes.error;
      }

      const conflictsRes = await supabase
        .from("sync_conflicts")
        .select("id", { count: "exact", head: true });

      if (conflictsRes.error && !isMissingSyncBackend(conflictsRes.error)) {
        throw conflictsRes.error;
      }

      const checkpointRes = await supabase
        .from("sync_checkpoints")
        .select("table_name,last_pushed_at")
        .in("table_name", [...PENDING_SYNC_TABLES])
        .order("updated_at", { ascending: false })
        .limit(PENDING_SYNC_TABLES.length);

      if (checkpointRes.error && !isMissingSyncBackend(checkpointRes.error)) {
        throw checkpointRes.error;
      }

      const lastPushedByTable = new Map(
        (checkpointRes.error ? [] : (checkpointRes.data ?? [])).map((checkpoint) => [
          checkpoint.table_name,
          checkpoint.last_pushed_at,
        ]),
      );
      const pendingCounts = await Promise.all(
        PENDING_SYNC_TABLES.map(async (tableName) => {
          const lastPushedAt = lastPushedByTable.get(tableName) ?? "1970-01-01T00:00:00.000Z";
          const pendingRes = await supabase
            .from(tableName)
            .select("id", { count: "exact", head: true })
            .gt("updated_at", lastPushedAt);

          if (pendingRes.error && !isMissingSyncBackend(pendingRes.error)) {
            throw pendingRes.error;
          }

          return [tableName, pendingRes.error ? 0 : (pendingRes.count ?? 0)] as const;
        }),
      );
      const pendingChangesByTable = Object.fromEntries(pendingCounts);
      const pendingChanges = pendingCounts.reduce((total, [, count]) => total + count, 0);

      return {
        latestRun: latestRunRes.data as LatestSyncRun | null,
        unresolvedConflicts: conflictsRes.error ? 0 : (conflictsRes.count ?? 0),
        pendingChanges,
        pendingChangesByTable,
        leadLastPushedAt: lastPushedByTable.get("leads") ?? null,
        unavailableReason: null,
      };
    },
  });
}
