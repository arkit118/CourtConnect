export type { Profile, Event, Registration, PartnerRequest, GearListing, Comment, Court, ImpactMetric } from '../lib/supabase';

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'varsity' | 'elite';

export type EventStatus = 'open' | 'full' | 'completed' | 'cancelled';

export type GearCategory = 'racquets' | 'shoes' | 'bags' | 'strings' | 'apparel' | 'accessories' | 'other';

export type GearCondition = 'new' | 'like-new' | 'good' | 'fair';

export type SurfaceType = 'hard' | 'clay' | 'grass' | 'synthetic';

export type RequestStatus = 'pending' | 'accepted' | 'declined';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export interface FilterState {
  search: string;
  skill_levels: SkillLevel[];
  towns: string[];
  availability: string[];
  category: GearCategory | '';
  condition: GearCondition | '';
  surface: SurfaceType | '';
  has_lights: boolean | null;
  utr_min: number;
  utr_max: number;
  price_min: number;
  price_max: number;
}
