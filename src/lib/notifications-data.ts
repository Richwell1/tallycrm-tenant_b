import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];
export type NotificationType =
  | "reminder"
  | "escalation"
  | "assignment"
  | "digest"
  | "automation"
  | "email"
  | "system";

export type NotificationFilter = "all" | "unread" | NotificationType;

export interface NotificationPreferences {
  emailMirror: boolean;
  reminders: boolean;
  escalations: boolean;
  assignments: boolean;
  digests: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  emailMirror: false,
  reminders: true,
  escalations: true,
  assignments: true,
  digests: true,
};

export const NOTIFICATION_FILTERS: Array<{ label: string; value: NotificationFilter }> = [
  { label: "All", value: "all" },
  { label: "Unread", value: "unread" },
  { label: "Reminders", value: "reminder" },
  { label: "Escalations", value: "escalation" },
  { label: "Assignments", value: "assignment" },
  { label: "Digests", value: "digest" },
];

export function notificationsKey(userId: string | undefined) {
  return ["notifications", userId] as const;
}

export function useNotifications(userId: string | undefined) {
  return useQuery<NotificationRow[]>({
    queryKey: notificationsKey(userId),
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return [];
      if (!isSupabaseConfigured()) return previewNotifications(userId);

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data ?? []) as NotificationRow[];
    },
    staleTime: 20_000,
  });
}

export function useUnreadNotificationCount(userId: string | undefined) {
  const { data } = useNotifications(userId);
  return (data ?? []).filter((notification) => !notification.read).length;
}

export function useNotificationsRealtime(userId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId || !isSupabaseConfigured()) return;

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: notificationsKey(userId) });
          const row = payload.new as NotificationRow;
          toast(row.title, {
            description: row.body ?? notificationTypeLabel(row.type),
            icon: notificationIcon(row.type),
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: notificationsKey(userId) });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);
}

export function useMarkNotificationRead(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, read = true }: { id: string; read?: boolean }) => {
      if (!userId) throw new Error("No signed-in user");
      if (!isSupabaseConfigured()) return;

      const { error } = await supabase
        .from("notifications")
        .update({ read })
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onMutate: async ({ id, read = true }) => {
      await queryClient.cancelQueries({ queryKey: notificationsKey(userId) });
      const previous = queryClient.getQueryData<NotificationRow[]>(notificationsKey(userId));
      queryClient.setQueryData<NotificationRow[]>(notificationsKey(userId), (current = []) =>
        current.map((notification) =>
          notification.id === id ? { ...notification, read } : notification,
        ),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(notificationsKey(userId), context.previous);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationsKey(userId) }),
  });
}

export function useMarkAllNotificationsRead(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("No signed-in user");
      if (!isSupabaseConfigured()) return;

      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", userId)
        .eq("read", false);
      if (error) throw error;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: notificationsKey(userId) });
      const previous = queryClient.getQueryData<NotificationRow[]>(notificationsKey(userId));
      queryClient.setQueryData<NotificationRow[]>(notificationsKey(userId), (current = []) =>
        current.map((notification) => ({ ...notification, read: true })),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(notificationsKey(userId), context.previous);
      }
    },
    onSuccess: () => toast.success("All notifications marked as read"),
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationsKey(userId) }),
  });
}

export function useDeleteNotification(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error("No signed-in user");
      if (!isSupabaseConfigured()) return;

      const { error } = await supabase
        .from("notifications")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: notificationsKey(userId) });
      const previous = queryClient.getQueryData<NotificationRow[]>(notificationsKey(userId));
      queryClient.setQueryData<NotificationRow[]>(notificationsKey(userId), (current = []) =>
        current.filter((notification) => notification.id !== id),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(notificationsKey(userId), context.previous);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationsKey(userId) }),
  });
}

export function useNotificationPreferences(userId: string | undefined) {
  const storageKey = `tally-crm-notification-prefs:${userId ?? "anonymous"}`;
  const [preferences, setPreferences] = useState<NotificationPreferences>(() => {
    if (typeof window === "undefined") return DEFAULT_PREFERENCES;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return DEFAULT_PREFERENCES;
    try {
      return { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<NotificationPreferences>) };
    } catch {
      return DEFAULT_PREFERENCES;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(preferences));
  }, [preferences, storageKey]);

  return useMemo(
    () => ({
      preferences,
      setPreference: (key: keyof NotificationPreferences, value: boolean) =>
        setPreferences((current) => ({ ...current, [key]: value })),
    }),
    [preferences],
  );
}

export function notificationIcon(type: string) {
  if (type === "reminder" || type === "task_reminder" || type === "activity_reminder")
    return "notifications_active";
  if (type === "escalation" || type === "sla_breach") return "priority_high";
  if (type === "assignment" || type === "lead_assignment") return "assignment_ind";
  if (type === "digest" || type === "daily_digest") return "summarize";
  if (type === "automation") return "auto_mode";
  if (type === "email" || type === "email_failed") return "mail";
  return "notifications";
}

export function notificationTone(type: string, read: boolean) {
  if (read) return "bg-muted text-text-muted";
  if (type === "escalation" || type === "sla_breach") return "bg-danger-light text-danger";
  if (type === "reminder" || type === "task_reminder" || type === "activity_reminder")
    return "bg-warning-light text-warning";
  if (type === "assignment" || type === "lead_assignment") return "bg-primary-light text-primary";
  if (type === "digest" || type === "daily_digest") return "bg-info-light text-info";
  return "bg-success-light text-success";
}

export function notificationTypeLabel(type: string) {
  if (type === "task_reminder" || type === "activity_reminder") return "Reminder";
  if (type === "sla_breach") return "Escalation";
  if (type === "lead_assignment") return "Assignment";
  if (type === "daily_digest") return "Digest";
  return type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function notificationHref(notification: NotificationRow) {
  if (notification.entity === "lead" && notification.entity_id) {
    return `/app/leads/${notification.entity_id}`;
  }
  if (notification.entity === "deal" && notification.entity_id) {
    return `/app/deals/${notification.entity_id}`;
  }
  if (notification.entity === "contact" && notification.entity_id) {
    return `/app/contacts/${notification.entity_id}`;
  }
  if (notification.entity === "company" && notification.entity_id) {
    return `/app/companies/${notification.entity_id}`;
  }
  if (notification.entity === "task") return "/app/tasks";
  if (notification.entity === "analytics") return "/app/analytics";
  return "/app";
}

function previewNotifications(userId: string): NotificationRow[] {
  const now = Date.now();
  const rows: Array<Omit<NotificationRow, "user_id">> = [
    {
      id: "preview-assignment",
      type: "lead_assignment",
      title: "New lead assigned",
      body: "Akosua from Tally Landing Page needs first contact within 4 hours.",
      entity: "lead",
      entity_id: null,
      read: false,
      deleted_at: null,
      created_at: new Date(now - 8 * 60_000).toISOString(),
    },
    {
      id: "preview-reminder",
      type: "task_reminder",
      title: "Follow-up due soon",
      body: "Send proposal follow-up for Northstar Foods before 3:00 PM.",
      entity: "task",
      entity_id: null,
      read: false,
      deleted_at: null,
      created_at: new Date(now - 42 * 60_000).toISOString(),
    },
    {
      id: "preview-escalation",
      type: "sla_breach",
      title: "SLA breach: Negotiation stage",
      body: "A high-value deal has been stale for 3 days and needs manager attention.",
      entity: "deal",
      entity_id: null,
      read: false,
      deleted_at: null,
      created_at: new Date(now - 2 * 60 * 60_000).toISOString(),
    },
    {
      id: "preview-digest",
      type: "daily_digest",
      title: "Morning sales digest",
      body: "5 tasks due today, 2 overdue follow-ups, and 3 new landing page leads.",
      entity: "task",
      entity_id: null,
      read: true,
      deleted_at: null,
      created_at: new Date(now - 5 * 60 * 60_000).toISOString(),
    },
  ];

  return rows.map((row) => ({ ...row, user_id: userId }));
}
