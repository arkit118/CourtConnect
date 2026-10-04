import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, Filter, Clock, User, Check, Heart, Loader2, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToastStore } from '../hooks/useToast';
import { useActionGate } from '../hooks/useActionGate';
import { useSocialEligibility } from '../hooks/useSocialEligibility';
import { SocialOnboardingGate } from '../components/SocialOnboardingGate';
import { SocialSafetyBanner } from '../components/SocialSafetyBanner';
import { ReportButton } from '../components/ReportButton';
import { BlockButton } from '../components/BlockButton';
import { supabase, Profile, MatchCandidate } from '../lib/supabase';
import { withTimeout } from '../lib/withTimeout';
import { PageHero } from '../components/brand/PageHero';
import { CourtCorner } from '../components/brand/CourtMotif';
import { NJ_TOWNS } from '../lib/towns';
import { skillLevelLabels, skillLevelOrder, skillLevelColors } from '../lib/skillLevel';

const towns = NJ_TOWNS;

const ageBandLabels: Record<'minor' | 'adult', string> = {
  minor: 'Under 18',
  adult: 'Adult',
};

// Fields common to both data sources this page can render from - the
// public profiles table (Profile) and get_match_candidates()'s safe
// column allowlist (MatchCandidate). Both shapes structurally satisfy
// this, so either can be passed straight into the shared card list below
// without a mapping step.
type PlayerCardData = {
  id: string;
  name: string;
  home_town: string | null;
  skill_level: Profile['skill_level'];
  utr_rating: number | null;
  bio: string | null;
  avatar_url: string | null;
  age_band: 'minor' | 'adult' | null;
  availability: string[];
};

// Members-only (App.tsx wraps this route in MembersOnlyRoute, so signed-out
// visitors never reach it). Player discovery only ever comes from
// get_match_candidates() - which self-limits to the caller's own age band,
// excludes banned/blocked/already-matched people, and returns a safe column
// allowlist - so a signed-in user who isn't yet eligible (e.g. a minor
// awaiting parent approval, or an account without a date of birth) sees
// the steps to become eligible instead of a directory. This used to fall
// back to reading the whole profiles table for those users, which showed
// every member across both age bands. The real safety boundary is still
// server-side: enforce_match_safety on public.matches re-verifies age band,
// bans, Terms/Privacy, and blocks on every request.
export function PlayersPage() {
  const eligibility = useSocialEligibility();
  if (eligibility === 'eligible') return <EligibleCandidateList />;
  return (
    <PageChrome>
      <SocialOnboardingGate status={eligibility} />
    </PageChrome>
  );
}

function PageChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <PageHero
        eyebrow="Livingston & Nearby NJ"
        title="Players"
        description="Find local players across Livingston and nearby NJ towns, filter by skill level or self-reported UTR, and send a match request."
      />
      <div className="container-custom py-8">{children}</div>
    </div>
  );
}

function PlayerFilters({
  search,
  setSearch,
  selectedSkillLevels,
  toggleSkill,
  selectedTowns,
  toggleTown,
  utrRange,
  setUtrRange,
  selectedAgeBands,
  toggleAgeBand,
  showAgeBandFilter,
  showFilters,
  setShowFilters,
  hasActiveFilters,
  clearFilters,
  activeFilterCount,
}: {
  search: string;
  setSearch: (v: string) => void;
  selectedSkillLevels: string[];
  toggleSkill: (skill: string) => void;
  selectedTowns: string[];
  toggleTown: (town: string) => void;
  utrRange: [number, number];
  setUtrRange: (v: [number, number]) => void;
  selectedAgeBands: string[];
  toggleAgeBand: (band: string) => void;
  showAgeBandFilter: boolean;
  showFilters: boolean;
  setShowFilters: (v: boolean) => void;
  hasActiveFilters: boolean;
  clearFilters: () => void;
  activeFilterCount: number;
}) {
  return (
    <div className="card p-4 mb-6">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or town..."
            className="input pl-10"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`btn ${showFilters ? 'btn-primary' : 'btn-outline'}`}
        >
          <Filter className="w-4 h-4" />
          Filters
          {hasActiveFilters && (
            <span className="ml-1 w-5 h-5 rounded-full bg-accent-500 text-xs flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
        {hasActiveFilters && (
          <button onClick={clearFilters} className="btn-ghost text-secondary-600">
            Clear all
          </button>
        )}
      </div>

      {showFilters && (
        <div className="mt-6 pt-6 border-t border-secondary-100 space-y-6">
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-3">Skill Level</label>
            <div className="flex flex-wrap gap-2">
              {skillLevelOrder.map((skill) => (
                <button
                  key={skill}
                  onClick={() => toggleSkill(skill)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedSkillLevels.includes(skill)
                      ? 'bg-primary-500 text-white'
                      : 'bg-secondary-100 text-secondary-700 hover:bg-secondary-200'
                  }`}
                >
                  {skillLevelLabels[skill]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-3">Town</label>
            <div className="flex flex-wrap gap-2">
              {towns.map((town) => (
                <button
                  key={town}
                  onClick={() => toggleTown(town)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                    selectedTowns.includes(town)
                      ? 'bg-primary-500 text-white'
                      : 'bg-secondary-100 text-secondary-700 hover:bg-secondary-200'
                  }`}
                >
                  {town}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-3">
              Self-Reported UTR Range: {utrRange[0]} - {utrRange[1]}
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="1"
                max="10"
                step="0.5"
                value={utrRange[0]}
                onChange={(e) => setUtrRange([Math.min(parseFloat(e.target.value), utrRange[1]), utrRange[1]])}
                className="flex-1"
              />
              <input
                type="range"
                min="1"
                max="10"
                step="0.5"
                value={utrRange[1]}
                onChange={(e) => setUtrRange([utrRange[0], Math.max(parseFloat(e.target.value), utrRange[0])])}
                className="flex-1"
              />
            </div>
          </div>

          {showAgeBandFilter && (
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-3">Age/Safety Eligibility</label>
              <div className="flex flex-wrap gap-2">
                {(['adult', 'minor'] as const).map((band) => (
                  <button
                    key={band}
                    onClick={() => toggleAgeBand(band)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      selectedAgeBands.includes(band)
                        ? 'bg-primary-500 text-white'
                        : 'bg-secondary-100 text-secondary-700 hover:bg-secondary-200'
                    }`}
                  >
                    {ageBandLabels[band]}
                  </button>
                ))}
              </div>
              <p className="text-xs text-secondary-500 mt-2">
                Matching always keeps adults and minors separate - this is informational only.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function usePlayerFilters(hasAgeBand: boolean) {
  const [search, setSearch] = useState('');
  const [selectedSkillLevels, setSelectedSkillLevels] = useState<string[]>([]);
  const [selectedTowns, setSelectedTowns] = useState<string[]>([]);
  const [utrRange, setUtrRange] = useState<[number, number]>([1, 10]);
  const [selectedAgeBands, setSelectedAgeBands] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const toggleSkill = (skill: string) =>
    setSelectedSkillLevels((prev) => (prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]));
  const toggleTown = (town: string) =>
    setSelectedTowns((prev) => (prev.includes(town) ? prev.filter((t) => t !== town) : [...prev, town]));
  const toggleAgeBand = (band: string) =>
    setSelectedAgeBands((prev) => (prev.includes(band) ? prev.filter((b) => b !== band) : [...prev, band]));

  const clearFilters = () => {
    setSelectedSkillLevels([]);
    setSelectedTowns([]);
    setUtrRange([1, 10]);
    setSelectedAgeBands([]);
    setSearch('');
  };

  const filterPlayers = (players: PlayerCardData[]) =>
    players.filter((player) => {
      const matchesSearch =
        !search ||
        player.name.toLowerCase().includes(search.toLowerCase()) ||
        player.home_town?.toLowerCase().includes(search.toLowerCase());

      const matchesSkill = selectedSkillLevels.length === 0 || selectedSkillLevels.includes(player.skill_level || '');
      const matchesTown = selectedTowns.length === 0 || selectedTowns.includes(player.home_town || '');
      const matchesUtr = !player.utr_rating || (player.utr_rating >= utrRange[0] && player.utr_rating <= utrRange[1]);
      const matchesAgeBand =
        !hasAgeBand || selectedAgeBands.length === 0 || selectedAgeBands.includes(player.age_band || '');

      return matchesSearch && matchesSkill && matchesTown && matchesUtr && matchesAgeBand;
    });

  const hasActiveFilters =
    selectedSkillLevels.length > 0 ||
    selectedTowns.length > 0 ||
    selectedAgeBands.length > 0 ||
    !!search ||
    utrRange[0] !== 1 ||
    utrRange[1] !== 10;

  const activeFilterCount = selectedSkillLevels.length + selectedTowns.length + selectedAgeBands.length;

  return {
    search,
    setSearch,
    selectedSkillLevels,
    toggleSkill,
    selectedTowns,
    toggleTown,
    utrRange,
    setUtrRange,
    selectedAgeBands,
    toggleAgeBand,
    showFilters,
    setShowFilters,
    hasActiveFilters,
    activeFilterCount,
    clearFilters,
    filterPlayers,
  };
}

function PlayerCard({
  player,
  linkToProfile,
  requestSlot,
}: {
  player: PlayerCardData;
  linkToProfile: boolean;
  requestSlot?: React.ReactNode;
}) {
  const body = (
    <>
      <div className="flex items-start gap-4 mb-4">
        {player.avatar_url ? (
          <img src={player.avatar_url} alt={player.name} className="w-16 h-16 rounded-xl object-cover" />
        ) : (
          <div className="w-16 h-16 rounded-xl bg-primary-100 flex items-center justify-center">
            <User className="w-8 h-8 text-primary-500" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-secondary-900 truncate">{player.name}</h3>
          {player.home_town && (
            <div className="flex items-center gap-1 text-sm text-secondary-500">
              <MapPin className="w-3 h-3" />
              <span>{player.home_town}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {player.skill_level && (
          <span className={`badge px-2 py-0.5 rounded-full text-xs font-medium border ${skillLevelColors[player.skill_level]}`}>
            {skillLevelLabels[player.skill_level]}
          </span>
        )}
        {player.utr_rating && (
          <span className="badge bg-primary-50 text-primary-700">Self-reported UTR {player.utr_rating}</span>
        )}
      </div>

      {player.availability && player.availability.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-secondary-500 mb-2">
          <Clock className="w-4 h-4" />
          <span>{player.availability.join(', ')}</span>
        </div>
      )}

      {player.bio && <p className="text-sm text-secondary-600 mt-1 line-clamp-2">{player.bio}</p>}
    </>
  );

  return (
    <div className="rounded-3xl bg-white border border-secondary-200 hover:border-primary-300 transition-colors p-6">
      {linkToProfile ? (
        <Link to={`/players/${player.id}`} className="block group">
          {body}
        </Link>
      ) : (
        body
      )}
      {requestSlot}
    </div>
  );
}

function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="rounded-3xl bg-white border border-secondary-200 p-12 text-center">
      <CourtCorner className="w-8 h-8 text-primary-400 mx-auto mb-4" />
      <h3 className="font-display text-lg font-bold text-secondary-900 mb-2">No players found</h3>
      <p className="text-secondary-600 mb-4">Try adjusting your filters.</p>
      <button onClick={onClear} className="btn-outline">Clear Filters</button>
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="card p-6">
          <div className="animate-pulse">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-xl bg-secondary-200" />
              <div className="flex-1">
                <div className="h-4 bg-secondary-200 rounded w-24 mb-2" />
                <div className="h-3 bg-secondary-200 rounded w-16" />
              </div>
            </div>
            <div className="h-3 bg-secondary-200 rounded w-full mb-2" />
            <div className="h-3 bg-secondary-200 rounded w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Eligible branch - the real matching flow, unchanged from what
// PartnersPage.tsx used to do on its own separate route: get_match_
// candidates() RPC (already self-limited to the caller's own age_band,
// already excludes banned/blocked/already-matched people), with filters
// layered on top the same way the public directory above does.
function EligibleCandidateList() {
  const { user } = useAuth();
  const { addToast } = useToastStore();
  const canProceed = useActionGate();
  const [candidates, setCandidates] = useState<MatchCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [requested, setRequested] = useState<Set<string>>(new Set());
  const filters = usePlayerFilters(false);

  const fetchCandidates = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await withTimeout(
        supabase.rpc('get_match_candidates'),
        15000,
        'Loading players timed out. Please try refreshing.'
      );
      if (rpcError) throw rpcError;
      // Defense in depth: get_match_candidates() already excludes the
      // caller server-side (see 20260728000008_015_social_rpcs.sql), but
      // this is a safety-sensitive list (adults/minors must never be
      // shown someone to request/play with who is themselves) so the
      // client filters again rather than trusting a single layer.
      setCandidates((data || []).filter((c: MatchCandidate) => c.id !== user?.id));
    } catch (err: any) {
      console.error('Error fetching match candidates:', err);
      setError(err.message || 'Failed to load players');
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

  const filteredCandidates = filters.filterPlayers(candidates);

  return (
    <PageChrome>
      <div className="mb-6">
        <SocialSafetyBanner />
      </div>

      <PlayerFilters
        search={filters.search}
        setSearch={filters.setSearch}
        selectedSkillLevels={filters.selectedSkillLevels}
        toggleSkill={filters.toggleSkill}
        selectedTowns={filters.selectedTowns}
        toggleTown={filters.toggleTown}
        utrRange={filters.utrRange}
        setUtrRange={filters.setUtrRange}
        selectedAgeBands={filters.selectedAgeBands}
        toggleAgeBand={filters.toggleAgeBand}
        showAgeBandFilter={false}
        showFilters={filters.showFilters}
        setShowFilters={filters.setShowFilters}
        hasActiveFilters={filters.hasActiveFilters}
        clearFilters={filters.clearFilters}
        activeFilterCount={filters.activeFilterCount}
      />

      <div className="mb-6 flex items-center gap-2 text-secondary-600">
        <Shield className="w-4 h-4 text-primary-500" />
        <p>
          {filters.hasActiveFilters
            ? `Showing ${filteredCandidates.length} of ${candidates.length} eligible players for your age group and safety settings`
            : `${candidates.length} eligible player${candidates.length === 1 ? '' : 's'} found`}
        </p>
      </div>

      {loading ? (
        <LoadingGrid />
      ) : error ? (
        <div className="card p-12 text-center">
          <p className="text-secondary-900 font-semibold mb-1">Couldn't load players</p>
          <p className="text-secondary-600 text-sm">{error}</p>
        </div>
      ) : candidates.length === 0 ? (
        <div className="rounded-3xl bg-white border border-secondary-200 p-12 text-center">
          <CourtCorner className="w-12 h-12 text-clay-400 mx-auto mb-4" />
          <h3 className="font-display text-lg font-bold text-secondary-900 mb-2">No eligible players yet</h3>
          <p className="text-secondary-600">
            Invite local players or check back as more players from Livingston and nearby NJ towns join. Matching
            always keeps adults and minors separate, so you'll only ever see players in your own age group.
          </p>
        </div>
      ) : filteredCandidates.length === 0 ? (
        <EmptyState onClear={filters.clearFilters} />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCandidates.map((candidate) => (
            <PlayerCard
              key={candidate.id}
              player={candidate}
              linkToProfile={false}
              requestSlot={
                <div className="flex items-center gap-2 mt-4">
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
                    {requested.has(candidate.id) ? 'Requested' : 'Send match request'}
                  </button>
                  <ReportButton
                    reportType="user"
                    targetId={candidate.id}
                    reportedUserId={candidate.id}
                    label=""
                    className="p-2 rounded-lg border border-secondary-200 text-secondary-500 hover:text-red-600 hover:border-red-200"
                  />
                  <BlockButton
                    blockedUserId={candidate.id}
                    label=""
                    className="p-2 rounded-lg border border-secondary-200 text-secondary-500 hover:text-red-600 hover:border-red-200"
                    onBlocked={() => setCandidates((prev) => prev.filter((c) => c.id !== candidate.id))}
                  />
                </div>
              }
            />
          ))}
        </div>
      )}

      <p className="text-xs text-secondary-500 text-center mt-8 max-w-lg mx-auto">
        Player matching is for community tennis coordination only. Meet at public courts, use good judgment, and do
        not arrange paid hitting or coaching through CourtConnect.
      </p>
    </PageChrome>
  );
}
