import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToastStore } from '../hooks/useToast';
import { useActionGate } from '../hooks/useActionGate';
import { useSocialEligibility } from '../hooks/useSocialEligibility';
import { SocialOnboardingGate } from '../components/SocialOnboardingGate';
import { SocialSafetyBanner } from '../components/SocialSafetyBanner';
import { ReportButton } from '../components/ReportButton';
import { supabase, MatchCandidate } from '../lib/supabase';
import { withTimeout } from '../lib/withTimeout';
import { User, Check, Heart, Loader2 } from 'lucide-react';

// The old partner_requests / "Browse Players" / "Request to Hit" flow has
// been retired: it let any signed-in user request any other user
// regardless of age band, Terms/Privacy acceptance, or ban status - none
// of the safety guarantees the matches/messages system enforces at the
// database level. Partner Matching (get_match_candidates + matches) is
// now the only way to find and request a hitting partner through
// CourtConnect. The underlying partner_requests table is left in place
// (unused, harmless) rather than dropped, since this is a frontend-only
// retirement and dropping a table is a destructive schema change outside
// this fix's scope.
export function PartnersPage() {
  const eligibility = useSocialEligibility();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container-custom">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-secondary-900 mb-2">Partner Matching</h1>
          <p className="text-secondary-600">
            Safe, age-banded partner matching for community tennis. Minors are only ever matched with other minors,
            and adults only with other adults.
          </p>
        </div>

        {eligibility !== 'eligible' ? <SocialOnboardingGate status={eligibility} /> : <MatchCandidatesList />}
      </div>
    </div>
  );
}

function MatchCandidatesList() {
  const { user } = useAuth();
  const { addToast } = useToastStore();
  const canProceed = useActionGate();
  const [candidates, setCandidates] = useState<MatchCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [requested, setRequested] = useState<Set<string>>(new Set());

  const fetchCandidates = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await withTimeout(
        supabase.rpc('get_match_candidates'),
        15000,
        'Loading match candidates timed out. Please try refreshing.'
      );
      if (rpcError) throw rpcError;
      setCandidates(data || []);
    } catch (err: any) {
      console.error('Error fetching match candidates:', err);
      setError(err.message || 'Failed to load match candidates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRequestMatch = async (candidateId: string) => {
    if (!user) return;
    if (!(await canProceed())) return;

    setRequesting(candidateId);
    try {
      const { error: insertError } = await supabase.from('matches').insert({
        user_a: user.id,
        user_b: candidateId,
        requested_by: user.id,
        status: 'pending',
      });

      if (insertError) {
        if (insertError.code === '23505') {
          addToast({ type: 'info', message: 'You already have a pending or active match with this person.' });
          setRequested((prev) => new Set(prev).add(candidateId));
          return;
        }
        throw insertError;
      }

      addToast({ type: 'success', message: 'Match request sent!' });
      setRequested((prev) => new Set(prev).add(candidateId));
    } catch (err: any) {
      console.error('Error requesting match:', err);
      addToast({ type: 'error', message: err.message || 'Failed to send match request' });
    } finally {
      setRequesting(null);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <SocialSafetyBanner />
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card p-6">
              <div className="animate-pulse">
                <div className="w-16 h-16 rounded-xl bg-secondary-200 mb-4" />
                <div className="h-4 bg-secondary-200 rounded w-24 mb-2" />
                <div className="h-3 bg-secondary-200 rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="card p-12 text-center">
          <p className="text-secondary-900 font-semibold mb-1">Couldn't load match candidates</p>
          <p className="text-secondary-600 text-sm">{error}</p>
        </div>
      ) : candidates.length === 0 ? (
        <div className="text-center py-12">
          <Heart className="w-12 h-12 text-secondary-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-secondary-900 mb-2">No match candidates right now</h3>
          <p className="text-secondary-600">Check back soon as more members join.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {candidates.map((candidate) => (
            <div key={candidate.id} className="card-hover p-6">
              <div className="flex items-center gap-4 mb-4">
                {candidate.avatar_url ? (
                  <img src={candidate.avatar_url} alt={candidate.name} className="w-16 h-16 rounded-xl object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-primary-100 flex items-center justify-center">
                    <User className="w-8 h-8 text-primary-500" />
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-secondary-900">{candidate.name}</h3>
                  <p className="text-sm text-secondary-500">{candidate.home_town}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {candidate.skill_level && <span className="badge-primary">{candidate.skill_level}</span>}
                {candidate.utr_rating && <span className="badge-secondary">UTR {candidate.utr_rating}</span>}
              </div>
              {candidate.bio && <p className="text-sm text-secondary-600 mb-4 line-clamp-2">{candidate.bio}</p>}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRequestMatch(candidate.id)}
                  className="btn-outline flex-1"
                  disabled={requesting === candidate.id || requested.has(candidate.id)}
                >
                  {requesting === candidate.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : requested.has(candidate.id) ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Heart className="w-4 h-4" />
                  )}
                  {requested.has(candidate.id) ? 'Requested' : 'Request Match'}
                </button>
                <ReportButton reportType="user" targetId={candidate.id} reportedUserId={candidate.id} label="" className="p-2 rounded-lg border border-secondary-200 text-secondary-500 hover:text-red-600 hover:border-red-200" />
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-secondary-500 text-center mt-8 max-w-lg mx-auto">
        Partner matching is for community tennis coordination only. Meet at public courts, use good judgment, and do
        not arrange paid hitting or coaching through CourtConnect.
      </p>
    </div>
  );
}
