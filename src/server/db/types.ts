// ============================================
// DEWCALL — Database Types
// Keep these in sync with schema.sql CHECK constraints and column definitions.
// ============================================

export type BriefChannel = 'sms' | 'whatsapp' | 'email' | 'all';
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'cancelled';
export type MemoryFlag = 'NORMAL' | 'CAUTION' | 'ALERT';
export type CallFrequency = 'daily' | 'weekdays' | 'every_2_days' | '3x_week' | 'custom';
export type CallOutcome = 'pending' | 'answered' | 'skipped' | 'no_answer' | 'voicemail' | 'failed';
export type FlagCategory = 'physical' | 'emotional' | 'cognitive' | 'safety';
export type FlagSeverity = 'low' | 'medium' | 'high' | 'urgent';

// ── family_members ───────────────────────────────────────────────────────────
export interface FamilyMember {
  id: string;
  auth_user_id: string | null;
  full_name: string | null;   // nullable — webhook-created rows set this during onboarding
  email: string;
  phone: string | null;       // nullable — same reason
  whatsapp_number: string | null;
  preferred_brief_channel: BriefChannel;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  razorpay_subscription_id: string | null;
  subscription_status: SubscriptionStatus;
  trial_ends_at: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export type InsertFamilyMember = Omit<FamilyMember, 'id' | 'created_at' | 'updated_at'>;
export type UpdateFamilyMember = Partial<InsertFamilyMember>;

// ── seniors ──────────────────────────────────────────────────────────────────
export interface Senior {
  id: string;
  primary_family_member_id: string | null;
  full_name: string;
  preferred_name: string;
  phone: string;
  age: number | null;
  date_of_birth: string | null;
  companion_name: string;
  relationship_status: string | null;
  living_situation: string | null;
  hobbies: string | null;
  personality_notes: string | null;
  cultural_notes: string | null;
  health_notes: string | null;
  memory_flag: MemoryFlag;
  call_frequency: CallFrequency;
  custom_call_days: string[] | null;
  call_time: string;       // "HH:MM:SS" from PostgreSQL TIME
  timezone: string;
  is_active: boolean;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export type InsertSenior = Omit<Senior, 'id' | 'created_at' | 'updated_at'>;
export type UpdateSenior = Partial<InsertSenior>;

// ── family_senior_links ───────────────────────────────────────────────────────
export interface FamilySeniorLink {
  id: string;
  family_member_id: string;
  senior_id: string;
  relationship: string;
  receives_briefs: boolean;
  receives_flags: boolean;
  is_primary: boolean;
  created_at: string;
}

export type InsertFamilySeniorLink = Omit<FamilySeniorLink, 'id' | 'created_at'>;

// ── call_logs ────────────────────────────────────────────────────────────────
export interface CallLog {
  id: string;
  senior_id: string;
  call_sid: string | null;
  call_date: string;       // "YYYY-MM-DD"
  call_time_utc: string;   // ISO timestamp
  outcome: CallOutcome;
  duration_seconds: number;
  daily_theme: string | null;
  transcript: string | null;
  mood_score: number | null;
  topics_mentioned: string[] | null;
  flags_detected: string[];
  memory_update: string | null;
  brief_text: string | null;
  brief_delivered: boolean;
  brief_delivered_at: string | null;
  brief_delivery_channels: string[] | null;
  created_at: string;
}

export type InsertCallLog = Omit<CallLog, 'id' | 'created_at'>;
export type UpdateCallLog = Partial<InsertCallLog>;

// ── memory_entries ────────────────────────────────────────────────────────────
export interface MemoryEntry {
  id: string;
  senior_id: string;
  call_log_id: string | null;
  call_date: string;       // "YYYY-MM-DD"
  mood_score: number | null;
  memory_summary: string;
  topics: string[] | null;
  flags: string[] | null;
  archived: boolean;
  created_at: string;
}

export type InsertMemoryEntry = Omit<MemoryEntry, 'id' | 'created_at'>;

// ── flag_events ───────────────────────────────────────────────────────────────
export interface FlagEvent {
  id: string;
  senior_id: string;
  call_log_id: string | null;
  flag_category: FlagCategory;
  flag_description: string;
  severity: FlagSeverity;
  notified_family: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

export type InsertFlagEvent = Omit<FlagEvent, 'id' | 'created_at'>;
export type UpdateFlagEvent = Partial<InsertFlagEvent>;

// ── DetectedFlag (from brief-generator output) ────────────────────────────────
export interface DetectedFlag {
  category: FlagCategory;
  description: string;
  severity: FlagSeverity;
}
