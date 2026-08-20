import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { MapPin, Trophy, Clock, Edit2, User, ChevronRight, Camera, Upload } from 'lucide-react';
import { supabase, Profile } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToastStore } from '../hooks/useToast';
import { useActionGate } from '../hooks/useActionGate';
import { uploadImage, validateImageFile, compressImageForUpload } from '../lib/storage';
import { withTimeout } from '../lib/withTimeout';
import { containsBlockedContent, CONTENT_BLOCKED_MESSAGE } from '../lib/contentFilter';
import { ReportButton } from '../components/ReportButton';
import { BlockButton } from '../components/BlockButton';
import { CourtCorner } from '../components/brand/CourtMotif';
import { SKILL_LEVELS, skillLevelLabels, skillLevelColors } from '../lib/skillLevel';

export function ProfilePage() {
  const { id } = useParams();
  const { user, profile: currentUser, updateProfile, loading: authLoading } = useAuth();
  const { addToast } = useToastStore();
  const canProceed = useActionGate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Profile>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local object URL is only ever meaningful for the lifetime of one
  // upload attempt - revoke it whenever it changes or the page unmounts
  // so we don't leak blob: URLs.
  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    };
  }, [avatarPreviewUrl]);

  const isOwnProfile = user && (currentUser?.id === id || (!id && currentUser));

  useEffect(() => {
    const fetchProfile = async () => {
      const targetId = id || currentUser?.id;
      if (!targetId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await withTimeout(
          supabase.from('profiles').select('*').eq('id', targetId).single(),
          15000,
          'Loading this profile timed out. Please try refreshing.'
        );

        if (fetchError) {
          if (fetchError.code === 'PGRST116') {
            setError('Profile not found');
          } else {
            throw fetchError;
          }
        } else {
          setProfile(data);
          setEditForm(data || {});
        }
      } catch (err: any) {
        console.error('Error fetching profile:', err);
        setError(err.message || 'Failed to load profile');
        addToast({ type: 'error', message: 'Failed to load profile' });
      } finally {
        setLoading(false);
      }
    };

    // Only fetch if we have an ID or auth has finished loading
    if (id) {
      fetchProfile();
    } else if (!authLoading) {
      fetchProfile();
    }
  }, [id, currentUser?.id, authLoading]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      addToast({ type: 'error', message: validation.error || 'Invalid file' });
      return;
    }
    if (!(await canProceed())) return;

    // Show the picked photo instantly, before the network round-trip -
    // the visible "it worked" moment shouldn't wait on the upload.
    setAvatarPreviewUrl(URL.createObjectURL(file));
    setUploading(true);
    try {
      const uploadFile = await compressImageForUpload(file);
      const publicUrl = await uploadImage('avatars', uploadFile, user.id);

      // Update profile with new avatar URL
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null);
      setEditForm(prev => ({ ...prev, avatar_url: publicUrl }));
      addToast({ type: 'success', message: 'Profile photo updated!' });
    } catch (error: any) {
      console.error('Error uploading profile photo:', error);
      addToast({ type: 'error', message: error.message || 'Failed to upload image' });
      setAvatarPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (containsBlockedContent(editForm.bio)) {
      addToast({ type: 'error', message: CONTENT_BLOCKED_MESSAGE });
      return;
    }
    if (!(await canProceed())) return;
    setSaving(true);

    try {
      const updated = await updateProfile(editForm);
      setProfile(updated);
      setIsEditing(false);
      addToast({ type: 'success', message: 'Profile updated!' });
    } catch (error: any) {
      addToast({ type: 'error', message: error.message || 'Failed to update profile' });
    } finally {
      setSaving(false);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container-custom">
          <div className="animate-pulse">
            <div className="h-16 bg-gray-200 rounded-2xl mb-4" />
            <div className="grid md:grid-cols-3 gap-6">
              <div className="h-64 bg-gray-200 rounded-2xl" />
              <div className="h-64 bg-gray-200 rounded-2xl col-span-2" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center px-4">
        <div className="rounded-3xl bg-white border border-secondary-200 p-10 text-center max-w-md">
          <CourtCorner className="w-8 h-8 text-primary-400 mx-auto mb-4" />
          <h2 className="font-display text-xl font-bold text-secondary-900 mb-4">{error}</h2>
          {!user && <Link to="/auth/login" className="btn-primary">Sign In</Link>}
          {user && <Link to="/players" className="btn-primary">Browse Players</Link>}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center px-4">
        <div className="rounded-3xl bg-white border border-secondary-200 p-10 text-center max-w-md">
          <CourtCorner className="w-8 h-8 text-primary-400 mx-auto mb-4" />
          <h2 className="font-display text-xl font-bold text-secondary-900 mb-4">Profile not found</h2>
          {!user && <Link to="/auth/login" className="btn-primary">Sign In</Link>}
          {user && <Link to="/players" className="btn-primary">Browse Players</Link>}
        </div>
      </div>
    );
  }

  const displayProfile = isEditing ? { ...profile, ...editForm } as Profile : profile!;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container-custom">
        {/* Header */}
        <div className="rounded-3xl bg-white border border-secondary-200 p-6 md:p-8 mb-6">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="relative">
              {avatarPreviewUrl || displayProfile.avatar_url ? (
                <img
                  src={avatarPreviewUrl || displayProfile.avatar_url || undefined}
                  alt={displayProfile.name}
                  className={`w-24 h-24 md:w-32 md:h-32 rounded-2xl object-cover ${uploading ? 'opacity-60' : ''}`}
                />
              ) : (
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-primary-100 flex items-center justify-center">
                  <User className="w-12 h-12 text-primary-500" />
                </div>
              )}
              {isOwnProfile && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute -bottom-2 -right-2 w-8 h-8 rounded-lg bg-white shadow-lg flex items-center justify-center text-secondary-600 hover:text-primary-600 disabled:opacity-50"
                >
                  {uploading ? (
                    <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>

            <div className="flex-1">
              <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
                <div>
                  <h1 className="font-display text-2xl md:text-3xl font-bold text-secondary-900">{displayProfile.name}</h1>
                  {displayProfile.home_town && (
                    <div className="flex items-center gap-1 text-secondary-600 mt-1">
                      <MapPin className="w-4 h-4" />
                      <span>{displayProfile.home_town}</span>
                    </div>
                  )}
                </div>
                {displayProfile.skill_level ? (
                  <span className={`badge px-3 py-1.5 rounded-full text-sm font-semibold border ${skillLevelColors[displayProfile.skill_level]}`}>
                    {skillLevelLabels[displayProfile.skill_level]}
                  </span>
                ) : (
                  isOwnProfile && !isEditing && (
                    <span className="badge px-3 py-1.5 rounded-full text-sm font-semibold border bg-gray-50 text-secondary-500 border-gray-200">
                      Skill level not set
                    </span>
                  )
                )}
                {displayProfile.utr_rating && (
                  <div className="flex items-center gap-1 text-primary-600 font-semibold">
                    <Trophy className="w-4 h-4" />
                    <span>Self-reported UTR {displayProfile.utr_rating}</span>
                  </div>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Name</label>
                      <input
                        type="text"
                        value={editForm.name || ''}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="label">Home Town</label>
                      <input
                        type="text"
                        value={editForm.home_town || ''}
                        onChange={(e) => setEditForm({ ...editForm, home_town: e.target.value })}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="label">Skill Level</label>
                      <select
                        value={editForm.skill_level || ''}
                        onChange={(e) => setEditForm({ ...editForm, skill_level: e.target.value as any })}
                        className="input"
                      >
                        <option value="">Not set</option>
                        {SKILL_LEVELS.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Self-Reported UTR Rating</label>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        max="16.5"
                        value={editForm.utr_rating || ''}
                        onChange={(e) => setEditForm({ ...editForm, utr_rating: parseFloat(e.target.value) || null })}
                        className="input"
                        placeholder="e.g. 5.5"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label">Bio</label>
                    <textarea
                      value={editForm.bio || ''}
                      onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                      className="input min-h-[100px]"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={handleSave} className="btn-primary" disabled={saving}>
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button onClick={() => setIsEditing(false)} className="btn-ghost">Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  {displayProfile.bio && (
                    <p className="text-secondary-600 mb-4 max-w-2xl">{displayProfile.bio}</p>
                  )}
                  {displayProfile.years_playing && (
                    <p className="text-sm text-secondary-500">
                      Playing tennis for {displayProfile.years_playing} years
                    </p>
                  )}
                  <div className="flex gap-3 mt-4">
                    {isOwnProfile && (
                      <button onClick={() => setIsEditing(true)} className="btn-outline">
                        <Edit2 className="w-4 h-4" />
                        Edit Profile
                      </button>
                    )}
                    {!isOwnProfile && user && (
                      <Link to="/players" className="btn-primary">
                        Find a Match
                      </Link>
                    )}
                    {!isOwnProfile && profile && user && (
                      <>
                        <ReportButton reportType="user" targetId={profile.id} reportedUserId={profile.id} />
                        <BlockButton blockedUserId={profile.id} />
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Details Grid */}
        {profile && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Play Style */}
            <div className="card p-6">
              <h3 className="font-semibold text-secondary-900 mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary-500" />
                Play Style
              </h3>
              {profile.preferred_play_style ? (
                <p className="text-secondary-600 capitalize">{profile.preferred_play_style.replace('-', ' ')}</p>
              ) : (
                <p className="text-secondary-400">Not specified</p>
              )}
            </div>

            {/* Availability */}
            <div className="card p-6">
              <h3 className="font-semibold text-secondary-900 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary-500" />
                Availability
              </h3>
              <div className="flex flex-wrap gap-2">
                {profile.availability?.length > 0 ? (
                  profile.availability.map((slot) => (
                    <span key={slot} className="badge-primary">{slot.replace('-', ' ')}</span>
                  ))
                ) : (
                  <p className="text-secondary-400">Not specified</p>
                )}
              </div>
            </div>

            {/* Favorite Courts */}
            <div className="card p-6">
              <h3 className="font-semibold text-secondary-900 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary-500" />
                Favorite Courts
              </h3>
              <div className="space-y-2">
                {profile.favorite_courts?.length > 0 ? (
                  profile.favorite_courts.map((court) => (
                    <div key={court} className="flex items-center gap-2 text-secondary-600">
                      <ChevronRight className="w-4 h-4 text-primary-500" />
                      <span>{court}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-secondary-400">Not specified</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ProfileEditPage() {
  const { user, profile, updateProfile, loading: authLoading } = useAuth();
  const { addToast } = useToastStore();
  const canProceed = useActionGate();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<Partial<Profile>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setForm(profile);
    }
  }, [profile]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      addToast({ type: 'error', message: validation.error || 'Invalid file' });
      return;
    }
    if (!(await canProceed())) return;

    // Instant local preview before the network round-trip; replaced with
    // the real Storage URL once the upload finishes.
    const previousAvatarUrl = form.avatar_url;
    const localPreviewUrl = URL.createObjectURL(file);
    setForm((prev) => ({ ...prev, avatar_url: localPreviewUrl }));

    setUploading(true);
    try {
      const uploadFile = await compressImageForUpload(file);
      const publicUrl = await uploadImage('avatars', uploadFile, user.id);
      setForm((prev) => ({ ...prev, avatar_url: publicUrl }));
      await updateProfile({ avatar_url: publicUrl });
      addToast({ type: 'success', message: 'Profile photo updated!' });
    } catch (error: any) {
      console.error('Error uploading profile photo:', error);
      addToast({ type: 'error', message: error.message || 'Failed to upload image' });
      setForm((prev) => ({ ...prev, avatar_url: previousAvatarUrl }));
    } finally {
      setUploading(false);
      URL.revokeObjectURL(localPreviewUrl);
    }
  };

  const handleSave = async () => {
    if (containsBlockedContent(form.bio)) {
      addToast({ type: 'error', message: CONTENT_BLOCKED_MESSAGE });
      return;
    }
    if (!(await canProceed())) return;
    setLoading(true);
    try {
      await updateProfile(form);
      addToast({ type: 'success', message: 'Profile updated!' });
      navigate('/profile');
    } catch (error: any) {
      addToast({ type: 'error', message: error.message || 'Failed to update' });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-secondary-900 mb-4">Please log in to edit your profile</h2>
          <Link to="/auth/login" className="btn-primary">Sign In</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container-custom max-w-2xl">
        <div className="card p-6 md:p-8">
          <h1 className="font-display text-2xl font-bold text-secondary-900 mb-8">Edit Profile</h1>

          {/* Avatar Upload */}
          <div className="flex items-center gap-6 mb-8">
            <div className="relative">
              {form.avatar_url ? (
                <img
                  src={form.avatar_url}
                  alt="Avatar"
                  className={`w-24 h-24 rounded-2xl object-cover ${uploading ? 'opacity-60' : ''}`}
                />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-primary-100 flex items-center justify-center">
                  <User className="w-12 h-12 text-primary-500" />
                </div>
              )}
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleImageUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="btn-outline"
              >
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Change Photo
                  </>
                )}
              </button>
              <p className="text-xs text-secondary-500 mt-2">JPEG, PNG, WebP, or GIF. Max 5MB.</p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="label">Name</label>
              <input
                type="text"
                value={form.name || ''}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input"
              />
            </div>

            <div>
              <label className="label">Bio</label>
              <textarea
                value={form.bio || ''}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                className="input min-h-[120px]"
                placeholder="Tell others about yourself..."
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Home Town</label>
                <input
                  type="text"
                  value={form.home_town || ''}
                  onChange={(e) => setForm({ ...form, home_town: e.target.value })}
                  className="input"
                  placeholder="e.g. Montclair"
                />
              </div>
              <div>
                <label className="label">Years Playing</label>
                <input
                  type="number"
                  value={form.years_playing || ''}
                  onChange={(e) => setForm({ ...form, years_playing: parseInt(e.target.value) || null })}
                  className="input"
                  placeholder="e.g. 10"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Skill Level</label>
                <select
                  value={form.skill_level || ''}
                  onChange={(e) => setForm({ ...form, skill_level: e.target.value as any })}
                  className="input"
                >
                  <option value="">Select level</option>
                  {SKILL_LEVELS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Self-Reported UTR Rating</label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  max="16.5"
                  value={form.utr_rating || ''}
                  onChange={(e) => setForm({ ...form, utr_rating: parseFloat(e.target.value) || null })}
                  className="input"
                  placeholder="e.g. 5.5"
                />
              </div>
            </div>

            <div>
              <label className="label">Play Style</label>
              <select
                value={form.preferred_play_style || ''}
                onChange={(e) => setForm({ ...form, preferred_play_style: e.target.value })}
                className="input"
              >
                <option value="">Select style</option>
                <option value="baseliner">Baseliner</option>
                <option value="serve-and-volley">Serve & Volley</option>
                <option value="all-court">All-Court</option>
                <option value="counter-puncher">Counter-Puncher</option>
                <option value="aggressive-baseliner">Aggressive Baseliner</option>
              </select>
            </div>

            <button onClick={handleSave} className="btn-primary w-full" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
