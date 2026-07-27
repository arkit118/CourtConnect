import { useState, useEffect, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Package, MapPin, Heart, Search, ArrowLeft, Camera, X, Upload, Info } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToastStore } from '../hooks/useToast';
import { useActionGate } from '../hooks/useActionGate';
import { supabase, GearListing, Profile } from '../lib/supabase';
import { uploadImage, validateImageFile } from '../lib/storage';
import { ReportButton } from '../components/ReportButton';

function GearNoticeBanner() {
  return (
    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
      <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
      <p className="text-sm text-amber-800">
        CourtConnect does not process gear payments, provide shipping, or guarantee transactions. Buyers and sellers
        coordinate local exchanges directly and at their own risk. Meet in public places and inspect items before paying.
      </p>
    </div>
  );
}

const categoryLabels: Record<string, string> = {
  racquets: 'Racquets',
  shoes: 'Shoes',
  bags: 'Bags',
  strings: 'Strings',
  apparel: 'Apparel',
  accessories: 'Accessories',
  other: 'Other',
};

const conditionLabels: Record<string, string> = {
  new: 'New',
  'like-new': 'Like New',
  good: 'Good',
  fair: 'Fair',
};

const conditionColors: Record<string, string> = {
  new: 'bg-green-50 text-green-700 border-green-200',
  'like-new': 'bg-blue-50 text-blue-700 border-blue-200',
  good: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  fair: 'bg-orange-50 text-orange-700 border-orange-200',
};

const categories = ['racquets', 'shoes', 'bags', 'strings', 'apparel', 'accessories', 'other'];
const conditions = ['new', 'like-new', 'good', 'fair'];
const towns = ['Bloomfield', 'Caldwell', 'Livingston', 'Maplewood', 'Millburn', 'Montclair', 'South Orange'];

export function GearPage() {
  const [listings, setListings] = useState<GearListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedCondition, setSelectedCondition] = useState('');
  const [selectedTown, setSelectedTown] = useState('');

  useEffect(() => {
    fetchListings();
  }, []);

  const fetchListings = async () => {
    try {
      const { data, error } = await supabase
        .from('gear_listings')
        .select('*, seller:profiles(*)')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setListings(data || []);
    } catch (error) {
      console.error('Error fetching listings:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredListings = listings.filter((listing) => {
    const matchesSearch = !search ||
      listing.title.toLowerCase().includes(search.toLowerCase()) ||
      listing.description?.toLowerCase().includes(search.toLowerCase());

    const matchesCategory = !selectedCategory || listing.category === selectedCategory;
    const matchesCondition = !selectedCondition || listing.condition === selectedCondition;
    const matchesTown = !selectedTown || listing.town === selectedTown;

    return matchesSearch && matchesCategory && matchesCondition && matchesTown;
  });

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container-custom">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-secondary-900 mb-2">Gear Exchange</h1>
            <p className="text-secondary-600">Buy, sell, and trade tennis equipment locally</p>
          </div>
          <Link to="/gear/create" className="btn-primary">
            List Your Gear
          </Link>
        </div>

        <GearNoticeBanner />

        <div className="flex gap-2 overflow-x-auto hide-scrollbar mb-6">
          <button
            onClick={() => setSelectedCategory('')}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              !selectedCategory ? 'bg-primary-500 text-white' : 'bg-white text-secondary-600 hover:bg-secondary-50'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat === selectedCategory ? '' : cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat ? 'bg-primary-500 text-white' : 'bg-white text-secondary-600 hover:bg-secondary-50'
              }`}
            >
              {categoryLabels[cat]}
            </button>
          ))}
        </div>

        <div className="card p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search gear..."
                className="input pl-10"
              />
            </div>
            <select
              value={selectedCondition}
              onChange={(e) => setSelectedCondition(e.target.value)}
              className="input w-auto"
            >
              <option value="">Any Condition</option>
              {conditions.map((cond) => (
                <option key={cond} value={cond}>{conditionLabels[cond]}</option>
              ))}
            </select>
            <select
              value={selectedTown}
              onChange={(e) => setSelectedTown(e.target.value)}
              className="input w-auto"
            >
              <option value="">Any Town</option>
              {towns.map((town) => (
                <option key={town} value={town}>{town}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-4">
          <p className="text-secondary-600">{filteredListings.length} listings</p>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card overflow-hidden">
                <div className="aspect-square bg-secondary-200 animate-pulse" />
                <div className="p-4">
                  <div className="h-4 bg-secondary-200 rounded w-3/4 mb-2 animate-pulse" />
                  <div className="h-5 bg-secondary-200 rounded w-1/3 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredListings.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-secondary-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-secondary-900 mb-2">No listings found</h3>
            <p className="text-secondary-600 mb-4">Try adjusting your filters or be the first to list gear</p>
            <Link to="/gear/create" className="btn-primary">List Your Gear</Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredListings.map((listing) => (
              <Link key={listing.id} to={`/gear/${listing.id}`}>
                <div className="card-hover overflow-hidden group">
                  <div className="aspect-square overflow-hidden relative">
                    <img
                      src={listing.photos?.[0] || 'https://images.pexels.com/photos/209977/pexels-photo-209977.jpeg?auto=compress&cs=tinysrgb&w=600'}
                      alt={listing.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-4 left-4">
                      <span className={`badge px-2 py-0.5 rounded-full text-xs font-medium border ${conditionColors[listing.condition]}`}>
                        {conditionLabels[listing.condition]}
                      </span>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-1 text-sm text-secondary-500">
                      <span>{categoryLabels[listing.category]}</span>
                      {listing.town && (
                        <>
                          <span>.</span>
                          <MapPin className="w-3 h-3" />
                          <span>{listing.town}</span>
                        </>
                      )}
                    </div>
                    <h3 className="font-semibold text-secondary-900 mb-2 group-hover:text-primary-600 transition-colors">
                      {listing.title}
                    </h3>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-primary-600">${listing.price}</span>
                      <div className="flex items-center gap-1 text-sm text-secondary-500">
                        <Heart className="w-4 h-4" />
                        <span>{listing.interested_count || 0}</span>
                      </div>
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

export function GearDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { addToast } = useToastStore();
  const [listing, setListing] = useState<GearListing | null>(null);
  const [seller, setSeller] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInterested, setIsInterested] = useState(false);

  useEffect(() => {
    if (id) fetchListing();
  }, [id]);

  const fetchListing = async () => {
    try {
      const { data, error } = await supabase
        .from('gear_listings')
        .select('*, seller:profiles!gear_listings_seller_id_fkey(*)')
        .eq('id', id)
        .single();

      if (error) throw error;
      setListing(data);
      setSeller((data as any).seller || null);

      if (user && data) {
        const { data: interest } = await supabase
          .from('gear_interests')
          .select('id')
          .eq('listing_id', data.id)
          .eq('user_id', user.id)
          .single();
        setIsInterested(!!interest);
      }
    } catch (error) {
      console.error('Error fetching listing:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInterest = async () => {
    if (!isAuthenticated || !listing) {
      navigate('/auth/login', { state: { from: { pathname: `/gear/${id}` } } });
      return;
    }

    try {
      if (isInterested) {
        await supabase
          .from('gear_interests')
          .delete()
          .eq('listing_id', listing.id)
          .eq('user_id', user!.id);
        setIsInterested(false);
        addToast({ type: 'info', message: 'Removed interest' });
      } else {
        await supabase
          .from('gear_interests')
          .insert({ listing_id: listing.id, user_id: user!.id });
        setIsInterested(true);
        addToast({ type: 'success', message: 'Marked as interested!' });
      }
    } catch (error: any) {
      addToast({ type: 'error', message: error.message || 'Failed to update' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container-custom">
          <div className="animate-pulse">
            <div className="aspect-square bg-secondary-200 rounded-2xl mb-6" />
            <div className="h-8 bg-secondary-200 rounded w-1/2 mb-4" />
          </div>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-secondary-900 mb-4">Listing not found</h2>
          <Link to="/gear" className="btn-primary">Browse Gear</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container-custom">
        <Link to="/gear" className="inline-flex items-center gap-2 text-secondary-600 hover:text-secondary-900 mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back to Gear Exchange
        </Link>

        <div className="grid lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="aspect-square rounded-2xl overflow-hidden card">
              <img
                src={listing.photos?.[0] || 'https://images.pexels.com/photos/209977/pexels-photo-209977.jpeg?auto=compress&cs=tinysrgb&w=800'}
                alt={listing.title}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <div>
            <div className="card p-6 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="badge bg-secondary-100 text-secondary-700">{categoryLabels[listing.category]}</span>
                <span className={`badge px-2 py-0.5 rounded-full text-xs font-medium border ${conditionColors[listing.condition]}`}>
                  {conditionLabels[listing.condition]}
                </span>
              </div>

              <h1 className="text-2xl md:text-3xl font-bold text-secondary-900 mb-3">{listing.title}</h1>
              <div className="text-3xl font-bold text-primary-600 mb-4">${listing.price}</div>

              <div className="flex items-center gap-4 text-sm text-secondary-600 mb-6">
                {listing.town && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    <span>{listing.town}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Heart className="w-4 h-4" />
                  <span>{listing.interested_count || 0} interested</span>
                </div>
              </div>

              <button
                onClick={handleInterest}
                className={`btn w-full ${isInterested ? 'bg-green-500 text-white hover:bg-green-600' : 'btn-primary'}`}
              >
                <Heart className={`w-5 h-5 ${isInterested ? 'fill-current' : ''}`} />
                {isInterested ? 'Interested' : "I'm Interested"}
              </button>
            </div>

            <div className="card p-6 mb-6">
              <h2 className="font-semibold text-secondary-900 mb-3">Description</h2>
              <p className="text-secondary-600 whitespace-pre-line">{listing.description || 'No description provided.'}</p>
            </div>

            {seller && (
              <div className="card p-6">
                <h2 className="font-semibold text-secondary-900 mb-3">Seller</h2>
                <Link to={`/players/${seller.id}`} className="flex items-center gap-4 hover:bg-secondary-50 rounded-lg p-2 -mx-2">
                  {seller.avatar_url ? (
                    <img src={seller.avatar_url} alt={seller.name} className="w-12 h-12 rounded-xl object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center">
                      <span className="text-primary-600 font-semibold">{seller.name[0]}</span>
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-secondary-900">{seller.name}</p>
                    <p className="text-sm text-secondary-500">{seller.home_town}</p>
                  </div>
                </Link>
              </div>
            )}

            {user?.id !== listing.seller_id && (
              <div className="mt-4 flex justify-end">
                <ReportButton reportType="gear_listing" targetId={listing.id} reportedUserId={listing.seller_id} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function GearCreatePage() {
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
    category: '',
    condition: '',
    price: '',
  });

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      addToast({ type: 'error', message: validation.error || 'Invalid file' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      const url = await uploadImage('gear-images', file, user?.id || 'temp');
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
    if (fileInputRef.current) fileInputRef.current.value = '';
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
      const photos = imageUrl ? [imageUrl] : [];
      const { error } = await supabase
        .from('gear_listings')
        .insert({
          seller_id: user.id,
          title: form.title,
          description: form.description,
          category: form.category as any,
          condition: form.condition as any,
          price: parseFloat(form.price),
          town: profile?.home_town || '',
          photos,
          is_active: true,
        });

      if (error) throw error;
      addToast({ type: 'success', message: 'Listing created!' });
      navigate('/gear');
    } catch (error: any) {
      addToast({ type: 'error', message: error.message || 'Failed to create listing' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container-custom max-w-2xl">
        <Link to="/gear" className="inline-flex items-center gap-2 text-secondary-600 hover:text-secondary-900 mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back to Gear Exchange
        </Link>

        <div className="card p-6 md:p-8">
          <h1 className="text-2xl font-bold text-secondary-900 mb-2">List Your Gear</h1>
          <p className="text-secondary-600 mb-8">List your tennis equipment for local pickup only</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Image Upload */}
            <div>
              <label className="label">Photo</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleImageSelect}
                className="hidden"
              />

              {imagePreview ? (
                <div className="relative aspect-square rounded-xl overflow-hidden bg-secondary-100 max-w-xs">
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
                  className="w-full aspect-square max-w-xs rounded-xl border-2 border-dashed border-secondary-300 hover:border-primary-500 transition-colors flex flex-col items-center justify-center gap-2"
                >
                  {uploading ? (
                    <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Camera className="w-10 h-10 text-secondary-400" />
                  )}
                  <span className="text-secondary-600 font-medium">
                    {uploading ? 'Uploading...' : 'Add photo'}
                  </span>
                  <span className="text-xs text-secondary-500">JPEG, PNG, WebP, GIF. Max 5MB.</span>
                </button>
              )}
            </div>

            <div>
              <label className="label">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="input"
                placeholder="e.g. Babolat Pure Drive 2022 - 4 3/8 Grip"
                required
              />
            </div>

            <div>
              <label className="label">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="input min-h-[120px]"
                placeholder="Describe your item's condition, any defects, and what's included..."
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="input"
                  required
                >
                  <option value="">Select category</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{categoryLabels[cat]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Condition</label>
                <select
                  value={form.condition}
                  onChange={(e) => setForm({ ...form, condition: e.target.value })}
                  className="input"
                  required
                >
                  <option value="">Select condition</option>
                  {conditions.map((cond) => (
                    <option key={cond} value={cond}>{conditionLabels[cond]}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Price ($)</label>
              <input
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="input"
                placeholder="e.g. 45"
                min="0"
                step="1"
                required
              />
            </div>

            <button type="submit" className="btn-primary w-full" disabled={loading || uploading}>
              {loading ? 'Creating...' : 'Create Listing'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
