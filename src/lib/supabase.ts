import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type Profile = {
  id: string;
  name: string;
  bio: string | null;
  avatar_url: string | null;
  role: 'player' | 'admin';
  home_town: string | null;
  skill_level: 'beginner' | 'intermediate' | 'advanced' | 'varsity' | 'elite' | null;
  utr_rating: number | null;
  preferred_play_style: string | null;
  availability: string[];
  favorite_courts: string[];
  years_playing: number | null;
  date_of_birth: string | null;
  age_band: 'minor' | 'adult' | null;
  tos_accepted_at: string | null;
  tos_version: string | null;
  privacy_accepted_at: string | null;
  privacy_version: string | null;
  safety_acknowledged_at: string | null;
  is_banned: boolean;
  banned_at: string | null;
  ban_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type Event = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  date: string;
  start_time: string;
  end_time: string;
  venue: string;
  address: string | null;
  town: string;
  capacity: number;
  entry_fee: number;
  organizer_id: string | null;
  registration_count: number;
  status: 'open' | 'full' | 'completed' | 'cancelled';
  rules: string | null;
  faq: string | null;
  created_at: string;
  updated_at: string;
  organizer?: Profile;
};

export type Registration = {
  id: string;
  event_id: string;
  user_id: string;
  status: 'registered' | 'attended' | 'cancelled';
  payment_status: 'free' | 'pending' | 'paid' | 'refunded';
  stripe_payment_intent_id: string | null;
  created_at: string;
  profile?: Profile;
  event?: Event;
};

export type PartnerRequest = {
  id: string;
  requester_id: string;
  recipient_id: string;
  proposed_date: string;
  proposed_time: string;
  proposed_location: string;
  message: string | null;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  updated_at: string;
  requester?: Profile;
  recipient?: Profile;
};

export type GearListing = {
  id: string;
  seller_id: string;
  title: string;
  description: string | null;
  photos: string[];
  category: 'racquets' | 'shoes' | 'bags' | 'strings' | 'apparel' | 'accessories' | 'other';
  condition: 'new' | 'like-new' | 'good' | 'fair';
  price: number;
  town: string | null;
  is_active: boolean;
  interested_count: number;
  created_at: string;
  updated_at: string;
  seller?: Profile;
};

export type Comment = {
  id: string;
  commentable_type: 'event' | 'listing';
  commentable_id: string;
  user_id: string;
  content: string;
  is_flagged: boolean;
  created_at: string;
  updated_at: string;
  profile?: Profile;
};

export type Court = {
  id: string;
  name: string;
  address: string;
  town: string;
  surface_type: 'hard' | 'clay' | 'grass' | 'synthetic' | 'carpet' | 'other' | null;
  num_courts: number;
  has_lights: boolean;
  booking_url: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type CourtBooking = {
  id: string;
  court_id: string;
  user_id: string;
  player_name: string;
  opponent_name: string;
  match_type: 'Singles' | 'Doubles' | 'Practice' | 'Hitting';
  court_number: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  notes: string | null;
  status: 'Scheduled' | 'Cancelled';
  created_at: string;
  updated_at: string;
  court?: Court;
};

export type ImpactMetric = {
  id: string;
  metric_type: 'players' | 'events' | 'matches' | 'savings' | 'donations' | 'gear_exchanges';
  value: number;
  updated_at: string;
};

export type ReportType = 'user' | 'gear_listing' | 'court_booking' | 'event' | 'court' | 'general';

export type ReportStatus = 'open' | 'reviewed' | 'actioned' | 'dismissed';

export type Report = {
  id: string;
  reporter_id: string | null;
  reported_user_id: string | null;
  report_type: ReportType;
  target_id: string | null;
  reason: string;
  details: string | null;
  status: ReportStatus;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
};
