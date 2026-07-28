import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Upload, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToastStore } from '../hooks/useToast';
import { useActionGate } from '../hooks/useActionGate';
import { supabase } from '../lib/supabase';
import { uploadImage, validateImageFile } from '../lib/storage';

const towns = ['Bloomfield', 'Caldwell', 'Livingston', 'Maplewood', 'Millburn', 'Montclair', 'Nutley', 'South Orange', 'West Orange'];

export function EventCreatePage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { addToast } = useToastStore();
  const canProceed = useActionGate();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    date: '',
    start_time: '09:00',
    end_time: '12:00',
    venue: '',
    address: '',
    town: '',
    capacity: 16,
    entry_fee: 0,
    rules: '',
    faq: '',
  });

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      addToast({ type: 'error', message: validation.error || 'Invalid file' });
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);

    // Upload to storage
    setUploading(true);
    try {
      const url = await uploadImage('event-images', file, user?.id || 'temp');
      setImageUrl(url);
      addToast({ type: 'success', message: 'Image uploaded!' });
    } catch (error: any) {
      addToast({ type: 'error', message: error.message || 'Failed to upload image' });
      setImagePreview(null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setImageUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('/auth/login');
      return;
    }
    if (!(await canProceed())) {
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('events')
        .insert({
          title: form.title,
          description: form.description || null,
          image_url: imageUrl,
          date: form.date,
          start_time: form.start_time,
          end_time: form.end_time,
          venue: form.venue,
          address: form.address || null,
          town: form.town,
          capacity: form.capacity,
          entry_fee: form.entry_fee,
          organizer_id: user.id,
          registration_count: 0,
          status: 'open',
          rules: form.rules || null,
          faq: form.faq || null,
        })
        .select()
        .single();

      if (error) throw error;
      addToast({ type: 'success', message: 'Event created successfully!' });
      navigate(`/events/${data.id}`);
    } catch (error: any) {
      addToast({ type: 'error', message: error.message || 'Failed to create event' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container-custom max-w-2xl">
        <Link to="/events" className="inline-flex items-center gap-2 text-secondary-600 hover:text-secondary-900 mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back to Events
        </Link>

        <div className="card p-6 md:p-8">
          <h1 className="text-2xl font-bold text-secondary-900 mb-2">Create an Event</h1>
          <p className="text-secondary-600 mb-8">Host a tournament, clinic, or social event for the community</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Image Upload */}
            <div>
              <label className="label">Event Image</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleImageSelect}
                className="hidden"
              />

              {imagePreview ? (
                <div className="relative aspect-video rounded-xl overflow-hidden bg-secondary-100">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-white/90 shadow-lg flex items-center justify-center text-secondary-600 hover:text-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  {uploading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full aspect-video rounded-xl border-2 border-dashed border-secondary-300 hover:border-primary-500 transition-colors flex flex-col items-center justify-center gap-2 p-8"
                >
                  {uploading ? (
                    <>
                      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-secondary-600">Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-10 h-10 text-secondary-400" />
                      <span className="text-secondary-600 font-medium">Click to upload event image</span>
                      <span className="text-sm text-secondary-500">JPEG, PNG, WebP, or GIF. Max 5MB.</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <div>
              <label className="label">Event Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="input"
                placeholder="e.g. Summer Doubles Tournament"
                required
              />
            </div>

            <div>
              <label className="label">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="input min-h-[120px]"
                placeholder="Describe your event, who should attend, what to expect..."
              />
            </div>

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
              <div className="grid grid-cols-2 gap-2">
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
            </div>

            <div>
              <label className="label">Venue Name</label>
              <input
                type="text"
                value={form.venue}
                onChange={(e) => setForm({ ...form, venue: e.target.value })}
                className="input"
                placeholder="e.g. Brookdale Park Tennis Courts"
                required
              />
            </div>

            <div>
              <label className="label">Address</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="input"
                placeholder="e.g. 473 Watchung Ave, Bloomfield, NJ"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Town</label>
                <select
                  value={form.town}
                  onChange={(e) => setForm({ ...form, town: e.target.value })}
                  className="input"
                  required
                >
                  <option value="">Select town</option>
                  {towns.map((town) => (
                    <option key={town} value={town}>{town}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Capacity</label>
                <input
                  type="number"
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) })}
                  className="input"
                  min="4"
                  max="128"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Entry Fee ($)</label>
              <input
                type="number"
                value={form.entry_fee}
                onChange={(e) => setForm({ ...form, entry_fee: parseFloat(e.target.value) })}
                className="input"
                min="0"
                step="1"
                placeholder="0 for free events"
              />
              <p className="text-xs text-secondary-500 mt-1">Set to 0 for free events</p>
            </div>

            <div>
              <label className="label">Rules & Format (optional)</label>
              <textarea
                value={form.rules}
                onChange={(e) => setForm({ ...form, rules: e.target.value })}
                className="input min-h-[100px]"
                placeholder="e.g. USTA rules apply. Matches are best of 3 sets..."
              />
            </div>

            <div>
              <label className="label">FAQ (optional)</label>
              <textarea
                value={form.faq}
                onChange={(e) => setForm({ ...form, faq: e.target.value })}
                className="input min-h-[100px]"
                placeholder="e.g. What should I bring? - Racquet, water, snacks..."
              />
            </div>

            <button type="submit" className="btn-primary w-full" disabled={loading || uploading}>
              {loading ? 'Creating...' : 'Create Event'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
