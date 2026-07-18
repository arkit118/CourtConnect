-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  home_town TEXT,
  skill_level TEXT CHECK (skill_level IN ('beginner', 'intermediate', 'advanced', 'varsity', 'elite')),
  utr_rating DECIMAL(3,1),
  preferred_play_style TEXT,
  availability TEXT[],
  favorite_courts TEXT[],
  years_playing INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Events table
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  venue TEXT NOT NULL,
  address TEXT,
  town TEXT NOT NULL,
  capacity INTEGER NOT NULL,
  entry_fee DECIMAL(10,2) DEFAULT 0,
  organizer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  registration_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'full', 'completed', 'cancelled')),
  rules TEXT,
  faq TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Registrations table
CREATE TABLE registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'attended', 'cancelled')),
  payment_status TEXT DEFAULT 'free' CHECK (payment_status IN ('free', 'pending', 'paid', 'refunded')),
  stripe_payment_intent_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- Partner requests table
CREATE TABLE partner_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  proposed_date DATE NOT NULL,
  proposed_time TIME NOT NULL,
  proposed_location TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(requester_id, recipient_id, proposed_date)
);

-- Gear listings table
CREATE TABLE gear_listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  photos TEXT[],
  category TEXT NOT NULL CHECK (category IN ('racquets', 'shoes', 'bags', 'strings', 'apparel', 'accessories', 'other')),
  condition TEXT NOT NULL CHECK (condition IN ('new', 'like-new', 'good', 'fair')),
  price DECIMAL(10,2) NOT NULL,
  town TEXT,
  is_active BOOLEAN DEFAULT true,
  interested_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Gear interests table
CREATE TABLE gear_interests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID REFERENCES gear_listings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(listing_id, user_id)
);

-- Comments table
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  commentable_type TEXT NOT NULL CHECK (commentable_type IN ('event', 'listing')),
  commentable_id UUID NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_flagged BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Courts table
CREATE TABLE courts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  town TEXT NOT NULL,
  surface_type TEXT CHECK (surface_type IN ('hard', 'clay', 'grass', 'synthetic')),
  num_courts INTEGER NOT NULL,
  has_lights BOOLEAN DEFAULT false,
  booking_url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Impact metrics table
CREATE TABLE impact_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric_type TEXT NOT NULL CHECK (metric_type IN ('players', 'events', 'matches', 'savings', 'donations', 'gear_exchanges')),
  value INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin flags table for content moderation
CREATE TABLE admin_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flaggable_type TEXT NOT NULL CHECK (flaggable_type IN ('comment', 'listing', 'profile')),
  flaggable_id UUID NOT NULL,
  reporter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE gear_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE gear_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE impact_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_flags ENABLE ROW LEVEL SECURITY;

-- Profiles RLS policies
CREATE POLICY "profiles_select_public" ON profiles FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Events RLS policies
CREATE POLICY "events_select_all" ON events FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "events_insert_authenticated" ON events FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "events_update_organizer" ON events FOR UPDATE
  TO authenticated USING (auth.uid() = organizer_id) WITH CHECK (auth.uid() = organizer_id);
CREATE POLICY "events_delete_organizer" ON events FOR DELETE
  TO authenticated USING (auth.uid() = organizer_id);

-- Registrations RLS policies
CREATE POLICY "registrations_select_own" ON registrations FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR event_id IN (SELECT id FROM events WHERE organizer_id = auth.uid()));
CREATE POLICY "registrations_insert_own" ON registrations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "registrations_update_own" ON registrations FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR event_id IN (SELECT id FROM events WHERE organizer_id = auth.uid())) WITH CHECK (auth.uid() = user_id OR event_id IN (SELECT id FROM events WHERE organizer_id = auth.uid()));
CREATE POLICY "registrations_delete_own" ON registrations FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Partner requests RLS policies
CREATE POLICY "partner_requests_select_own" ON partner_requests FOR SELECT
  TO authenticated USING (auth.uid() = requester_id OR auth.uid() = recipient_id);
CREATE POLICY "partner_requests_insert_own" ON partner_requests FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "partner_requests_update_own" ON partner_requests FOR UPDATE
  TO authenticated USING (auth.uid() = recipient_id) WITH CHECK (auth.uid() = recipient_id);

-- Gear listings RLS policies
CREATE POLICY "gear_listings_select_active" ON gear_listings FOR SELECT
  TO authenticated USING (is_active = true OR auth.uid() = seller_id);
CREATE POLICY "gear_listings_insert_own" ON gear_listings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "gear_listings_update_own" ON gear_listings FOR UPDATE
  TO authenticated USING (auth.uid() = seller_id) WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "gear_listings_delete_own" ON gear_listings FOR DELETE
  TO authenticated USING (auth.uid() = seller_id);

-- Gear interests RLS policies
CREATE POLICY "gear_interests_select_own" ON gear_interests FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR listing_id IN (SELECT id FROM gear_listings WHERE seller_id = auth.uid()));
CREATE POLICY "gear_interests_insert_own" ON gear_interests FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gear_interests_delete_own" ON gear_interests FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Comments RLS policies
CREATE POLICY "comments_select_all" ON comments FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "comments_insert_own" ON comments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_delete_own" ON comments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Courts RLS policies
CREATE POLICY "courts_select_all" ON courts FOR SELECT
  TO authenticated USING (true);

-- Impact metrics RLS policies
CREATE POLICY "metrics_select_all" ON impact_metrics FOR SELECT
  TO authenticated USING (true);

-- Admin flags RLS policies (admin only - check with profile admin flag if needed)
CREATE POLICY "flags_select_all" ON admin_flags FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "flags_insert_authenticated" ON admin_flags FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "flags_update_own" ON admin_flags FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- Create indexes
CREATE INDEX idx_events_date ON events(date);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_town ON events(town);
CREATE INDEX idx_registrations_event ON registrations(event_id);
CREATE INDEX idx_registrations_user ON registrations(user_id);
CREATE INDEX idx_partners_recipient ON partner_requests(recipient_id);
CREATE INDEX idx_partners_status ON partner_requests(status);
CREATE INDEX idx_gear_category ON gear_listings(category);
CREATE INDEX idx_gear_town ON gear_listings(town);
CREATE INDEX idx_comments_commentable ON comments(commentable_type, commentable_id);
CREATE INDEX idx_courts_town ON courts(town);

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers for updated_at
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER events_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER partner_requests_updated_at BEFORE UPDATE ON partner_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER gear_listings_updated_at BEFORE UPDATE ON gear_listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER comments_updated_at BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER courts_updated_at BEFORE UPDATE ON courts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
