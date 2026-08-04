import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MapPin, Lightbulb, ExternalLink, Search, AlertCircle, Info } from 'lucide-react';
import { supabase, Court } from '../lib/supabase';
import { withTimeout } from '../lib/withTimeout';
import { PageHero } from '../components/brand/PageHero';
import { CourtCorner } from '../components/brand/CourtMotif';

const surfaceLabels: Record<string, string> = {
  hard: 'Hard',
  clay: 'Clay',
  grass: 'Grass',
  synthetic: 'Synthetic',
  carpet: 'Carpet',
  other: 'Other',
};

const surfaceColors: Record<string, string> = {
  hard: 'bg-navy-50 text-navy-700 border-navy-200',
  clay: 'bg-clay-400/10 text-clay-600 border-clay-400/30',
  grass: 'bg-primary-50 text-primary-700 border-primary-200',
  synthetic: 'bg-secondary-100 text-secondary-700 border-secondary-200',
  carpet: 'bg-secondary-100 text-secondary-700 border-secondary-200',
  other: 'bg-gray-50 text-gray-700 border-gray-200',
};

const towns = ['Livingston']; // Pilot launch - more towns coming soon
const surfaces = ['hard', 'clay', 'grass', 'synthetic', 'carpet', 'other'];

// Same visual pattern as GearPage's notice banner. Added because user
// feedback found the court count ("6 courts") read as "6 courts currently
// available" rather than "6 total courts at this facility" - CourtConnect
// has no real-time occupancy data at all, so this makes that explicit
// rather than relying on card copy alone.
function CourtsNoticeBanner() {
  return (
    <div className="flex items-start gap-3 bg-clay-400/10 border border-clay-400/30 rounded-xl p-4 mb-6">
      <Info className="w-5 h-5 text-clay-600 shrink-0 mt-0.5" />
      <p className="text-sm text-secondary-700">
        Court counts below show total courts at each location, not live availability. CourtConnect does not track
        whether a court is currently in use - scheduling here is for community coordination only, not an official
        reservation.
      </p>
    </div>
  );
}

export function CourtsPage() {
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedTown, setSelectedTown] = useState('');
  const [selectedSurface, setSelectedSurface] = useState('');
  const [hasLights, setHasLights] = useState<boolean | null>(null);
  useEffect(() => {
    fetchCourts();
  }, []);

  const fetchCourts = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await withTimeout(
        supabase.from('courts').select('*').order('name', { ascending: true }),
        15000,
        'Loading courts timed out. Please check your connection and try again.'
      );

      if (error) throw error;
      setCourts(data || []);
    } catch (err: any) {
      console.error('Error fetching courts:', err);
      setError(err.message || 'Failed to load courts');
    } finally {
      setLoading(false);
    }
  };

  const filteredCourts = courts.filter((court) => {
    const matchesSearch = !search ||
      court.name.toLowerCase().includes(search.toLowerCase()) ||
      court.address.toLowerCase().includes(search.toLowerCase());

    const matchesTown = !selectedTown || court.town === selectedTown;
    const matchesSurface = !selectedSurface || court.surface_type === selectedSurface;
    const matchesLights = hasLights === null || court.has_lights === hasLights;

    return matchesSearch && matchesTown && matchesSurface && matchesLights;
  });

  const hasFilters = search || selectedTown || selectedSurface || hasLights !== null;

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHero
        eyebrow="Livingston"
        title="Tennis Courts"
        description="Known court locations in the CourtConnect community. Not a live availability tracker."
      />
      <div className="container-custom py-8">
        <CourtsNoticeBanner />

        {/* Filters */}
        <div className="card p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search courts..."
                className="input pl-10"
              />
            </div>
            <select
              value={selectedTown}
              onChange={(e) => setSelectedTown(e.target.value)}
              className="input w-auto"
            >
              <option value="">All Towns</option>
              {towns.map((town) => (
                <option key={town} value={town}>{town}</option>
              ))}
            </select>
            <select
              value={selectedSurface}
              onChange={(e) => setSelectedSurface(e.target.value)}
              className="input w-auto"
            >
              <option value="">All Surfaces</option>
              {surfaces.map((surface) => (
                <option key={surface} value={surface}>{surfaceLabels[surface]}</option>
              ))}
            </select>
            <select
              value={hasLights === null ? '' : hasLights ? 'yes' : 'no'}
              onChange={(e) => setHasLights(e.target.value === '' ? null : e.target.value === 'yes')}
              className="input w-auto"
            >
              <option value="">All lighting</option>
              <option value="yes">Has lights</option>
              <option value="no">No lights</option>
            </select>
          </div>
        </div>

        {/* Results count */}
        {!loading && !error && (
          <div className="mb-6">
            <p className="text-secondary-600">{filteredCourts.length} court{filteredCourts.length !== 1 ? 's' : ''} found</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-red-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-secondary-900 mb-2">Error loading courts: {error}</h3>
          </div>
        )}

        {/* Loading State */}
        {loading && !error && (
          <div>
            <p className="text-secondary-600 mb-4">Loading courts...</p>
            <div className="grid md:grid-cols-2 gap-6">
              {[...Array(4)].map((_, i) => (
              <div key={i} className="card p-6">
                <div className="animate-pulse">
                  <div className="h-6 bg-secondary-200 rounded w-3/4 mb-4" />
                  <div className="h-4 bg-secondary-200 rounded w-1/2 mb-2" />
                  <div className="h-4 bg-secondary-200 rounded w-1/4" />
                </div>
              </div>
            ))}
            </div>
          </div>
        )}

        {/* Empty State - No courts in database */}
        {!loading && !error && courts.length === 0 && (
          <div className="text-center py-12">
            <MapPin className="w-12 h-12 text-secondary-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-secondary-900 mb-2">No courts returned from Supabase.</h3>
          </div>
        )}

        {/* Empty State - No matches for filters */}
        {!loading && !error && courts.length > 0 && filteredCourts.length === 0 && (
          <div className="text-center py-12">
            <MapPin className="w-12 h-12 text-secondary-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-secondary-900 mb-2">No courts found</h3>
            <p className="text-secondary-600 mb-4">Try adjusting your filters</p>
            {hasFilters && (
              <button
                onClick={() => {
                  setSearch('');
                  setSelectedTown('');
                  setSelectedSurface('');
                  setHasLights(null);
                }}
                className="btn-outline"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}

        {/* Court Cards Grid */}
        {!loading && !error && filteredCourts.length > 0 && (
          <div className="grid md:grid-cols-2 gap-6">
            {filteredCourts.map((court) => (
              <div key={court.id} className="relative rounded-3xl bg-white border border-secondary-200 hover:border-primary-300 transition-colors p-6">
                <CourtCorner className="absolute top-5 right-5 w-6 h-6 text-secondary-200" />
                <div className="flex items-start justify-between mb-4 pr-8">
                  <div>
                    <h3 className="font-display text-lg font-bold text-secondary-900">{court.name}</h3>
                    <div className="flex items-center gap-1 text-sm text-secondary-500 mt-1">
                      <MapPin className="w-4 h-4" />
                      <span>{court.town}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {court.surface_type && (
                      <span className={`badge px-2 py-0.5 rounded-full text-xs font-medium border ${surfaceColors[court.surface_type] || surfaceColors.other}`}>
                        {surfaceLabels[court.surface_type] || court.surface_type}
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-sm text-secondary-600 mb-4">{court.address}</p>

                <div className="flex flex-wrap items-center gap-4 text-sm text-secondary-600 mb-4">
                  <span className="font-semibold text-secondary-900">
                    {court.num_courts} total court{court.num_courts !== 1 ? 's' : ''} at this location
                  </span>
                  {court.has_lights && (
                    <div className="flex items-center gap-1 text-accent-600">
                      <Lightbulb className="w-4 h-4" />
                      <span>Lights</span>
                    </div>
                  )}
                </div>

                {court.description && (
                  <p className="text-sm text-secondary-500 mb-4">{court.description}</p>
                )}

                {court.booking_url && (
                  <a
                    href={court.booking_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-outline btn-sm w-full"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Book a Court
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function CourtDetailPage() {
  const { id } = useParams();
  const [court, setCourt] = useState<Court | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) fetchCourt();
  }, [id]);

  const fetchCourt = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await withTimeout(
        supabase.from('courts').select('*').eq('id', id).single(),
        15000,
        'Loading court details timed out. Please try again.'
      );

      if (fetchError) throw fetchError;
      setCourt(data);
    } catch (err: any) {
      console.error('Error fetching court:', err);
      setError(err.message || 'Failed to load court');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-secondary-900 mb-4">Failed to load court</h2>
          <p className="text-secondary-600 mb-4">{error}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={fetchCourt} className="btn-primary">Try Again</button>
            <Link to="/courts" className="btn-outline">Browse Courts</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!court) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <div className="text-center">
          <MapPin className="w-12 h-12 text-secondary-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-secondary-900 mb-4">Court not found</h2>
          <Link to="/courts" className="btn-primary">Browse Courts</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container-custom max-w-3xl">
        <div className="card p-6 md:p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-secondary-900 mb-2">{court.name}</h1>
              <p className="text-secondary-600">{court.address}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {court.surface_type && (
                <span className={`badge px-3 py-1 rounded-full text-sm font-medium border ${surfaceColors[court.surface_type] || surfaceColors.other}`}>
                  {surfaceLabels[court.surface_type] || court.surface_type}
                </span>
              )}
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            <div className="p-4 rounded-xl bg-secondary-50">
              <div className="text-2xl font-bold text-secondary-900">{court.num_courts}</div>
              <div className="text-sm text-secondary-500">Total Courts</div>
            </div>
            <div className="p-4 rounded-xl bg-secondary-50">
              <div className="text-2xl font-bold text-secondary-900">{court.surface_type ? (surfaceLabels[court.surface_type] || court.surface_type) : 'N/A'}</div>
              <div className="text-sm text-secondary-500">Surface</div>
            </div>
            <div className="p-4 rounded-xl bg-secondary-50">
              <div className="text-2xl font-bold text-secondary-900">{court.has_lights ? 'Yes' : 'No'}</div>
              <div className="text-sm text-secondary-500">Lights</div>
            </div>
          </div>

          {court.description && (
            <div className="mb-6">
              <h2 className="font-semibold text-secondary-900 mb-2">About</h2>
              <p className="text-secondary-600">{court.description}</p>
            </div>
          )}

          {court.booking_url && (
            <a
              href={court.booking_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary w-full"
            >
              <ExternalLink className="w-5 h-5" />
              Book a Court
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
