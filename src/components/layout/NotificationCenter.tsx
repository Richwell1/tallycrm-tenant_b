import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth-context";
import { formatRelative } from "@/lib/format";
import {
  NOTIFICATION_FILTERS,
  type NotificationFilter,
  type NotificationRow,
  notificationHref,
  notificationIcon,
  notificationTone,
  notificationTypeLabel,
  useDeleteNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationPreferences,
  useNotifications,
  useNotificationsRealtime,
  useUnreadNotificationCount,
} from "@/lib/notifications-data";
import { cn } from "@/lib/utils";

export function NotificationCenter() {
  const { user } = useAuth();
  const userId = user?.id;
  const { data: notifications, isLoading, isError, error, refetch } = useNotifications(userId);
  const unreadCount = useUnreadNotificationCount(userId);
  const markRead = useMarkNotificationRead(userId);
  const markAllRead = useMarkAllNotificationsRead(userId);
  const deleteNotification = useDeleteNotification(userId);
  const { preferences, setPreference } = useNotificationPreferences(userId);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [open, setOpen] = useState(false);

  useNotificationsRealtime(userId);

  const filtered = useMemo(() => {
    const list = notifications ?? [];
    if (filter === "all") return list;
    if (filter === "unread") return list.filter((notification) => !notification.read);
    return list.filter((notification) => normalizeType(notification.type) === filter);
  }, [filter, notifications]);

  async function handleMarkAllRead() {
    try {
      await markAllRead.mutateAsync();
    } catch (err) {
      toast.error("Could not mark notifications as read", {
        description: (err as Error).message,
      });
    }
  }

  async function handleDelete(notification: NotificationRow) {
    try {
      await deleteNotification.mutateAsync(notification.id);
      toast.success("Notification dismissed");
    } catch (err) {
      toast.error("Could not dismiss notification", {
        description: (err as Error).message,
      });
    }
  }

  async function handleOpen(notification: NotificationRow) {
    if (!notification.read) {
      try {
        await markRead.mutateAsync({ id: notification.id, read: true });
      } catch {
        // Navigation should still work even if the read mutation fails.
      }
    }
    setOpen(false);
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          title="Notifications"
          aria-label={`${unreadCount} unread notifications`}
        >
          <span className="material-symbols-outlined">notifications</span>
          {unreadCount > 0 ? (
            <span className="absolute right-1.5 top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-card bg-cta px-1 text-[10px] font-bold leading-none text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={10} className="w-[420px] p-0">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[15px] font-semibold text-foreground">Notifications</h2>
              <p className="mt-0.5 text-[12px] text-text-secondary">
                Reminders, escalations, assignments, and digests
              </p>
            </div>
            <button
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0 || markAllRead.isPending}
              className="rounded-md px-2 py-1 text-[12px] font-semibold text-primary hover:bg-primary-light disabled:pointer-events-none disabled:opacity-50"
            >
              Mark all read
            </button>
          </div>
          <div className="mt-3 flex gap-1 overflow-x-auto pb-1">
            {NOTIFICATION_FILTERS.map((item) => {
              const count = countForFilter(notifications ?? [], item.value);
              return (
                <button
                  key={item.value}
                  onClick={() => setFilter(item.value)}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors",
                    filter === item.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-text-secondary hover:bg-primary-light hover:text-primary",
                  )}
                >
                  {item.label}
                  {count > 0 ? <span className="ml-1 opacity-80">{count}</span> : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {isLoading ? (
            <NotificationSkeleton />
          ) : isError ? (
            <NotificationError
              message={(error as Error)?.message ?? "Could not load notifications"}
              onRetry={() => refetch()}
            />
          ) : filtered.length === 0 ? (
            <NotificationEmpty filter={filter} />
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onOpen={handleOpen}
                  onToggleRead={(read) =>
                    markRead.mutate(
                      { id: notification.id, read },
                      {
                        onError: (err) =>
                          toast.error("Could not update notification", {
                            description: (err as Error).message,
                          }),
                      },
                    )
                  }
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border bg-muted/60 px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[12px] font-semibold text-foreground">Email mirror</p>
              <p className="text-[11px] text-text-secondary">
                Mirror critical in-app alerts by email when SMTP is enabled.
              </p>
            </div>
            <Switch
              checked={preferences.emailMirror}
              onCheckedChange={(checked) => {
                setPreference("emailMirror", checked);
                toast.success(checked ? "Email mirror enabled" : "Email mirror disabled");
              }}
              aria-label="Toggle email mirror"
            />
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationItem({
  notification,
  onOpen,
  onToggleRead,
  onDelete,
}: {
  notification: NotificationRow;
  onOpen: (notification: NotificationRow) => void;
  onToggleRead: (read: boolean) => void;
  onDelete: (notification: NotificationRow) => void;
}) {
  const href = notificationHref(notification);
  const icon = notificationIcon(notification.type);
  const tone = notificationTone(notification.type, notification.read);

  return (
    <div
      className={cn(
        "group flex gap-3 px-4 py-3 transition-colors hover:bg-surface-hover",
        !notification.read && "bg-primary-light/40",
      )}
    >
      <div
        className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", tone)}
      >
        <span className="material-symbols-outlined text-[19px]">{icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <a
            href={href}
            onClick={() => onOpen(notification)}
            className="min-w-0 flex-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <div className="flex items-center gap-2">
              <p className="truncate text-[13px] font-semibold text-foreground">
                {notification.title}
              </p>
              {!notification.read ? (
                <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
              ) : null}
            </div>
            {notification.body ? (
              <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-text-secondary">
                {notification.body}
              </p>
            ) : null}
          </a>
          <button
            onClick={() => onDelete(notification)}
            className="rounded-md p-1 text-text-muted opacity-0 transition-opacity hover:bg-danger-light hover:text-danger group-hover:opacity-100 focus:opacity-100"
            title="Dismiss notification"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-card px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">
              {notificationTypeLabel(notification.type)}
            </span>
            <span className="text-[11px] font-medium text-text-muted">
              {formatRelative(notification.created_at)}
            </span>
          </div>
          <button
            onClick={() => onToggleRead(!notification.read)}
            className="text-[11px] font-semibold text-primary opacity-0 transition-opacity hover:underline group-hover:opacity-100 focus:opacity-100"
          >
            {notification.read ? "Mark unread" : "Mark read"}
          </button>
        </div>
      </div>
    </div>
  );
}

function NotificationSkeleton() {
  return (
    <div className="space-y-1 p-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="flex gap-3 rounded-lg p-2">
          <div className="skeleton h-9 w-9 rounded-lg" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-3/5" />
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-2/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

function NotificationError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="p-5 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-danger-light text-danger">
        <span className="material-symbols-outlined">error</span>
      </div>
      <p className="text-sm font-semibold text-foreground">Notifications unavailable</p>
      <p className="mt-1 text-xs text-text-secondary">{message}</p>
      <button
        onClick={onRetry}
        className="mt-4 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white"
      >
        Retry
      </button>
    </div>
  );
}

function NotificationEmpty({ filter }: { filter: NotificationFilter }) {
  const label = filter === "all" ? "No notifications yet" : `No ${filter} notifications`;
  return (
    <div className="px-6 py-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-text-muted">
        <span className="material-symbols-outlined">notifications_off</span>
      </div>
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <p className="mt-1 text-xs leading-5 text-text-secondary">
        New reminders, escalations, assignments, and digests will appear here.
      </p>
    </div>
  );
}

function countForFilter(notifications: NotificationRow[], filter: NotificationFilter) {
  if (filter === "all") return notifications.length;
  if (filter === "unread") return notifications.filter((notification) => !notification.read).length;
  return notifications.filter((notification) => normalizeType(notification.type) === filter).length;
}

function normalizeType(type: string): NotificationFilter {
  if (type === "task_reminder" || type === "activity_reminder") return "reminder";
  if (type === "sla_breach") return "escalation";
  if (type === "lead_assignment") return "assignment";
  if (type === "daily_digest") return "digest";
  if (type === "automation") return "automation";
  if (type === "email_failed" || type === "email") return "email";
  return "system";
}
