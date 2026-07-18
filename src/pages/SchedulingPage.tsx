import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, MapPin, Info, Plus, X, AlertCircle, Loader2, User, Users, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { useToastStore } from '../hooks/useToast';
import { supabase, Court, CourtBooking } from '../lib/supabase';

const matchTypes = ['Singles', 'Doubles', 'Practice', 'Hitting'] as const;

const matchTypeIcons: Record<string, typeof User> = {
  Singles: User,
  Doubles: Users,
  Practice: User,
  Hitting: User,
};

const statusColors: Record<string, string> = {
  Scheduled: 'bg-green-50 text-green-700 border-green-200',
  Cancelled: 'bg-red-50 text-red-700 border-red-200',
};

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function SchedulingPage() {
  const { user, profile, isAuthenticated } = useAuth();
  const { addToast } = useToastStore();
  const navigate = useNavigate();

  const [courts, setCourts] = useState<Court[]>([]);
  const [bookings, setBookings] = useState<CourtBooking[]>([]);
  const [loadingCourts, setLoadingCourts] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedCourtId, setSelectedCourtId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    player_name: '',
    opponent_name: '',
    match_type: 'Singles' as (typeof matchTypes)[number],
    court_number: '',
    start_time: '',
    end_time: '',
    notes: '',
  });

  const fetchBookings = async () => {
    if (!selectedCourtId || !selectedDate) return;
    setLoadingBookings(true);
    try {
      const { data, error: err } = await supabase
        .from('court_bookings')
        .select('*, court:courts(*)')
        .eq('court_id', selectedCourtId)
        .eq('booking_date', selectedDate)
        .order('start_time', { ascending: true });
      if (err) throw err;
      setBookings(data || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load bookings');
    } finally {
      setLoadingBookings(false);
    }
  };

  // Fetch courts directly in useEffect — no dependency on auth/profile
  useEffect(() => {
    fetchCourts();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchCourts = async () => {
    setLoadingCourts(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('courts')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setCourts(data || []);
      if (data && data.length > 0 && !selectedCourtId) {
        setSelectedCourtId(data[0].id);
      }
    } catch (err: any) {
      console.error('Error fetching courts:', err);
      setError(err.message || 'Failed to load courts');
    } finally {
      setLoadingCourts(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [selectedCourtId, selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Prefill player name from profile
  useEffect(() => {
    if (profile?.name && !form.player_name) {
      setForm((f) => ({ ...f, player_name: profile.name }));
    }
  }, [profile]);

  const handleOpenForm = () => {
    if (!isAuthenticated) {
      navigate('/auth/login', { state: { from: { pathname: '/schedule' } } });
      return;
    }
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('/auth/login', { state: { from: { pathname: '/schedule' } } });
      return;
    }
    if (!selectedCourtId) {
      addToast({ type: 'error', message: 'Please select a court' });
      return;
    }
    if (!form.start_time || !form.end_time) {
      addToast({ type: 'error', message: 'Please select start and end times' });
      return;
    }
    if (toMinutes(form.end_time) <= toMinutes(form.start_time)) {
      addToast({ type: 'error', message: 'End time must be after start time' });
      return;
    }

    setSubmitting(true);
    try {
      // Check for overlapping bookings
      const { data: existing, error: fetchErr } = await supabase
        .from('court_bookings')
        .select('start_time, end_time, court_number')
        .eq('court_id', selectedCourtId)
        .eq('booking_date', selectedDate)
        .eq('status', 'Scheduled');

      if (fetchErr) throw fetchErr;

      const courtNumber = form.court_number.trim() || null;
      const newStart = toMinutes(form.start_time);
      const newEnd = toMinutes(form.end_time);

      const conflict = (existing || []).some((b: any) => {
        // If both specify a court_number, only conflict if same number.
        // If either is null/empty, treat as same court (conflict possible).
        if (courtNumber && b.court_number && b.court_number !== courtNumber) {
          return false;
        }
        const exStart = toMinutes(b.start_time);
        const exEnd = toMinutes(b.end_time);
        return exStart < newEnd && exEnd > newStart;
      });

      if (conflict) {
        addToast({
          type: 'error',
          message: 'That time slot is already scheduled. Please choose another time.',
        });
        return;
      }

      const { error: insertErr } = await supabase.from('court_bookings').insert({
        court_id: selectedCourtId,
        user_id: user.id,
        player_name: form.player_name,
        opponent_name: form.opponent_name,
        match_type: form.match_type,
        court_number: courtNumber,
        booking_date: selectedDate,
        start_time: form.start_time,
        end_time: form.end_time,
        notes: form.notes.trim() || null,
        status: 'Scheduled',
      });

      if (insertErr) throw insertErr;

      addToast({ type: 'success', message: 'Booking created!' });
      setShowForm(false);
      setForm((f) => ({
        ...f,
        opponent_name: '',
        court_number: '',
        start_time: '',
        end_time: '',
        notes: '',
      }));
      fetchBookings();
    } catch (e: any) {
      addToast({ type: 'error', message: e.message || 'Failed to create booking' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (bookingId: string) => {
    try {
      const { error: err } = await supabase
        .from('court_bookings')
        .update({ status: 'Cancelled' })
        .eq('id', bookingId);
      if (err) throw err;
      addToast({ type: 'info', message: 'Booking cancelled' });
      fetchBookings();
    } catch (e: any) {
      addToast({ type: 'error', message: e.message || 'Failed to cancel booking' });
    }
  };

  const selectedCourt = courts.find((c) => c.id === selectedCourtId);
  const activeBookings = bookings.filter((b) => b.status === 'Scheduled');

  // Loading state — courts load independently of auth state
  if (loadingCourts) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container-custom max-w-5xl">
          <div className="mb-6">
            <h1 className="text-3xl md:text-4xl font-bold text-secondary-900 mb-2">Court Schedule</h1>
            <p className="text-secondary-600">See when players plan to use a court and add your own time.</p>
          </div>
          <NoticeBanner />
          <div className="card p-12 text-center mt-6">
            <Loader2 className="w-8 h-8 text-primary-500 animate-spin mx-auto mb-4" />
            <p className="text-secondary-600">Loading courts...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && courts.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container-custom max-w-5xl">
          <div className="mb-6">
            <h1 className="text-3xl md:text-4xl font-bold text-secondary-900 mb-2">Court Schedule</h1>
            <p className="text-secondary-600">See when players plan to use a court and add your own time.</p>
          </div>
          <NoticeBanner />
          <div className="card p-12 text-center mt-6">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-secondary-900 mb-2">Error loading courts: {error}</h3>
          </div>
        </div>
      </div>
    );
  }

  // No courts
  if (courts.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container-custom max-w-5xl">
          <div className="mb-6">
            <h1 className="text-3xl md:text-4xl font-bold text-secondary-900 mb-2">Court Schedule</h1>
            <p className="text-secondary-600">See when players plan to use a court and add your own time.</p>
          </div>
          <NoticeBanner />
          <div className="card p-12 text-center mt-6">
            <MapPin className="w-12 h-12 text-secondary-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-secondary-900 mb-2">No courts returned from Supabase.</h3>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container-custom max-w-5xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-secondary-900 mb-2">Court Schedule</h1>
          <p className="text-secondary-600">See when players plan to use a court and add your own time.</p>
        </div>

        <NoticeBanner />

        {/* Selectors */}
        <div className="card p-4 md:p-6 mt-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="label flex items-center gap-2">
                <Calendar className="w-4 h-4 text-secondary-400" />
                Date
              </label>
              <input
                type="date"
                value={selectedDate}
                min={todayStr}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label flex items-center gap-2">
                <MapPin className="w-4 h-4 text-secondary-400" />
                Court
              </label>
              <select
                value={selectedCourtId}
                onChange={(e) => setSelectedCourtId(e.target.value)}
                className="input"
              >
                {courts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.town}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedCourt && (
            <div className="mt-4 flex flex-wrap gap-3 text-sm text-secondary-500">
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {selectedCourt.address}, {selectedCourt.town}
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="w-4 h-4" />
                {selectedCourt.num_courts} court{selectedCourt.num_courts !== 1 ? 's' : ''}
              </span>
              {selectedCourt.surface_type && (
                <span className="inline-flex items-center gap-1 capitalize">
                  {selectedCourt.surface_type} surface
                </span>
              )}
              {selectedCourt.has_lights && (
                <span className="inline-flex items-center gap-1 text-amber-600">
                  <Info className="w-4 h-4" />
                  Lit
                </span>
              )}
            </div>
          )}

          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <button onClick={handleOpenForm} className="btn-primary w-full sm:w-auto">
              <Plus className="w-4 h-4" />
              Add a Time
            </button>
            <button onClick={fetchBookings} className="btn-outline w-full sm:w-auto">
              Refresh
            </button>
          </div>
        </div>

        {/* Bookings list */}
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-secondary-900 mb-3">
            {selectedDate ? format(parseISO(selectedDate), 'EEEE, MMMM d, yyyy') : 'Select a date'}
          </h2>

          {loadingBookings ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
            </div>
          ) : activeBookings.length === 0 ? (
            <div className="card p-12 text-center">
              <Calendar className="w-12 h-12 text-secondary-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-secondary-900 mb-1">No court times scheduled for this date.</h3>
              <p className="text-secondary-600 mb-4">Be the first to add a time slot.</p>
              <button onClick={handleOpenForm} className="btn-primary">
                <Plus className="w-4 h-4" />
                Add a Time
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {activeBookings.map((b) => {
                const Icon = matchTypeIcons[b.match_type] || User;
                const isOwn = user?.id === b.user_id;
                return (
                  <div key={b.id} className="card p-4 md:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-primary-100 flex items-center justify-center shrink-0">
                          <Icon className="w-5 h-5 text-primary-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-secondary-900">{b.player_name}</span>
                            <span className="text-secondary-400">vs</span>
                            <span className="font-semibold text-secondary-900">{b.opponent_name}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-secondary-500">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {b.start_time} – {b.end_time}
                            </span>
                            <span className="badge-primary">{b.match_type}</span>
                            {b.court_number && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="w-4 h-4" />
                                Court {b.court_number}
                              </span>
                            )}
                          </div>
                          {b.notes && (
                            <p className="text-sm text-secondary-600 mt-2 bg-secondary-50 rounded-lg p-2">
                              {b.notes}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`badge px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[b.status]}`}>
                          {b.status}
                        </span>
                        {isOwn && b.status === 'Scheduled' && (
                          <button
                            onClick={() => handleCancel(b.id)}
                            className="btn-ghost btn-sm text-red-600"
                            title="Cancel my booking"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="hidden sm:inline">Cancel</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Booking modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleCloseForm} />
          <div className="relative bg-white rounded-2xl shadow-elevated w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="sticky top-0 bg-white border-b border-secondary-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h3 className="text-xl font-bold text-secondary-900">Add a Court Time</h3>
              <button onClick={handleCloseForm} className="p-1.5 rounded-lg hover:bg-secondary-100">
                <X className="w-5 h-5 text-secondary-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="bg-secondary-50 rounded-xl p-3 text-sm text-secondary-600">
                <Calendar className="w-4 h-4 inline mr-1" />
                {selectedCourt?.name} · {format(parseISO(selectedDate), 'MMM d, yyyy')}
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Your Name</label>
                  <input
                    type="text"
                    value={form.player_name}
                    onChange={(e) => setForm({ ...form, player_name: e.target.value })}
                    className="input"
                    placeholder="Your name"
                    required
                  />
                </div>
                <div>
                  <label className="label">Opponent Name</label>
                  <input
                    type="text"
                    value={form.opponent_name}
                    onChange={(e) => setForm({ ...form, opponent_name: e.target.value })}
                    className="input"
                    placeholder="Opponent's name"
                    required
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Match Type</label>
                  <select
                    value={form.match_type}
                    onChange={(e) => setForm({ ...form, match_type: e.target.value as any })}
                    className="input"
                  >
                    {matchTypes.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Court Number (optional)</label>
                  <input
                    type="text"
                    value={form.court_number}
                    onChange={(e) => setForm({ ...form, court_number: e.target.value })}
                    className="input"
                    placeholder="e.g. 1, 2, A"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Start Time</label>
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label">End Time</label>
                  <input
                    type="time"
                    value={form.end_time}
                    onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                    className="input"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label">Notes (optional)</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="input min-h-[80px]"
                  placeholder="Anything others should know..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={handleCloseForm} className="btn-ghost flex-1">
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Add Time'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function NoticeBanner() {
  return (
    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
      <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
      <p className="text-sm text-amber-800">
        CourtConnect does not officially reserve public courts. This schedule is for community coordination only.
      </p>
    </div>
  );
}
