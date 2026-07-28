import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { User, Calendar, MapPin, Clock, Mail, Check, X, Send, ArrowLeft, Info, Heart, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { useToastStore } from '../hooks/useToast';
import { useActionGate } from '../hooks/useActionGate';
import { useSocialEligibility } from '../hooks/useSocialEligibility';
import { SocialOnboardingGate } from '../components/SocialOnboardingGate';
import { SocialSafetyBanner } from '../components/SocialSafetyBanner';
import { ReportButton } from '../components/ReportButton';
import { supabase, PartnerRequest, Profile, MatchCandidate } from '../lib/supabase';
import { withTimeout } from '../lib/withTimeout';

const statusColors = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  accepted: 'bg-green-50 text-green-700 border-green-200',
  declined: 'bg-red-50 text-red-700 border-red-200',
};

export function PartnersPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'browse' | 'matching' | 'requests'>('browse');
  const [players, setPlayers] = useState<Profile[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<PartnerRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<PartnerRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      // Fetch players
      const { data: playersData } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', user?.id || '')
        .eq('is_banned', false)
        .order('created_at', { ascending: false })
        .limit(20);
      setPlayers(playersData || []);

      // Fetch requests if logged in
      if (user) {
        // Incoming requests
        const { data: incoming } = await supabase
          .from('partner_requests')
          .select('*, requester:profiles!partner_requests_requester_id_fkey(*)')
          .eq('recipient_id', user.id)
          .order('created_at', { ascending: false });
        setIncomingRequests(incoming || []);

        // Outgoing requests
        const { data: outgoing } = await supabase
          .from('partner_requests')
          .select('*, recipient:profiles!partner_requests_recipient_id_fkey(*)')
          .eq('requester_id', user.id)
          .order('created_at', { ascending: false });
        setOutgoingRequests(outgoing || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container-custom">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-secondary-900 mb-2">Partner Matching</h1>
          <p className="text-secondary-600">Find hitting partners and schedule sessions</p>
        </div>

        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            Meet at public courts and use good judgment. Minors should involve a parent or guardian.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 flex-wrap">
          <button
            onClick={() => setActiveTab('browse')}
            className={`btn ${activeTab === 'browse' ? 'btn-primary' : 'btn-ghost'}`}
          >
            Browse Players
          </button>
          <button
            onClick={() => setActiveTab('matching')}
            className={`btn ${activeTab === 'matching' ? 'btn-primary' : 'btn-ghost'}`}
          >
            <Heart className="w-4 h-4" />
            Partner Matching
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`btn ${activeTab === 'requests' ? 'btn-primary' : 'btn-ghost'} relative`}
          >
            Requests
            {incomingRequests.filter((r) => r.status === 'pending').length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-accent-500 text-xs text-secondary-900 flex items-center justify-center font-semibold">
                {incomingRequests.filter((r) => r.status === 'pending').length}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'browse' ? (
          <BrowsePartners players={players} loading={loading} />
        ) : activeTab === 'matching' ? (
          <MatchCandidatesTab />
        ) : (
          <RequestsView incomingRequests={incomingRequests} outgoingRequests={outgoingRequests} onAction={fetchData} />
        )}
      </div>
    </div>
  );
}

function BrowsePartners({ players, loading }: { players: Profile[]; loading: boolean }) {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToastStore();
  const [search, setSearch] = useState('');

  const filteredPlayers = players.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.home_town?.toLowerCase().includes(search.toLowerCase())
  );

  const handleRequestClick = (playerId: string) => {
    if (!isAuthenticated) {
      navigate('/auth/login', { state: { from: { pathname: `/partners/request/${playerId}` } } });
    } else {
      navigate(`/partners/request/${playerId}`);
    }
  };

  return (
    <>
      {/* Search */}
      <div className="card p-4 mb-6">
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search players..."
            className="input pl-10"
          />
        </div>
      </div>

      {/* Players Grid */}
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
      ) : filteredPlayers.length === 0 ? (
        <div className="text-center py-12">
          <User className="w-12 h-12 text-secondary-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-secondary-900 mb-2">No players found</h3>
          <p className="text-secondary-600">Try adjusting your search or check back later</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlayers.map((player) => (
            <div key={player.id} className="card-hover p-6">
              <div className="flex items-center gap-4 mb-4">
                {player.avatar_url ? (
                  <img src={player.avatar_url} alt={player.name} className="w-16 h-16 rounded-xl object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-primary-100 flex items-center justify-center">
                    <User className="w-8 h-8 text-primary-500" />
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-secondary-900">{player.name}</h3>
                  <p className="text-sm text-secondary-500">{player.home_town}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {player.skill_level && (
                  <span className="badge-primary">{player.skill_level}</span>
                )}
                {player.utr_rating && <span className="badge-secondary">UTR {player.utr_rating}</span>}
              </div>
              <button onClick={() => handleRequestClick(player.id)} className="btn-outline w-full">
                <Send className="w-4 h-4" />
                Request to Hit
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function MatchCandidatesTab() {
  const eligibility = useSocialEligibility();

  if (eligibility !== 'eligible') {
    return <SocialOnboardingGate status={eligibility} />;
  }

  return <MatchCandidatesList />;
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

function RequestsView({ incomingRequests, outgoingRequests, onAction }: { incomingRequests: PartnerRequest[]; outgoingRequests: PartnerRequest[]; onAction: () => void }) {
  const { addToast } = useToastStore();
  const { user } = useAuth();
  const canProceed = useActionGate();

  const handleAccept = async (requestId: string) => {
    if (!(await canProceed())) return;
    try {
      const { error } = await supabase
        .from('partner_requests')
        .update({ status: 'accepted' })
        .eq('id', requestId);
      if (error) throw error;
      addToast({ type: 'success', message: 'Request accepted!' });
      onAction();
    } catch (error: any) {
      console.error('Error accepting partner request:', error);
      addToast({ type: 'error', message: error.message || 'Failed to accept' });
    }
  };

  const handleDecline = async (requestId: string) => {
    if (!(await canProceed())) return;
    try {
      const { error } = await supabase
        .from('partner_requests')
        .update({ status: 'declined' })
        .eq('id', requestId);
      if (error) throw error;
      addToast({ type: 'info', message: 'Request declined' });
      onAction();
    } catch (error: any) {
      console.error('Error declining partner request:', error);
      addToast({ type: 'error', message: error.message || 'Failed to decline' });
    }
  };

  return (
    <div className="space-y-8">
      {/* Incoming Requests */}
      <div>
        <h2 className="text-xl font-semibold text-secondary-900 mb-4">Incoming Requests ({incomingRequests.length})</h2>
        {incomingRequests.length === 0 ? (
          <div className="card p-8 text-center">
            <Mail className="w-12 h-12 text-secondary-300 mx-auto mb-4" />
            <p className="text-secondary-600">No pending requests</p>
          </div>
        ) : (
          <div className="space-y-4">
            {incomingRequests.map((request) => (
              <div key={request.id} className="card p-6">
                <div className="flex flex-col md:flex-row gap-4 justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-primary-100 flex items-center justify-center">
                      <User className="w-7 h-7 text-primary-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-secondary-900">
                        {(request as any).requester?.name || 'Player'}
                      </h3>
                      <div className="flex flex-wrap gap-4 text-sm text-secondary-500 mt-1">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>{format(new Date(request.proposed_date), 'MMM d, yyyy')}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>{request.proposed_time}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          <span>{request.proposed_location}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`badge px-3 py-1 rounded-full text-sm font-medium border ${statusColors[request.status]}`}>
                      {request.status}
                    </span>
                    {request.status === 'pending' && (
                      <>
                        <button onClick={() => handleAccept(request.id)} className="btn-primary btn-sm">
                          <Check className="w-4 h-4" />
                          Accept
                        </button>
                        <button onClick={() => handleDecline(request.id)} className="btn-ghost btn-sm text-red-600">
                          <X className="w-4 h-4" />
                          Decline
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {request.message && (
                  <div className="mt-4 p-3 bg-secondary-50 rounded-lg text-sm text-secondary-600">
                    "{request.message}"
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Outgoing Requests */}
      <div>
        <h2 className="text-xl font-semibold text-secondary-900 mb-4">Your Requests</h2>
        {outgoingRequests.length === 0 ? (
          <div className="card p-8 text-center">
            <User className="w-12 h-12 text-secondary-300 mx-auto mb-4" />
            <p className="text-secondary-600 mb-4">You haven't sent any requests yet</p>
            <Link to="/partners" className="btn-outline">Find Partners</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {outgoingRequests.map((request) => (
              <div key={request.id} className="card p-6">
                <div className="flex flex-col md:flex-row gap-4 justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-primary-100 flex items-center justify-center">
                      <User className="w-7 h-7 text-primary-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-secondary-900">
                        Request to {(request as any).recipient?.name || 'Player'}
                      </h3>
                      <div className="flex flex-wrap gap-4 text-sm text-secondary-500 mt-1">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>{format(new Date(request.proposed_date), 'MMM d, yyyy')}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          <span>{request.proposed_location}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <span className={`badge px-3 py-1 rounded-full text-sm font-medium border ${statusColors[request.status]}`}>
                    {request.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function PartnerRequestPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { addToast } = useToastStore();
  const canProceed = useActionGate();
  const [player, setPlayer] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    date: '',
    time: '',
    location: '',
    message: '',
  });

  useEffect(() => {
    if (id) fetchPlayer();
  }, [id]);

  const fetchPlayer = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setPlayer(data);
    } catch (error) {
      console.error('Error fetching player:', error);
      addToast({ type: 'error', message: 'Failed to load player' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      navigate('/auth/login', { state: { from: { pathname: `/partners/request/${id}` } } });
      return;
    }
    if (!(await canProceed())) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('partner_requests')
        .insert({
          requester_id: user!.id,
          recipient_id: id!,
          proposed_date: form.date,
          proposed_time: form.time,
          proposed_location: form.location,
          message: form.message || null,
          status: 'pending',
        });

      if (error) throw error;
      addToast({ type: 'success', message: 'Request sent!' });
      navigate('/partners');
    } catch (error: any) {
      console.error('Error sending partner request:', error);
      addToast({ type: 'error', message: error.message || 'Failed to send request' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-secondary-900 mb-4">Player not found</h2>
          <Link to="/partners" className="btn-primary">Browse Partners</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container-custom max-w-xl">
        <Link to="/partners" className="inline-flex items-center gap-2 text-secondary-600 hover:text-secondary-900 mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back to Partners
        </Link>

        <div className="card p-6 md:p-8">
          <h1 className="text-2xl font-bold text-secondary-900 mb-2">Request to Hit</h1>
          <p className="text-secondary-600 mb-8">Send a request to schedule a hitting session</p>

          {/* Player Info */}
          <div className="flex items-center gap-4 p-4 bg-secondary-50 rounded-xl mb-6">
            {player.avatar_url ? (
              <img src={player.avatar_url} alt={player.name} className="w-14 h-14 rounded-xl object-cover" />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-primary-100 flex items-center justify-center">
                <User className="w-7 h-7 text-primary-500" />
              </div>
            )}
            <div>
              <h3 className="font-semibold text-secondary-900">{player.name}</h3>
              <p className="text-sm text-secondary-500">{player.home_town} | {player.skill_level}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">Time</label>
                <input
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                  className="input"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Location</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="input"
                placeholder="e.g. Brookdale Park Tennis Courts"
                required
              />
            </div>

            <div>
              <label className="label">Message (optional)</label>
              <textarea
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="input min-h-[100px]"
                placeholder="Introduce yourself or share what you're looking for..."
              />
            </div>

            <button type="submit" className="btn-primary w-full" disabled={submitting}>
              <Send className="w-4 h-4" />
              {submitting ? 'Sending...' : 'Send Request'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
