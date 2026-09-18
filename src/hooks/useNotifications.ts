import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, Notification } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const NOTIFICATIONS_MISSING_TABLE_CODE = '42P01';
const RECENT_NOTIFICATIONS_LIMIT = 30;

// Backs the notification bell in Header.tsx. Degrades to "no
// notifications" rather than throwing whenever the notifications table
// doesn't exist yet (a fresh environment the 023_notifications.sql
// migration hasn't been applied to) - the rest of the app must keep
// working either way, per the task's explicit "should not crash" rule.
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
      if (error.code === NOTIFICATIONS_MISSING_TABLE_CODE) {
        setUnavailable(true);
        setNotifications([]);
      } else {
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

  // Realtime subscription, same pattern as ChatPage.tsx's message feed -
  // new notification rows only ever arrive by insert (see
  // 023_notifications.sql's triggers), never updated by another party.
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setNotifications((prev) => {
            const incoming = payload.new as Notification;
            if (prev.some((n) => n.id === incoming.id)) return prev;
            return [incoming, ...prev].slice(0, RECENT_NOTIFICATIONS_LIMIT);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

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

  return { notifications, unreadCount, loading, unavailable, markAsRead, markAllAsRead };
}
