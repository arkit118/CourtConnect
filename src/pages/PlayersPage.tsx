import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, Filter, Clock, User, Info } from 'lucide-react';
import { supabase, Profile } from '../lib/supabase';
import { PageHero } from '../components/brand/PageHero';
import { CourtCorner } from '../components/brand/CourtMotif';

const skillLevelLabels: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  varsity: 'Varsity',
  elite: 'Elite',
};

const skillLevelOrder = ['beginner', 'intermediate', 'advanced', 'varsity', 'elite'];

const skillLevelColors: Record<string, string> = {
  beginner: 'bg-navy-50 text-navy-700 border-navy-200',
  intermediate: 'bg-primary-50 text-primary-700 border-primary-200',
  advanced: 'bg-clay-400/10 text-clay-600 border-clay-400/30',
  varsity: 'bg-accent-50 text-accent-700 border-accent-200',
  elite: 'bg-secondary-100 text-secondary-800 border-secondary-300',
};

// Pilot launch - one town today, matching Courts/Events/Schedule (see
// PRODUCT.md: don't imply Essex-County-wide reach the product doesn't
// have yet).
const towns = ['Livingston'];

export function PlayersPage() {
  const [players, setPlayers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSkillLevels, setSelectedSkillLevels] = useState<string[]>([]);
  const [selectedTowns, setSelectedTowns] = useState<string[]>([]);
  const [utrRange, setUtrRange] = useState<[number, number]>([1, 10]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchPlayers();
  }, []);

  const fetchPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_banned', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPlayers(data || []);
    } catch (error) {
      console.error('Error fetching players:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPlayers = players.filter((player) => {
    const matchesSearch = !search ||
      player.name.toLowerCase().includes(search.toLowerCase()) ||
      player.home_town?.toLowerCase().includes(search.toLowerCase());

    const matchesSkill = selectedSkillLevels.length === 0 ||
      selectedSkillLevels.includes(player.skill_level || '');

    const matchesTown = selectedTowns.length === 0 ||
      selectedTowns.includes(player.home_town || '');

    const matchesUtr = !player.utr_rating ||
      player.utr_rating >= utrRange[0] && player.utr_rating <= utrRange[1];

    return matchesSearch && matchesSkill && matchesTown && matchesUtr;
  });

  const toggleSkill = (skill: string) => {
    setSelectedSkillLevels((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const toggleTown = (town: string) => {
    setSelectedTowns((prev) =>
      prev.includes(town) ? prev.filter((t) => t !== town) : [...prev, town]
    );
  };

  const clearFilters = () => {
    setSelectedSkillLevels([]);
    setSelectedTowns([]);
    setUtrRange([1, 10]);
    setSearch('');
  };

  const hasActiveFilters = selectedSkillLevels.length > 0 || selectedTowns.length > 0 || search || utrRange[0] !== 1 || utrRange[1] !== 10;

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHero
        eyebrow="Livingston"
        title="Player Directory"
        description="Browse the community and find hitting partners."
      />
      <div className="container-custom py-8">
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            Meet at public courts and use good judgment. Minors should involve a parent or guardian.
          </p>
        </div>

        {/* Search and Filters Bar */}
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
                  {selectedSkillLevels.length + selectedTowns.length}
                </span>
              )}
            </button>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="btn-ghost text-secondary-600">
                Clear all
              </button>
            )}
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="mt-6 pt-6 border-t border-secondary-100 space-y-6">
              {/* Skill Levels */}
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

              {/* Towns */}
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

              {/* UTR Range */}
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-3">
                  UTR Range: {utrRange[0]} - {utrRange[1]}
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="0.5"
                    value={utrRange[0]}
                    onChange={(e) => setUtrRange([parseFloat(e.target.value), utrRange[1]])}
                    className="flex-1"
                  />
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="0.5"
                    value={utrRange[1]}
                    onChange={(e) => setUtrRange([utrRange[0], parseFloat(e.target.value)])}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results Count */}
        <div className="mb-6">
          <p className="text-secondary-600">
            Showing {filteredPlayers.length} of {players.length} players
          </p>
        </div>

        {/* Grid */}
        {loading ? (
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
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPlayers.map((player) => (
              <Link key={player.id} to={`/players/${player.id}`}>
                <div className="rounded-3xl bg-white border border-secondary-200 hover:border-primary-300 transition-colors p-6 group">
                  <div className="flex items-start gap-4 mb-4">
                    {player.avatar_url ? (
                      <img
                        src={player.avatar_url}
                        alt={player.name}
                        className="w-16 h-16 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-primary-100 flex items-center justify-center">
                        <User className="w-8 h-8 text-primary-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-secondary-900 truncate group-hover:text-primary-600 transition-colors">
                        {player.name}
                      </h3>
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
                      <span className="badge bg-primary-50 text-primary-700">
                        UTR {player.utr_rating}
                      </span>
                    )}
                  </div>

                  {player.availability && player.availability.length > 0 && (
                    <div className="flex items-center gap-2 text-sm text-secondary-500">
                      <Clock className="w-4 h-4" />
                      <span>{player.availability.join(', ')}</span>
                    </div>
                  )}

                  {player.bio && (
                    <p className="text-sm text-secondary-600 mt-3 line-clamp-2">{player.bio}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {filteredPlayers.length === 0 && !loading && (
          <div className="rounded-3xl bg-white border border-secondary-200 p-12 text-center">
            <CourtCorner className="w-8 h-8 text-primary-400 mx-auto mb-4" />
            <h3 className="font-display text-lg font-bold text-secondary-900 mb-2">No players found</h3>
            <p className="text-secondary-600 mb-4">Try adjusting your filters.</p>
            <button onClick={clearFilters} className="btn-outline">Clear Filters</button>
          </div>
        )}
      </div>
    </div>
  );
}
