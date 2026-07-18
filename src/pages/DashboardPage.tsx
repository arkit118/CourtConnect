import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Users, Package, Settings, User, Check, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToastStore } from '../hooks/useToast';
import { supabase, PartnerRequest, GearListing, Registration, ImpactMetric } from '../lib/supabase';
import { format, parseISO } from 'date-fns';

export function DashboardPage() {
  const { profile, user, loading: authLoading } = useAuth();
  const { addToast } = useToastStore();
  const [upcomingEvents, setUpcomingEvents] = useState<Registration[]>([]);
  const [partnerRequests, setPartnerRequests] = useState<PartnerRequest[]>([]);
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

      // Fetch partner requests
      const { data: requests } = await supabase
        .from('partner_requests')
        .select('*, requester:profiles!partner_requests_requester_id_fkey(*)')
        .eq('recipient_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      setPartnerRequests(requests || []);

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

  const handleAcceptRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('partner_requests')
        .update({ status: 'accepted' })
        .eq('id', requestId);
      if (error) throw error;
      addToast({ type: 'success', message: 'Request accepted!' });
      fetchDashboardData();
    } catch (error: any) {
      addToast({ type: 'error', message: error.message || 'Failed to accept' });
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('partner_requests')
        .update({ status: 'declined' })
        .eq('id', requestId);
      if (error) throw error;
      addToast({ type: 'info', message: 'Request declined' });
      fetchDashboardData();
    } catch (error: any) {
      addToast({ type: 'error', message: error.message || 'Failed to decline' });
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

          <div className="card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-accent-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-accent-600" />
              </div>
              <div>
                <p className="text-sm text-secondary-500">Partners</p>
                <p className="text-2xl font-bold text-secondary-900">{partnerRequests.length}</p>
              </div>
            </div>
            <p className="text-xs text-secondary-500">pending</p>
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-secondary-500">Saved</p>
                <p className="text-2xl font-bold text-secondary-900">$--</p>
              </div>
            </div>
            <p className="text-xs text-secondary-500">this month</p>
          </div>

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

            {/* Partner Requests */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-secondary-900">Partner Requests</h2>
                <Link to="/partners" className="text-sm text-primary-600 hover:text-primary-700">View all</Link>
              </div>
              {partnerRequests.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-secondary-300 mx-auto mb-4" />
                  <p className="text-secondary-600 mb-4">No pending requests</p>
                  <Link to="/partners" className="btn-outline">Find Partners</Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {partnerRequests.map((request) => {
                    const requester = (request as any).requester;
                    return (
                      <div key={request.id} className="flex items-center gap-4 p-4 rounded-xl bg-secondary-50">
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                          <User className="w-5 h-5 text-primary-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-secondary-900 truncate">{requester?.name || 'Player'}</h3>
                          <p className="text-sm text-secondary-500 truncate">
                            {format(parseISO(request.proposed_date), 'MMM d')} at {request.proposed_time}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleAcceptRequest(request.id)} className="btn-primary btn-sm">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDeclineRequest(request.id)} className="btn-ghost btn-sm text-red-600">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
                  <span className="text-secondary-600">Partner Requests</span>
                  <span className="font-semibold text-secondary-900">{partnerRequests.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-secondary-600">Active Listings</span>
                  <span className="font-semibold text-secondary-900">{myListings.length}</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-secondary-100">
                <p className="text-xs text-secondary-500 text-center">
                  Livingston pilot - more towns coming soon!
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export function ImpactDashboardPage() {
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      const { data } = await supabase
        .from('impact_metrics')
        .select('*');
      if (data && data.length > 0) {
        const metricMap = data.reduce((acc, m) => {
          acc[m.metric_type] = m.value;
          return acc;
        }, {} as Record<string, number>);
        setMetrics(metricMap);
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasMetrics = Object.keys(metrics).length > 0;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container-custom">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-secondary-900 mb-2">Community Impact</h1>
          <p className="text-secondary-600">Building tennis community in Livingston, NJ</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card p-6">
                <div className="h-12 bg-secondary-200 rounded animate-pulse mb-4" />
                <div className="h-8 bg-secondary-200 rounded animate-pulse mb-2" />
                <div className="h-4 bg-secondary-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : hasMetrics ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <div className="card p-6">
              <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-primary-600" />
              </div>
              <div className="text-3xl font-bold text-secondary-900 mb-1">{metrics.players || 0}</div>
              <span className="text-sm text-secondary-500">Active Players</span>
            </div>
            <div className="card p-6">
              <div className="w-12 h-12 rounded-xl bg-accent-100 flex items-center justify-center mb-4">
                <Calendar className="w-6 h-6 text-accent-600" />
              </div>
              <div className="text-3xl font-bold text-secondary-900 mb-1">{metrics.events || 0}</div>
              <span className="text-sm text-secondary-500">Events Hosted</span>
            </div>
            <div className="card p-6">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mb-4">
                <User className="w-6 h-6 text-blue-600" />
              </div>
              <div className="text-3xl font-bold text-secondary-900 mb-1">${Math.round((metrics.savings || 0) / 1000)}K</div>
              <span className="text-sm text-secondary-500">Player Savings</span>
            </div>
            <div className="card p-6">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center mb-4">
                <Package className="w-6 h-6 text-green-600" />
              </div>
              <div className="text-3xl font-bold text-secondary-900 mb-1">{metrics.gear_exchanges || 0}</div>
              <span className="text-sm text-secondary-500">Gear Exchanges</span>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 mb-12">
            <div className="inline-flex items-center gap-2 px-6 py-4 rounded-2xl bg-primary-50 border border-primary-100">
              <span className="w-3 h-3 rounded-full bg-primary-400 animate-pulse" />
              <span className="text-lg font-medium text-primary-700">Pilot launching soon</span>
            </div>
            <p className="text-secondary-600 mt-4">Impact metrics will appear as our Livingston community grows.</p>
          </div>
        )}

        {/* Mission */}
        <div className="card p-8 bg-gradient-to-br from-primary-600 to-primary-800 text-white">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Our Mission</h2>
            <p className="text-primary-100 mb-6 text-lg">
              CourtConnect makes competitive tennis accessible and affordable.
              Starting in Livingston, we're building a community where everyone can play.
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
