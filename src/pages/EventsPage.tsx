import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Users, DollarSign, Clock, ChevronRight, Check, Info } from 'lucide-react';
import { format, parseISO, isBefore } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { useToastStore } from '../hooks/useToast';
import { useActionGate } from '../hooks/useActionGate';
import { supabase, Event, Profile, Registration } from '../lib/supabase';
import { ReportButton } from '../components/ReportButton';
import { withTimeout } from '../lib/withTimeout';
import { PageHero } from '../components/brand/PageHero';
import { CourtCorner } from '../components/brand/CourtMotif';

function EventsNoticeBanner() {
  return (
    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
      <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
      <p className="text-sm text-amber-800">
        Event details may change. Please follow posted rules and organizer instructions.
      </p>
    </div>
  );
}

const eventStatusColors: Record<string, string> = {
  open: 'bg-green-50 text-green-700 border-green-200',
  full: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  completed: 'bg-blue-50 text-blue-700 border-blue-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
};

const defaultImage = 'https://images.pexels.com/photos/3133638/pexels-photo-3133638.jpeg?auto=compress&cs=tinysrgb&w=800';

const towns = ['Livingston']; // Pilot launch - more towns coming soon

export function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedTown, setSelectedTown] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('events')
          .select('*, organizer:profiles!events_organizer_id_fkey(*)')
          .order('date', { ascending: true }),
        15000,
        'Loading events timed out. Please check your connection and try again.'
      );

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = events.filter((event) => {
    const matchesSearch = !search ||
      event.title.toLowerCase().includes(search.toLowerCase()) ||
      event.venue.toLowerCase().includes(search.toLowerCase());

    const matchesTown = !selectedTown || event.town === selectedTown;
    const matchesStatus = !selectedStatus || event.status === selectedStatus;

    return matchesSearch && matchesTown && matchesStatus;
  });

  // Sort by date
  const sortedEvents = [...filteredEvents].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHero
        eyebrow="Community events"
        title="Events & Tournaments"
        description="Find and register for local tennis events."
      >
        <Link to="/events/create" className="btn btn-lg bg-white text-primary-700 hover:bg-primary-50 font-semibold mt-6 inline-flex">
          Create Event
        </Link>
      </PageHero>
      <div className="container-custom py-8">
        <EventsNoticeBanner />

        {/* Search and Filters */}
        <div className="card p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search events..."
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
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="input w-auto"
            >
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="full">Full</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Events Grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card overflow-hidden">
                <div className="aspect-video bg-secondary-200 animate-pulse" />
                <div className="p-6">
                  <div className="h-4 bg-secondary-200 rounded w-24 mb-4 animate-pulse" />
                  <div className="h-6 bg-secondary-200 rounded w-full mb-4 animate-pulse" />
                  <div className="h-4 bg-secondary-200 rounded w-3/4 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : sortedEvents.length === 0 ? (
          <div className="rounded-3xl bg-white border border-secondary-200 bg-felt-texture p-12 text-center">
            <CourtCorner className="w-8 h-8 text-primary-400 mx-auto mb-4" />
            <h3 className="font-display text-lg font-bold text-secondary-900 mb-2">Nothing on the board yet</h3>
            <p className="text-secondary-600 mb-4">Try adjusting your filters, or check back later.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedEvents.map((event) => (
              <Link key={event.id} to={`/events/${event.id}`}>
                <div className="rounded-3xl overflow-hidden bg-white border border-secondary-200 hover:border-primary-300 transition-colors group">
                  <div className="aspect-video overflow-hidden relative">
                    <img
                      src={event.image_url || defaultImage}
                      alt={event.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-4 left-4">
                      <span className={`badge px-2 py-0.5 rounded-full text-xs font-medium border ${eventStatusColors[event.status]}`}>
                        {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                      </span>
                    </div>
                    <div className="absolute bottom-4 left-4">
                      <span className="bg-white/90 backdrop-blur px-3 py-1 rounded-lg text-sm font-semibold text-secondary-900">
                        {format(parseISO(event.date), 'MMM d')}
                      </span>
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-secondary-900 mb-2 group-hover:text-primary-600 transition-colors">
                      {event.title}
                    </h3>
                    <div className="space-y-2 text-sm text-secondary-600 mb-4">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-secondary-400" />
                        <span>{event.venue}, {event.town}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-secondary-400" />
                        <span>{event.start_time} - {event.end_time}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4 text-secondary-400" />
                          <span>{event.registration_count}/{event.capacity}</span>
                        </div>
                        <span className={event.entry_fee === 0 ? 'text-green-600 font-medium' : 'text-secondary-600'}>
                          {event.entry_fee === 0 ? 'Free' : `$${event.entry_fee}`}
                        </span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-secondary-300 group-hover:text-primary-500 group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function EventDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { addToast } = useToastStore();
  const canProceed = useActionGate();
  const [event, setEvent] = useState<Event | null>(null);
  const [organizer, setOrganizer] = useState<Profile | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);

  useEffect(() => {
    if (id) {
      fetchEvent();
    }
  }, [id, user?.id]);

  const fetchEvent = async () => {
    try {
      // Fetch event
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single();

      if (eventError) throw eventError;
      setEvent(eventData);

      // Fetch organizer
      if (eventData.organizer_id) {
        const { data: orgData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', eventData.organizer_id)
          .single();
        setOrganizer(orgData);
      }

      // Fetch registrations
      const { data: regData } = await supabase
        .from('registrations')
        .select('*, profile:profiles(*)')
        .eq('event_id', id);

      setRegistrations(regData || []);

      // Check if current user is registered
      if (user && regData) {
        const userReg = regData.find((r: any) => r.user_id === user.id);
        setIsRegistered(!!userReg);
      } else {
        setIsRegistered(false);
      }
    } catch (error: any) {
      console.error('Error fetching event:', error);
      addToast({ type: 'error', message: error.message || 'Failed to load event' });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!isAuthenticated) {
      navigate('/auth/login', { state: { from: { pathname: `/events/${id}` } } });
      return;
    }
    setShowRegisterModal(true);
  };

  const confirmRegistration = async () => {
    if (!event || !user) return;
    if (!(await canProceed())) return;
    setRegistering(true);

    try {
      // Double-check user isn't already registered
      const { data: existingReg } = await supabase
        .from('registrations')
        .select('id')
        .eq('event_id', event.id)
        .eq('user_id', user.id)
        .single();

      if (existingReg) {
        setIsRegistered(true);
        setShowRegisterModal(false);
        addToast({ type: 'info', message: 'You are already registered for this event' });
        return;
      }

      const { error } = await supabase
        .from('registrations')
        .insert({
          event_id: event.id,
          user_id: user.id,
          status: 'registered',
          payment_status: event.entry_fee === 0 ? 'free' : 'pending',
        });

      if (error) {
        if (error.code === '23505') {
          setIsRegistered(true);
          setShowRegisterModal(false);
          addToast({ type: 'info', message: 'You are already registered for this event' });
          return;
        }
        throw error;
      }

      // Update registration count
      await supabase
        .from('events')
        .update({ registration_count: (event.registration_count || 0) + 1 })
        .eq('id', event.id);

      setIsRegistered(true);
      setShowRegisterModal(false);
      addToast({ type: 'success', message: 'Successfully registered!' });
      fetchEvent();
    } catch (error: any) {
      console.error('Registration error:', error);
      addToast({ type: 'error', message: error.message || 'Failed to register. Please try again.' });
    } finally {
      setRegistering(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container-custom">
          <div className="animate-pulse">
            <div className="h-64 bg-secondary-200 rounded-2xl mb-6" />
            <div className="h-8 bg-secondary-200 rounded w-1/2 mb-4" />
            <div className="h-4 bg-secondary-200 rounded w-1/4" />
          </div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-secondary-900 mb-4">Event not found</h2>
          <Link to="/events" className="btn-primary">Browse Events</Link>
        </div>
      </div>
    );
  }

  const spotsLeft = event.capacity - (event.registration_count || 0);
  const isPast = isBefore(parseISO(event.date), new Date());
  const isFull = event.status === 'full' || spotsLeft <= 0;
  const canRegister = event.status === 'open' && !isFull && !isPast && !isRegistered;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="relative h-64 md:h-80 overflow-hidden">
        <img
          src={event.image_url || defaultImage}
          alt={event.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-secondary-900/80 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
          <div className="container-custom">
            <div className="flex items-center gap-3 mb-4">
              <span className={`badge px-3 py-1 rounded-full text-sm font-medium border ${eventStatusColors[event.status]}`}>
                {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
              </span>
              <span className="text-white/80 text-sm">
                {format(parseISO(event.date), 'EEEE, MMMM d, yyyy')}
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{event.title}</h1>
            <div className="flex items-center gap-2 text-white/80">
              <MapPin className="w-4 h-4" />
              <span>{event.venue}, {event.town}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="container-custom py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-secondary-900 mb-4">About This Event</h2>
              <p className="text-secondary-600 leading-relaxed">{event.description || 'No description provided.'}</p>
            </div>

            {/* Details */}
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-secondary-900 mb-4">Event Details</h2>
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-sm text-secondary-500">Date</p>
                    <p className="font-medium text-secondary-900">{format(parseISO(event.date), 'MMMM d, yyyy')}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-sm text-secondary-500">Time</p>
                    <p className="font-medium text-secondary-900">{event.start_time} - {event.end_time}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-sm text-secondary-500">Location</p>
                    <p className="font-medium text-secondary-900">{event.venue}</p>
                    <p className="text-sm text-secondary-500">{event.address}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-sm text-secondary-500">Entry Fee</p>
                    <p className="font-medium text-secondary-900">
                      {event.entry_fee === 0 ? 'Free' : `$${event.entry_fee}`}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Rules */}
            {event.rules && (
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-secondary-900 mb-4">Rules & Format</h2>
                <p className="text-secondary-600 whitespace-pre-line">{event.rules}</p>
              </div>
            )}

            {/* FAQ */}
            {event.faq && (
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-secondary-900 mb-4">FAQ</h2>
                <p className="text-secondary-600 whitespace-pre-line">{event.faq}</p>
              </div>
            )}

            {/* Participants */}
            {registrations.length > 0 && (
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-secondary-900 mb-4">Registered Players ({registrations.length})</h2>
                <div className="flex flex-wrap gap-2">
                  {registrations.slice(0, 10).map((reg) => (
                    <Link
                      key={reg.id}
                      to={`/players/${reg.user_id}`}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary-50 hover:bg-secondary-100 text-sm"
                    >
                      {(reg.profile as any)?.name || 'Player'}
                    </Link>
                  ))}
                  {registrations.length > 10 && (
                    <span className="px-3 py-1.5 text-sm text-secondary-500">
                      +{registrations.length - 10} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="card p-6 sticky top-24">
              {/* Capacity */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-secondary-600">Registration</span>
                  <span className="font-semibold text-secondary-900">
                    {event.registration_count || 0} / {event.capacity}
                  </span>
                </div>
                <div className="h-2 bg-secondary-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-500 rounded-full transition-all"
                    style={{ width: `${((event.registration_count || 0) / event.capacity) * 100}%` }}
                  />
                </div>
                <p className="text-sm text-secondary-500 mt-2">
                  {spotsLeft} spots left
                </p>
              </div>

              {/* Registration Button */}
              {isRegistered ? (
                <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-green-50 text-green-700 mb-4">
                  <Check className="w-5 h-5" />
                  <span className="font-medium">You're Registered!</span>
                </div>
              ) : canRegister ? (
                <button onClick={handleRegister} className="btn-primary w-full mb-4">
                  {event.entry_fee === 0 ? 'Register Now (Free)' : `Register Now - $${event.entry_fee}`}
                </button>
              ) : event.status === 'full' || spotsLeft <= 0 ? (
                <button disabled className="btn w-full bg-secondary-200 text-secondary-500 cursor-not-allowed mb-4">
                  Event Full
                </button>
              ) : isPast ? (
                <button disabled className="btn w-full bg-secondary-200 text-secondary-500 cursor-not-allowed mb-4">
                  Event Passed
                </button>
              ) : event.status === 'cancelled' ? (
                <button disabled className="btn w-full bg-red-100 text-red-500 cursor-not-allowed mb-4">
                  Event Cancelled
                </button>
              ) : null}

              {event.entry_fee > 0 && !isRegistered && (
                <p className="text-xs text-secondary-500 text-center mb-4">Payment collected in person at the event</p>
              )}

              {/* Organizer */}
              {organizer && (
                <div className="pt-4 border-t border-secondary-100">
                  <p className="text-sm text-secondary-500 mb-3">Organized by</p>
                  <Link to={`/players/${organizer.id}`} className="flex items-center gap-3 hover:bg-secondary-50 rounded-lg p-2 -mx-2">
                    <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                      <span className="text-primary-600 font-semibold">{organizer.name[0]}</span>
                    </div>
                    <div>
                      <p className="font-medium text-secondary-900">{organizer.name}</p>
                      <p className="text-sm text-secondary-500">{organizer.home_town}</p>
                    </div>
                  </Link>
                </div>
              )}

              <div className="pt-4 border-t border-secondary-100 mt-4 flex justify-end">
                <ReportButton reportType="event" targetId={event.id} reportedUserId={event.organizer_id || undefined} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Registration Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowRegisterModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-elevated p-6 w-full max-w-md animate-scale-in">
            <h3 className="text-xl font-bold text-secondary-900 mb-2">Confirm Registration</h3>
            <p className="text-secondary-600 mb-6">
              You're about to register for <strong>{event.title}</strong>
            </p>

            <div className="bg-secondary-50 rounded-xl p-4 mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-secondary-600">Event fee</span>
                <span className="font-medium">{event.entry_fee === 0 ? 'Free' : `$${event.entry_fee}`}</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-secondary-600">Date</span>
                <span className="font-medium">{format(parseISO(event.date), 'MMM d, yyyy')}</span>
              </div>
              {event.entry_fee > 0 && (
                <div className="mt-3 pt-3 border-t border-secondary-200">
                  <p className="text-xs text-secondary-500 text-center">Payment collected in person at the event</p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowRegisterModal(false)} className="btn-ghost flex-1">
                Cancel
              </button>
              <button onClick={confirmRegistration} className="btn-primary flex-1" disabled={registering}>
                {registering ? 'Registering...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
