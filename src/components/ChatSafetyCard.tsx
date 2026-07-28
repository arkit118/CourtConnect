import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface Props {
  onAcknowledged: () => void;
}

// Shown once before a user's first chat message / first time opening a
// chat. Saves chat_safety_acknowledged_at on their profile. If the save
// fails, we still let them continue (this is a courtesy record, not a
// security gate - the real gates are Terms acceptance and
// social_features_enabled, both already enforced before chat is reachable
// at all) and show the error inline rather than blocking chat entirely.
export function ChatSafetyCard({ onAcknowledged }: Props) {
  const { user, refreshProfile } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAcknowledge = async () => {
    setSubmitting(true);
    setError(null);
    try {
      if (user) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ chat_safety_acknowledged_at: new Date().toISOString() })
          .eq('id', user.id);

        if (updateError) throw updateError;
        await refreshProfile();
      }
      onAcknowledged();
    } catch (err: any) {
      console.error('Error saving chat safety acknowledgement:', err);
      setError(err.message || 'Could not save your acknowledgement, but you can still continue.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-elevated w-full max-w-md p-6 animate-scale-in">
        <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center mb-4">
          <ShieldCheck className="w-6 h-6 text-primary-600" />
        </div>
        <h3 className="text-xl font-bold text-secondary-900 mb-2">Before you chat</h3>
        <ul className="text-sm text-secondary-600 space-y-2 mb-6 list-disc list-inside">
          <li>Meet at public courts, ideally in daylight and busy locations.</li>
          <li>Do not share sensitive personal information (address, financial details, etc.).</li>
          <li>Do not arrange paid hitting, coaching, or lessons through CourtConnect.</li>
          <li>If you're under 18, involve a parent or guardian.</li>
          <li>Report or block anyone who makes you uncomfortable.</li>
        </ul>

        {error && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 mb-4">{error}</div>
        )}

        <button type="button" onClick={handleAcknowledge} className="btn-primary w-full" disabled={submitting}>
          {submitting ? 'Saving...' : 'I Understand, Continue'}
        </button>
      </div>
    </div>
  );
}
