'use client';
import { cn, getLoginHref } from '../../lib/utils';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api, type Notification } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';

export default function NotificationsPage() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  async function loadNotifications() {
    setLoading(true);
    try {
      const data = await api.getNotifications();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  }

  async function markRead(id: string) {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }

  async function markAllRead() {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadNotifications();
  }, []);

  if (!user) {
    return (
      <div className={cn("mx-auto w-full max-w-[1520px] px-5 pt-6 pb-12", "py-12")}>
        <Card className="mx-auto max-w-2xl p-8 text-center">
          <h1 className="font-serif text-2xl font-medium text-foreground">Notifications</h1>
          <p className="mt-2 text-sm text-muted-copy">Please log in to view your notifications.</p>
          <Button asChild className="mt-4">
            <Link href={getLoginHref(pathname)}>Go to Login</Link>
          </Button>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={cn("mx-auto w-full max-w-[1520px] px-5 pt-6 pb-12", "py-12 text-center text-sm text-muted-copy")}>Loading notifications...</div>
    );
  }

  return (
    <div className={cn("mx-auto w-full max-w-[1520px] px-5 pt-6 pb-12", "py-6 md:py-8")}>
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-4 mb-6">
          <h1 className="font-serif text-2xl font-medium text-foreground">Notifications</h1>
          {unreadCount > 0 && (
            <Button variant="secondary" onClick={markAllRead} className="text-xs">
              Mark all as read
            </Button>
          )}
        </div>

        <Card className="divide-y divide-border overflow-hidden">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-copy">No notifications yet.</div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification._id}
                className={`flex items-start justify-between gap-4 p-4 transition hover:bg-surface-muted ${
                  notification.read ? 'opacity-70' : 'bg-surface-muted/40'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{notification.title}</p>
                  <p className="text-sm text-muted-copy mt-0.5">{notification.message}</p>
                  <p className="text-xs text-muted-copy mt-1">
                    {new Date(notification.createdAt).toLocaleString()}
                  </p>
                  {notification.link && (
                    <Link
                      href={notification.link}
                      className="mt-2 inline-block text-xs font-semibold text-primary hover:underline"
                    >
                      View
                    </Link>
                  )}
                </div>
                {!notification.read && (
                  <Button variant="secondary" size="sm" onClick={() => markRead(notification._id)} className="shrink-0">
                    Mark read
                  </Button>
                )}
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
