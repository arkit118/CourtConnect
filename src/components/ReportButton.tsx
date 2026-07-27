import { useState } from 'react';
import { Flag, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToastStore } from '../hooks/useToast';
import { useActionGate } from '../hooks/useActionGate';
import { supabase, ReportType } from '../lib/supabase';

const REASONS = [
  'Safety concern',
  'Harassment or inappropriate behavior',
  'Scam or suspicious listing',
  'Incorrect information',
  'Court rule issue',
  'Spam',
  'Other',
];

interface ReportButtonProps {
  reportType: ReportType;
  targetId?: string;
  reportedUserId?: string;
  label?: string;
  className?: string;
}

export function ReportButton({ reportType, targetId, reportedUserId, label = 'Report', className }: ReportButtonProps) {
  const { user } = useAuth();
  const { addToast } = useToastStore();
  const canProceed = useActionGate();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleOpen = () => {
    if (!user) {
      addToast({ type: 'error', message: 'Please sign in to submit a report.' });
      return;
    }
    setOpen(true);
  };

  const handleClose = () => {
    if (submitting) return;
    setOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      addToast({ type: 'error', message: 'Please sign in to submit a report.' });
      return;
    }

    const ok = await canProceed();
    if (!ok) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('reports').insert({
        reporter_id: user.id,
        reported_user_id: reportedUserId || null,
        report_type: reportType,
        target_id: targetId || null,
        reason,
        details: details.trim() || null,
        status: 'open',
      });

      if (error) throw error;

      addToast({ type: 'success', message: 'Thanks — your report has been submitted for review.' });
      setOpen(false);
      setDetails('');
      setReason(REASONS[0]);
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to submit report' });
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
        <Flag className="w-4 h-4" />
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
          <div className="relative bg-white rounded-2xl shadow-elevated w-full max-w-md p-6 animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-secondary-900">Submit a Report</h3>
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="p-1.5 rounded-lg hover:bg-secondary-100 disabled:opacity-50"
              >
                <X className="w-5 h-5 text-secondary-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Reason</label>
                <select value={reason} onChange={(e) => setReason(e.target.value)} className="input">
                  {REASONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Details (optional)</label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  className="input min-h-[100px]"
                  placeholder="Anything else we should know..."
                />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={handleClose} className="btn-ghost flex-1" disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
