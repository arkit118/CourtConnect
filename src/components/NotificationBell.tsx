import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { Notification } from '../lib/supabase';

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// Where tapping a notification goes. A new play request opens /matches
// (where Accept/Decline live) rather than the chat, which isn't usable
// until the request is accepted.
function notificationLink(n: Notification): string | null {
  switch (n.type) {
    case 'match_request':
      return '/matches';
    case 'match_accepted':
    case 'chat_message':
      return n.source_id ? `/matches/${n.source_id}` : '/matches';
    case 'parent_consent_decided':
      return '/players';
    case 'comment':
      if (!n.source_id) return null;
      if (n.source_type === 'event') return `/events/${n.source_id}`;
      if (n.source_type === 'listing') return `/gear/${n.source_id}`;
      return null;
    default:
      return null;
  }
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, unreadCount, unavailable, markAsRead, markAllAsRead, refresh } = useNotifications();
  const navigate = useNavigate();

  // Degrades to nothing rather than an empty/broken bell when the
  // notifications table isn't there yet - see useNotifications.ts.
  if (unavailable) return null;

  const handleRowClick = (n: Notification) => {
    if (!n.read_at) void markAsRead(n.id);
    const link = notificationLink(n);
    setIsOpen(false);
    if (link) navigate(link);
  };

  return (
    // Not `relative` below sm: the panel then anchors to the sticky header
    // (full width) instead of the bell, which sits left of the avatar/menu
    // buttons and would push a bell-anchored panel off the left edge.
    <div className="sm:relative">
      <button
        onClick={() => {
          if (!isOpen) void refresh();
          setIsOpen((v) => !v);
        }}
        className="relative p-2 rounded-xl hover:bg-secondary-50 transition-colors"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
      >
        <Bell className="w-5 h-5 text-secondary-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-4 right-4 top-full mt-2 sm:left-auto sm:right-0 sm:w-80 bg-white rounded-xl shadow-elevated border border-secondary-100 z-50 max-h-[28rem] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-secondary-100">
              <p className="font-semibold text-secondary-900">Notifications</p>
              {unreadCount > 0 && (
                <button
                  onClick={() => void markAllAsRead()}
                  className="text-xs font-semibold text-primary-600 hover:text-primary-700"
                >
                  Mark all as read
                </button>
              )}
            </div>

            <div className="overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-sm text-secondary-500 px-4 py-8 text-center">
                  Nothing yet - play requests, messages, and updates will show up here.
                </p>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleRowClick(n)}
                    className={`w-full text-left px-4 py-3 border-b border-secondary-50 last:border-0 hover:bg-secondary-50 transition-colors ${
                      !n.read_at ? 'bg-primary-50/40' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read_at && <span className="w-2 h-2 mt-1.5 rounded-full bg-primary-600 shrink-0" />}
                      <div className={n.read_at ? 'pl-4' : ''}>
                        <p className="text-sm font-semibold text-secondary-900">{n.title}</p>
                        {n.body && <p className="text-sm text-secondary-600 mt-0.5">{n.body}</p>}
                        <p className="text-xs text-secondary-400 mt-1">{timeAgo(n.created_at)}</p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
