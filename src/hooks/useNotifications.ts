import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, Notification } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const RECENT_NOTIFICATIONS_LIMIT = 30;
// Fallback when realtime isn't delivering (e.g. the publication change in
// 025 not applied yet, or a dropped socket on a suspended iOS WebView).
const POLL_INTERVAL_MS = 60_000;

// Missing-table signals across PostgREST versions: older ones pass through
// Postgres' 42P01; newer ones (what hosted Supabase runs now) return
// PGRST205 "Could not find the table ... in the schema cache".
function isMissingTableError(error: { code?: string; message?: string }): boolean {
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /could not find the table/i.test(error.message ?? '')
  );
}

function sortNewestFirst(list: Notification[]): Notification[] {
  return [...list].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, RECENT_NOTIFICATIONS_LIMIT);
}

// Backs the notification bell in Header.tsx. Degrades to "unavailable"
// (bell hidden) rather than throwing when the notifications table doesn't
// exist yet in an environment, so the rest of the app keeps working.
export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(RECENT_NOTIFICATIONS_LIMIT);

    if (!mountedRef.current) return;

    if (error) {
      if (isMissingTableError(error)) {
        setUnavailable(true);
        setNotifications([]);
      } else {
        // Transient failure - keep whatever is already shown; the next
        // poll/foreground refetch will catch up.
        console.error('useNotifications: failed to load notifications', error);
      }
      setLoading(false);
      return;
    }

    setUnavailable(false);
    setNotifications((data as Notification[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  // Catch up whenever the app returns to the foreground or reconnects, and
  // on a slow poll while visible. The header (and this hook) stays mounted
  // for the app's whole lifetime - on iOS that can be days - so without
  // this a fetch-on-mount alone would never show anything new.
  useEffect(() => {
    if (!user) return;

    const refetchIfVisible = () => {
      if (document.visibilityState === 'visible') void fetchNotifications();
    };
    const interval = window.setInterval(refetchIfVisible, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', refetchIfVisible);
    window.addEventListener('focus', refetchIfVisible);
    window.addEventListener('online', refetchIfVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refetchIfVisible);
      window.removeEventListener('focus', refetchIfVisible);
      window.removeEventListener('online', refetchIfVisible);
    };
  }, [user, fetchNotifications]);

  // Realtime push of new rows (INSERT) and collapsed chat notifications
  // being refreshed in place (UPDATE - see 025's notify_chat_message).
  useEffect(() => {
    if (!user || unavailable) return;

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const incoming = payload.new as Notification;
          setNotifications((prev) =>
            prev.some((n) => n.id === incoming.id) ? prev : sortNewestFirst([incoming, ...prev])
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const updated = payload.new as Notification;
          setNotifications((prev) => sortNewestFirst([updated, ...prev.filter((n) => n.id !== updated.id)]));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, unavailable]);

  const markAsRead = useCallback(async (id: string) => {
    const readAt = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: readAt } : n)));
    const { error } = await supabase.from('notifications').update({ read_at: readAt }).eq('id', id);
    if (error) console.error('useNotifications: failed to mark notification read', error);
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    const readAt = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: readAt })));
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: readAt })
      .eq('user_id', user.id)
      .is('read_at', null);
    if (error) console.error('useNotifications: failed to mark all notifications read', error);
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return {
    notifications,
    unreadCount,
    loading,
    unavailable,
    markAsRead,
    markAllAsRead,
    refresh: fetchNotifications,
  };
}
