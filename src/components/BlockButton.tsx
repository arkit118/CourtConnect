import { useState } from 'react';
import { Ban, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToastStore } from '../hooks/useToast';
import { supabase } from '../lib/supabase';

interface Props {
  blockedUserId: string;
  onBlocked?: () => void;
  label?: string;
  className?: string;
}

export function BlockButton({ blockedUserId, onBlocked, label = 'Block', className }: Props) {
  const { user } = useAuth();
  const { addToast } = useToastStore();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleOpen = () => {
    if (!user) {
      addToast({ type: 'error', message: 'Please sign in to block a user.' });
      return;
    }
    setOpen(true);
  };

  const handleClose = () => {
    if (submitting) return;
    setOpen(false);
  };

  const handleConfirm = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('blocks').insert({
        blocker_id: user.id,
        blocked_id: blockedUserId,
      });
      // A duplicate block (already blocked) is harmless - treat it as
      // success rather than surfacing a confusing unique-violation error.
      if (error && error.code !== '23505') throw error;

      addToast({ type: 'success', message: 'User blocked. You will no longer be matched or able to chat.' });
      setOpen(false);
      onBlocked?.();
    } catch (err: any) {
      console.error('Error blocking user:', err);
      addToast({ type: 'error', message: err.message || 'Failed to block user' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={className || 'inline-flex items-center gap-1.5 text-sm text-secondary-500 hover:text-red-600 transition-colors'}
      >
        <Ban className="w-4 h-4" />
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
          <div className="relative bg-white rounded-2xl shadow-elevated w-full max-w-sm p-6 animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-secondary-900">Block this user?</h3>
              <button type="button" onClick={handleClose} disabled={submitting} className="p-1.5 rounded-lg hover:bg-secondary-100 disabled:opacity-50">
                <X className="w-5 h-5 text-secondary-500" />
              </button>
            </div>
            <p className="text-sm text-secondary-600 mb-6">
              You will no longer be matched or able to chat with this user, and any open match between you will be
              closed.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={handleClose} className="btn-ghost flex-1" disabled={submitting}>
                Cancel
              </button>
              <button type="button" onClick={handleConfirm} className="btn flex-1 bg-red-600 text-white hover:bg-red-700" disabled={submitting}>
                {submitting ? 'Blocking...' : 'Block User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
