"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { NotificationItem } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingBlock } from "@/components/ui/loading";
import { formatDate } from "@/lib/utils";

type NotificationPortal = "company" | "technician" | "client";

export function NotificationsPage({ portal = "company" }: { portal?: NotificationPortal }) {
  const queryClient = useQueryClient();
  const notifications = useQuery({ queryKey: ["notifications"], queryFn: () => api.listNotifications({ page: 1 }) });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
  };
  const markRead = useMutation({ mutationFn: api.markNotificationRead, onSuccess: invalidate });
  const markUnread = useMutation({ mutationFn: api.markNotificationUnread, onSuccess: invalidate });
  const markAll = useMutation({
    mutationFn: api.markAllNotificationsRead,
    onSuccess: () => {
      toast.success("All notifications marked as read");
      invalidate();
    },
  });

  if (notifications.isLoading) return <LoadingBlock label="Loading notifications" />;
  if (notifications.isError) {
    return (
      <ErrorState
        title="Could not load notifications"
        message="Your workflow alerts could not be loaded. Please try again."
        onAction={() => void notifications.refetch()}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Notifications</h2>
          <p className="mt-1 text-sm text-muted-foreground">Workflow alerts and status updates for your account.</p>
        </div>
        <Button variant="secondary" onClick={() => markAll.mutate()}>
          <CheckCheck className="h-4 w-4" />
          Mark all read
        </Button>
      </div>
      <Card>
        <CardHeader>
          <h3 className="font-semibold">{notifications.data?.count ?? 0} notifications</h3>
        </CardHeader>
        <CardContent className="space-y-3">
          {!notifications.data?.results.length ? (
            <EmptyState message="New workflow notifications will appear here." />
          ) : (
            notifications.data.results.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                portal={portal}
                onRead={() => markRead.mutate(notification.id)}
                onUnread={() => markUnread.mutate(notification.id)}
                onOpen={async () => {
                  if (!notification.is_read) await markRead.mutateAsync(notification.id);
                }}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NotificationRow({
  notification,
  portal,
  onRead,
  onUnread,
  onOpen,
}: {
  notification: NotificationItem;
  portal: NotificationPortal;
  onRead: () => void;
  onUnread: () => void;
  onOpen: () => Promise<void>;
}) {
  const router = useRouter();
  const href = notification.work_order
    ? portal === "client"
      ? `/client/requests/${notification.work_order.id}`
      : portal === "technician"
        ? `/tech/work-orders/${notification.work_order.id}`
        : `/app/work-orders/${notification.work_order.id}`
    : undefined;

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-4 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          {href ? (
            <Link
              className="font-semibold text-primary hover:underline"
              href={href}
              onClick={async (event) => {
                event.preventDefault();
                await onOpen();
                router.push(href);
              }}
            >
              {notification.title}
            </Link>
          ) : (
            <h4 className="font-semibold">{notification.title}</h4>
          )}
          {!notification.is_read ? <Badge value="Unread" /> : null}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{notification.message}</p>
        <p className="mt-2 text-xs text-muted-foreground">{formatDate(notification.created_at)}</p>
      </div>
      <Button variant="secondary" size="sm" onClick={notification.is_read ? onUnread : onRead}>
        {notification.is_read ? "Mark unread" : "Mark read"}
      </Button>
    </div>
  );
}
