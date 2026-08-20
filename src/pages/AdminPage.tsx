import { useState, useEffect } from 'react';
import { Users, Calendar, Package, Flag, BarChart3, Settings, AlertTriangle, Check, X, Search } from 'lucide-react';
import { supabase, Profile, Event, GearListing, Comment } from '../lib/supabase';
import { withTimeout } from '../lib/withTimeout';
import { useToastStore } from '../hooks/useToast';

const tabs = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'events', label: 'Events', icon: Calendar },
  { id: 'listings', label: 'Listings', icon: Package },
  { id: 'moderation', label: 'Moderation', icon: Flag },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function AdminPage() {
  const { addToast } = useToastStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [search, setSearch] = useState('');

  // Data states
  const [users, setUsers] = useState<Profile[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [listings, setListings] = useState<GearListing[]>([]);
  const [flaggedComments, setFlaggedComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [usersRes, eventsRes, listingsRes, commentsRes] = await withTimeout(
        Promise.all([
          supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(50),
          supabase.from('events').select('*').order('created_at', { ascending: false }).limit(50),
          supabase.from('gear_listings').select('*').order('created_at', { ascending: false }).limit(50),
          supabase.from('comments').select('*, profile:profiles(*)').eq('is_flagged', true),
        ]),
        15000,
        'Loading admin data timed out. Please try refreshing.'
      );

      setUsers(usersRes.data || []);
      setEvents(eventsRes.data || []);
      setListings(listingsRes.data || []);
      setFlaggedComments(commentsRes.data || []);
    } catch (error) {
      console.error('Error fetching admin data:', error);
      addToast({ type: 'error', message: 'Failed to load admin data' });
    } finally {
      setLoading(false);
    }
  };

  const handleApproveComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('comments')
        .update({ is_flagged: false })
        .eq('id', commentId);

      if (error) throw error;
      addToast({ type: 'success', message: 'Comment approved' });
      fetchAllData();
    } catch (error: any) {
      addToast({ type: 'error', message: error.message || 'Failed to approve' });
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;
      addToast({ type: 'info', message: 'Comment deleted' });
      fetchAllData();
    } catch (error: any) {
      addToast({ type: 'error', message: error.message || 'Failed to delete' });
    }
  };

  const handleDeactivateListing = async (listingId: string) => {
    try {
      const { error } = await supabase
        .from('gear_listings')
        .update({ is_active: false })
        .eq('id', listingId);

      if (error) throw error;
      addToast({ type: 'info', message: 'Listing deactivated' });
      fetchAllData();
    } catch (error: any) {
      addToast({ type: 'error', message: error.message || 'Failed to deactivate' });
    }
  };

  const stats = [
    { label: 'Total Users', value: users.length, change: '' },
    { label: 'Active Events', value: events.filter(e => e.status === 'open').length, change: '' },
    { label: 'Open Listings', value: listings.filter(l => l.is_active).length, change: '' },
    { label: 'Flagged Content', value: flaggedComments.length, change: '' },
  ];

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.home_town?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container-custom">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-secondary-900 mb-2">Admin Dashboard</h1>
          <p className="text-secondary-600">Manage users, events, and content</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <div className="lg:w-64 flex-shrink-0">
            <div className="card overflow-hidden">
              <nav className="divide-y divide-secondary-100">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm transition-colors ${
                        activeTab === tab.id
                          ? 'bg-primary-50 text-primary-600 font-medium'
                          : 'text-secondary-600 hover:bg-secondary-50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {loading ? (
              <div className="card p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
                <p className="text-secondary-600">Loading admin data...</p>
              </div>
            ) : activeTab === 'overview' ? (
              <div className="space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {stats.map((stat) => (
                    <div key={stat.label} className="card p-5">
                      <p className="text-sm text-secondary-500 mb-1">{stat.label}</p>
                      <div className="flex items-end gap-2">
                        <span className="text-2xl font-bold text-secondary-900">{stat.value}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Recent Activity */}
                <div className="card p-6">
                  <h2 className="text-lg font-semibold text-secondary-900 mb-4">Recent Activity</h2>
                  <div className="space-y-3">
                    {users.slice(0, 3).map((u) => (
                      <div key={u.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary-50">
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                          <span className="text-xs font-medium text-primary-600">{u.name[0]}</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-secondary-900">{u.name} joined the community</p>
                          <p className="text-xs text-secondary-500">{u.home_town || 'Unknown location'}</p>
                        </div>
                      </div>
                    ))}
                    {events.slice(0, 2).map((e) => (
                      <div key={e.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary-50">
                        <div className="w-8 h-8 rounded-full bg-accent-100 flex items-center justify-center">
                          <Calendar className="w-4 h-4 text-accent-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-secondary-900">Event created: {e.title}</p>
                          <p className="text-xs text-secondary-500">{e.town}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : activeTab === 'users' ? (
              <div className="card overflow-hidden">
                <div className="p-4 border-b border-secondary-100">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search users..."
                      className="input pl-10"
                    />
                  </div>
                </div>
                {filteredUsers.length === 0 ? (
                  <div className="p-8 text-center">
                    <Users className="w-12 h-12 text-secondary-300 mx-auto mb-4" />
                    <p className="text-secondary-600">No users found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-secondary-50">
                        <tr>
                          <th className="text-left px-4 py-3 text-sm font-medium text-secondary-600">User</th>
                          <th className="text-left px-4 py-3 text-sm font-medium text-secondary-600">Town</th>
                          <th className="text-left px-4 py-3 text-sm font-medium text-secondary-600">Level</th>
                          <th className="text-left px-4 py-3 text-sm font-medium text-secondary-600">UTR</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-secondary-100">
                        {filteredUsers.map((user) => (
                          <tr key={user.id} className="hover:bg-secondary-50">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                                  <span className="text-xs font-medium text-primary-600">{user.name[0]}</span>
                                </div>
                                <span className="font-medium text-secondary-900">{user.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-secondary-600">{user.home_town || '-'}</td>
                            <td className="px-4 py-3">
                              <span className="badge bg-secondary-100 text-secondary-600">
                                {user.skill_level || 'N/A'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-secondary-600">{user.utr_rating || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : activeTab === 'events' ? (
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-secondary-900 mb-4">All Events ({events.length})</h2>
                {events.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="w-12 h-12 text-secondary-300 mx-auto mb-4" />
                    <p className="text-secondary-600">No events yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {events.map((event) => (
                      <div key={event.id} className="flex items-center justify-between p-4 rounded-lg bg-secondary-50">
                        <div>
                          <h3 className="font-medium text-secondary-900">{event.title}</h3>
                          <p className="text-sm text-secondary-500">{event.town} | {event.status}</p>
                        </div>
                        <div className="text-sm text-secondary-600">
                          {event.registration_count || 0}/{event.capacity} registered
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : activeTab === 'listings' ? (
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-secondary-900 mb-4">All Listings ({listings.length})</h2>
                {listings.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="w-12 h-12 text-secondary-300 mx-auto mb-4" />
                    <p className="text-secondary-600">No listings yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {listings.map((listing) => (
                      <div key={listing.id} className="flex items-center justify-between p-4 rounded-lg bg-secondary-50">
                        <div>
                          <h3 className="font-medium text-secondary-900">{listing.title}</h3>
                          <p className="text-sm text-secondary-500">${listing.price} | {listing.town || 'No town'}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`badge ${listing.is_active ? 'badge-success' : 'bg-red-100 text-red-700'}`}>
                            {listing.is_active ? 'Active' : 'Inactive'}
                          </span>
                          {listing.is_active && (
                            <button
                              onClick={() => handleDeactivateListing(listing.id)}
                              className="text-sm text-red-600 hover:text-red-700"
                            >
                              Deactivate
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : activeTab === 'moderation' ? (
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-secondary-900 mb-4">Flagged Content</h2>
                {flaggedComments.length === 0 ? (
                  <div className="text-center py-8">
                    <Flag className="w-12 h-12 text-secondary-300 mx-auto mb-4" />
                    <p className="text-secondary-600 mb-4">No flagged content to review</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {flaggedComments.map((comment) => (
                      <div key={comment.id} className="p-4 rounded-xl border border-yellow-200 bg-yellow-50">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <AlertTriangle className="w-4 h-4 text-yellow-600" />
                              <span className="text-sm font-medium text-yellow-800">
                                Comment by {(comment.profile as any)?.name || 'Unknown'}
                              </span>
                            </div>
                            <p className="text-secondary-700 mb-2">{comment.content}</p>
                            <p className="text-xs text-secondary-500">
                              {comment.commentable_type === 'event' ? 'On an event' : 'On a listing'}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApproveComment(comment.id)}
                              className="btn-primary btn-sm"
                            >
                              <Check className="w-4 h-4" />
                              Approve
                            </button>
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              className="btn-ghost btn-sm text-red-600"
                            >
                              <X className="w-4 h-4" />
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-secondary-900 mb-4">Settings</h2>
                <p className="text-secondary-600">No admin settings yet. Manage users, listings, and content from the tabs above.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
