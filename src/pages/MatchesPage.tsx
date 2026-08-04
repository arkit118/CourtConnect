import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Users, Check, X, MessageCircle, Clock, AlertCircle } from 'lucide-react';
import { PageHero } from '../components/brand/PageHero';
import { useAuth } from '../contexts/AuthContext';
import { useToastStore } from '../hooks/useToast';
import { useActionGate } from '../hooks/useActionGate';
import { useSocialEligibility } from '../hooks/useSocialEligibility';
import { SocialOnboardingGate } from '../components/SocialOnboardingGate';
import { SocialSafetyBanner } from '../components/SocialSafetyBanner';
import { ReportButton } from '../components/ReportButton';
import { supabase, Match, Profile } from '../lib/supabase';
import { withTimeout } from '../lib/withTimeout';

type MatchWithOther = Match & { other: Pick<Profile, 'id' | 'name' | 'avatar_url' | 'home_town'> | null };

export function MatchesPage() {
  const { user } = useAuth();
  const { addToast } = useToastStore();
  const canProceed = useActionGate();
  const eligibility = useSocialEligibility();

  const [matches, setMatches] = useState<MatchWithOther[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const fetchMatches = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await withTimeout(
        supabase
          .from('matches')
          .select('*')
          .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
          .order('updated_at', { ascending: false }),
        15000,
        'Loading matches timed out. Please try refreshing.'
      );

      if (fetchError) throw fetchError;

      const rows = data || [];
      const otherIds = Array.from(
        new Set(rows.map((m) => (m.user_a === user.id ? m.user_b : m.user_a)))
      );

      let profileMap: Record<string, Pick<Profile, 'id' | 'name' | 'avatar_url' | 'home_town'>> = {};
      if (otherIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, name, avatar_url, home_town')
          .in('id', otherIds);
        if (profilesError) throw profilesError;
        profileMap = Object.fromEntries((profilesData || []).map((p) => [p.id, p]));
      }

      setMatches(
        rows.map((m) => ({
          ...m,
          other: profileMap[m.user_a === user.id ? m.user_b : m.user_a] || null,
        }))
      );
    } catch (err: any) {
      console.error('Error fetching matches:', err);
      setError(err.message || 'Failed to load matches');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (eligibility === 'eligible') {
      fetchMatches();
    } else {
      setLoading(false);
    }
  }, [eligibility, fetchMatches]);

  const handleAccept = async (matchId: string) => {
    if (!(await canProceed())) return;
    setActingOn(matchId);
    try {
      const { error: updateError } = await supabase
        .from('matches')
        .update({ status: 'active', accepted_at: new Date().toISOString() })
        .eq('id', matchId);
      if (updateError) throw updateError;
      addToast({ type: 'success', message: 'Match accepted! You can now chat.' });
      await fetchMatches();
    } catch (err: any) {
      console.error('Error accepting match:', err);
      addToast({ type: 'error', message: err.message || 'Failed to accept match' });
    } finally {
      setActingOn(null);
    }
  };

  const handleDecline = async (matchId: string) => {
    if (!(await canProceed())) return;
    setActingOn(matchId);
    try {
      const { error: updateError } = await supabase
        .from('matches')
        .update({ status: 'declined' })
        .eq('id', matchId);
      if (updateError) throw updateError;
      addToast({ type: 'info', message: 'Match declined' });
      await fetchMatches();
    } catch (err: any) {
      console.error('Error declining match:', err);
      addToast({ type: 'error', message: err.message || 'Failed to decline match' });
    } finally {
      setActingOn(null);
    }
  };

  const handleEnd = async (matchId: string) => {
    if (!(await canProceed())) return;
    setActingOn(matchId);
    try {
      const { error: updateError } = await supabase
        .from('matches')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', matchId);
      if (updateError) throw updateError;
      addToast({ type: 'info', message: 'Match ended' });
      await fetchMatches();
    } catch (err: any) {
      console.error('Error ending match:', err);
      addToast({ type: 'error', message: err.message || 'Failed to end match' });
    } finally {
      setActingOn(null);
    }
  };

  if (eligibility !== 'eligible') {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHero title="Matches" description="Your partner match requests and active chats, in one place." />
        <div className="container-custom max-w-lg py-8">
          <SocialOnboardingGate status={eligibility} />
        </div>
      </div>
    );
  }

  const receivedPending = matches.filter((m) => m.status === 'pending' && m.requested_by !== user?.id);
  const sentPending = matches.filter((m) => m.status === 'pending' && m.requested_by === user?.id);
  const active = matches.filter((m) => m.status === 'active');
  const other = matches.filter((m) => ['declined', 'ended', 'blocked'].includes(m.status));

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHero title="Matches" description="Your partner match requests and active chats, in one place." />
      <div className="container-custom max-w-3xl py-8">
        <div className="mb-6">
          <SocialSafetyBanner />
        </div>

        {loading ? (
          <div className="card p-12 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500 mx-auto" />
          </div>
        ) : error ? (
          <div className="card p-12 text-center">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
            <p className="text-secondary-900 font-semibold mb-1">Couldn't load your matches</p>
            <p className="text-secondary-600 text-sm">{error}</p>
          </div>
        ) : (
          <div className="space-y-8">
            <MatchSection title={`Requests Received (${receivedPending.length})`}>
              {receivedPending.length === 0 ? (
                <EmptyRow>No one has requested a match yet - they'll show up here.</EmptyRow>
              ) : (
                receivedPending.map((m) => (
                  <MatchCard key={m.id} match={m} stripe="pending_received">
                    <button onClick={() => handleAccept(m.id)} className="btn-primary btn-sm" disabled={actingOn === m.id}>
                      <Check className="w-4 h-4" /> Accept
                    </button>
                    <button onClick={() => handleDecline(m.id)} className="btn-ghost btn-sm text-red-600" disabled={actingOn === m.id}>
                      <X className="w-4 h-4" /> Decline
                    </button>
                    <ReportButton reportType="match" targetId={m.id} reportedUserId={m.other?.id} label="Report" />
                  </MatchCard>
                ))
              )}
            </MatchSection>

            <MatchSection title={`Requests Sent (${sentPending.length})`}>
              {sentPending.length === 0 ? (
                <EmptyRow>
                  You haven't sent any match requests. <Link to="/partners" className="text-primary-600 font-semibold underline underline-offset-2">Find players &rarr;</Link>
                </EmptyRow>
              ) : (
                sentPending.map((m) => (
                  <MatchCard key={m.id} match={m} stripe="pending_sent">
                    <span className="badge bg-yellow-50 text-yellow-700 border border-yellow-200">Waiting for response</span>
                  </MatchCard>
                ))
              )}
            </MatchSection>

            <MatchSection title={`Active Matches (${active.length})`}>
              {active.length === 0 ? (
                <EmptyRow>Accepted matches - and their chat - will show up here.</EmptyRow>
              ) : (
                active.map((m) => (
                  <MatchCard key={m.id} match={m} stripe="active">
                    <Link to={`/matches/${m.id}`} className="btn-primary btn-sm">
                      <MessageCircle className="w-4 h-4" /> Chat
                    </Link>
                    <button onClick={() => handleEnd(m.id)} className="btn-ghost btn-sm text-secondary-600" disabled={actingOn === m.id}>
                      End
                    </button>
                    <ReportButton reportType="match" targetId={m.id} reportedUserId={m.other?.id} label="Report" />
                  </MatchCard>
                ))
              )}
            </MatchSection>

            {other.length > 0 && (
              <MatchSection title={`Past Matches (${other.length})`}>
                {other.map((m) => (
                  <MatchCard key={m.id} match={m}>
                    <span className="badge bg-secondary-100 text-secondary-600 capitalize">{m.status}</span>
                  </MatchCard>
                ))}
              </MatchSection>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MatchSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-display text-lg font-bold text-secondary-900 mb-3">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-secondary-300 p-6 text-center text-secondary-500 text-sm">
      {children}
    </div>
  );
}

// A thin left-edge stripe per match status, like a scoreboard tag -
// received requests (needs your action) get the clay accent so they
// stand out from the rest of the list at a glance.
const statusStripe: Record<string, string> = {
  pending_received: 'border-l-clay-500',
  pending_sent: 'border-l-accent-400',
  active: 'border-l-primary-500',
  other: 'border-l-secondary-200',
};

function MatchCard({
  match,
  children,
  stripe = 'other',
}: {
  match: MatchWithOther;
  children: React.ReactNode;
  stripe?: keyof typeof statusStripe;
}) {
  return (
    <div
      className={`rounded-2xl bg-white border border-secondary-200 border-l-4 ${statusStripe[stripe]} p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {match.other?.avatar_url ? (
          <img src={match.other.avatar_url} alt={match.other.name} className="w-11 h-11 rounded-xl object-cover" />
        ) : (
          <div className="w-11 h-11 rounded-xl bg-primary-100 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-primary-500" />
          </div>
        )}
        <div className="min-w-0">
          <p className="font-semibold text-secondary-900 truncate">{match.other?.name || 'CourtConnect member'}</p>
          {match.other?.home_town && <p className="text-sm text-secondary-500 truncate">{match.other.home_town}</p>}
          <p className="text-xs text-secondary-400 flex items-center gap-1 mt-0.5">
            <Clock className="w-3 h-3" /> {new Date(match.updated_at).toLocaleDateString()}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 flex-wrap">{children}</div>
    </div>
  );
}
