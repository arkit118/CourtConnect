import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Users, Package, Settings, User, DollarSign, Heart } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, GearListing, Registration } from '../lib/supabase';
import { format, parseISO } from 'date-fns';

export function DashboardPage() {
  const { profile, user, loading: authLoading } = useAuth();
  const [upcomingEvents, setUpcomingEvents] = useState<Registration[]>([]);
  const [myListings, setMyListings] = useState<GearListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && !authLoading) {
      fetchDashboardData();
    }
  }, [user, authLoading]);

  const fetchDashboardData = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch upcoming registrations
      const { data: regs } = await supabase
        .from('registrations')
        .select('*, event:events(*)')
        .eq('user_id', user.id)
        .eq('status', 'registered')
        .order('created_at', { ascending: false })
        .limit(5);
      setUpcomingEvents(regs || []);

      // Fetch my gear listings
      const { data: listings } = await supabase
        .from('gear_listings')
        .select('*')
        .eq('seller_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(5);
      setMyListings(listings || []);
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Show loading spinner while auth is loading
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  // Show error state
  if (error && !loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-secondary-900 mb-4">Something went wrong</h2>
          <p className="text-secondary-600 mb-4">{error}</p>
          <button onClick={fetchDashboardData} className="btn-primary">Try Again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container-custom">
        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-secondary-900 mb-2">
            Welcome back{profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}!
          </h1>
          <p className="text-secondary-600">Here's what's happening in your tennis community</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <p className="text-sm text-secondary-500">Events</p>
                <p className="text-2xl font-bold text-secondary-900">{upcomingEvents.length}</p>
              </div>
            </div>
            <p className="text-xs text-secondary-500">upcoming</p>
          </div>

          <Link to="/partners" className="card p-5 card-hover">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-accent-100 flex items-center justify-center">
                <Heart className="w-5 h-5 text-accent-600" />
              </div>
              <div>
                <p className="text-sm text-secondary-500">Partner Matching</p>
                <p className="text-base font-semibold text-secondary-900">Find a partner</p>
              </div>
            </div>
            <p className="text-xs text-secondary-500">safe, age-banded matching</p>
          </Link>

          <Link to="/gear" className="card p-5 card-hover">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-secondary-500">Gear Exchange</p>
                <p className="text-base font-semibold text-secondary-900">Buy or sell gear</p>
              </div>
            </div>
            <p className="text-xs text-secondary-500">local, no fees</p>
          </Link>

          <div className="card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-secondary-500">Listings</p>
                <p className="text-2xl font-bold text-secondary-900">{myListings.length}</p>
              </div>
            </div>
            <p className="text-xs text-secondary-500">active</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Upcoming Events */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-secondary-900">Upcoming Events</h2>
                <Link to="/events" className="text-sm text-primary-600 hover:text-primary-700">View all</Link>
              </div>
              {upcomingEvents.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-secondary-300 mx-auto mb-4" />
                  <p className="text-secondary-600 mb-4">No upcoming events</p>
                  <Link to="/events" className="btn-outline">Browse Events</Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.map((reg) => {
                    const event = reg.event as any;
                    if (!event) return null;
                    return (
                      <Link key={reg.id} to={`/events/${event.id}`} className="flex items-center gap-4 p-4 rounded-xl bg-secondary-50 hover:bg-secondary-100 transition-colors">
                        <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center">
                          <Calendar className="w-6 h-6 text-primary-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-secondary-900 truncate">{event.title}</h3>
                          <p className="text-sm text-secondary-500 truncate">
                            {event.date ? format(parseISO(event.date), 'MMM d, yyyy') : 'TBD'}
                          </p>
                        </div>
                        <span className="badge-success hidden sm:inline-flex">Registered</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Partner Matching */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-secondary-900">Partner Matching</h2>
                <Link to="/matches" className="text-sm text-primary-600 hover:text-primary-700">View my matches</Link>
              </div>
              <div className="text-center py-8">
                <Heart className="w-12 h-12 text-secondary-300 mx-auto mb-4" />
                <p className="text-secondary-600 mb-4">
                  Use Partner Matching for safe age-banded tennis partner requests.
                </p>
                <Link to="/partners" className="btn-outline">Find Partners</Link>
              </div>
            </div>

            {/* My Listings */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-secondary-900">My Listings</h2>
                <Link to="/gear/create" className="btn-outline btn-sm">Add Listing</Link>
              </div>
              {myListings.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 text-secondary-300 mx-auto mb-4" />
                  <p className="text-secondary-600 mb-4">No active listings</p>
                  <Link to="/gear/create" className="btn-primary">Create Listing</Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {myListings.map((listing) => (
                    <Link key={listing.id} to={`/gear/${listing.id}`} className="flex items-center gap-4 p-4 rounded-xl bg-secondary-50 hover:bg-secondary-100 transition-colors">
                      <div className="w-14 h-14 rounded-xl bg-secondary-200 flex items-center justify-center overflow-hidden">
                        {listing.photos?.[0] ? (
                          <img src={listing.photos[0]} alt={listing.title} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-6 h-6 text-secondary-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-secondary-900 truncate">{listing.title}</h3>
                        <p className="text-sm text-secondary-500">{listing.interested_count || 0} interested</p>
                      </div>
                      <span className="font-semibold text-primary-600">${listing.price}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-secondary-900 mb-4">Quick Actions</h2>
              <div className="space-y-2">
                <Link to="/events" className="btn-ghost w-full justify-start">
                  <Calendar className="w-4 h-4" />
                  Browse Events
                </Link>
                <Link to="/partners" className="btn-ghost w-full justify-start">
                  <Users className="w-4 h-4" />
                  Find Partners
                </Link>
                <Link to="/gear" className="btn-ghost w-full justify-start">
                  <Package className="w-4 h-4" />
                  Gear Exchange
                </Link>
                <Link to="/profile" className="btn-ghost w-full justify-start">
                  <Settings className="w-4 h-4" />
                  Edit Profile
                </Link>
              </div>
            </div>

            {/* Community Stats */}
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-secondary-900 mb-4">Community Stats</h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-secondary-600">Your Events</span>
                  <span className="font-semibold text-secondary-900">{upcomingEvents.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-secondary-600">Active Listings</span>
                  <span className="font-semibold text-secondary-900">{myListings.length}</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-secondary-100">
                <p className="text-xs text-secondary-500 text-center">
                  Livingston, NJ pilot - more towns coming soon!
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

// Launch-cleanup note: this page used to show numeric counters (Active
// Players, Events Hosted, Player Savings, Gear Exchanges) read from
// impact_metrics - a manually-edited table with no real calculation
// behind any of those numbers. Removed rather than risk showing
// unverifiable/stale traction figures; this page isn't linked from any
// nav/footer, so it's kept only as a direct-URL "about the pilot" page.
export function ImpactDashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container-custom">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-secondary-900 mb-2">Community Impact</h1>
          <p className="text-secondary-600">Building tennis community in Livingston, NJ</p>
        </div>

        <div className="text-center py-12 mb-12">
          <div className="inline-flex items-center gap-2 px-6 py-4 rounded-2xl bg-primary-50 border border-primary-100">
            <span className="w-3 h-3 rounded-full bg-primary-400 animate-pulse" />
            <span className="text-lg font-medium text-primary-700">Pilot launching soon</span>
          </div>
          <p className="text-secondary-600 mt-4">Impact metrics will appear as our Livingston, NJ community grows.</p>
        </div>

        {/* Mission */}
        <div className="card p-8 bg-gradient-to-br from-primary-600 to-primary-800 text-white">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Our Mission</h2>
            <p className="text-primary-100 mb-6 text-lg">
              CourtConnect makes competitive tennis accessible and affordable.
              Starting in Livingston, NJ, we're building a community where everyone can play.
            </p>
            <div className="flex items-center justify-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <User className="w-6 h-6" />
              </div>
              <div className="text-left">
                <p className="font-semibold">CourtConnect Team</p>
                <p className="text-sm text-primary-200">Livingston, NJ</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
