-- ============================================
-- DEWCALL DATABASE SCHEMA
-- ============================================
-- Apply this in the Supabase SQL editor (Project → SQL Editor → New query).
-- Run the full script once. It is safe to re-run — CREATE TABLE uses
-- IF NOT EXISTS and policies use CREATE POLICY IF NOT EXISTS (Postgres 14+).
--
-- Two additions beyond the PRD spec:
--   • call_logs.outcome includes 'pending' — set by call-engine before Twilio
--     confirms the call outcome.
--   • memory_entries.archived — used by the memory pruning logic (Session 3)
--     to soft-archive oldest entries beyond the 10-entry cap.
-- ============================================


-- ============================================
-- 1. FAMILY MEMBERS (the buyers / adult children)
-- ============================================
CREATE TABLE IF NOT EXISTS family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth.users(id),
  full_name TEXT,                     -- nullable: webhook creates row before onboarding fills this
  email TEXT NOT NULL UNIQUE,
  phone TEXT,                         -- nullable: same reason
  whatsapp_number TEXT,
  preferred_brief_channel TEXT NOT NULL DEFAULT 'sms'
    CHECK (preferred_brief_channel IN ('sms', 'whatsapp', 'email', 'all')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  razorpay_subscription_id TEXT,      -- active payment provider
  subscription_status TEXT DEFAULT 'trial'
    CHECK (subscription_status IN ('trial', 'active', 'past_due', 'cancelled')),
  trial_ends_at TIMESTAMPTZ,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================
-- 2. SENIORS (the parents receiving calls)
-- ============================================
CREATE TABLE IF NOT EXISTS seniors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_family_member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  preferred_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  age INTEGER,
  date_of_birth DATE,
  companion_name TEXT NOT NULL DEFAULT 'Clara',
  relationship_status TEXT,
  living_situation TEXT,
  hobbies TEXT,
  personality_notes TEXT,
  cultural_notes TEXT,
  health_notes TEXT,
  memory_flag TEXT DEFAULT 'NORMAL'
    CHECK (memory_flag IN ('NORMAL', 'CAUTION', 'ALERT')),
  call_frequency TEXT NOT NULL DEFAULT 'weekdays'
    CHECK (call_frequency IN ('daily', 'weekdays', 'every_2_days', '3x_week', 'custom')),
  custom_call_days TEXT[],
  call_time TIME NOT NULL DEFAULT '09:00',
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  is_active BOOLEAN DEFAULT TRUE,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================
-- 3. FAMILY-SENIOR RELATIONSHIPS
-- ============================================
CREATE TABLE IF NOT EXISTS family_senior_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,
  senior_id UUID REFERENCES seniors(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL,
  receives_briefs BOOLEAN DEFAULT TRUE,
  receives_flags BOOLEAN DEFAULT TRUE,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(family_member_id, senior_id)
);


-- ============================================
-- 4. CALL LOGS (every call made)
-- ============================================
CREATE TABLE IF NOT EXISTS call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  senior_id UUID REFERENCES seniors(id) ON DELETE CASCADE,
  call_sid TEXT,
  call_date DATE NOT NULL,
  call_time_utc TIMESTAMPTZ NOT NULL,
  -- 'pending' added: set by call-engine at initiation, updated by Twilio status webhook
  outcome TEXT NOT NULL
    CHECK (outcome IN ('pending', 'answered', 'skipped', 'no_answer', 'voicemail', 'failed')),
  duration_seconds INTEGER DEFAULT 0,
  daily_theme TEXT,
  transcript TEXT,
  mood_score INTEGER CHECK (mood_score BETWEEN 1 AND 5),
  topics_mentioned TEXT[],
  flags_detected TEXT[] DEFAULT '{}',
  memory_update TEXT,
  brief_text TEXT,
  brief_delivered BOOLEAN DEFAULT FALSE,
  brief_delivered_at TIMESTAMPTZ,
  brief_delivery_channels TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================
-- 5. MEMORY LOG (rolling context per senior)
-- ============================================
CREATE TABLE IF NOT EXISTS memory_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  senior_id UUID REFERENCES seniors(id) ON DELETE CASCADE,
  call_log_id UUID REFERENCES call_logs(id),
  call_date DATE NOT NULL,
  mood_score INTEGER,
  memory_summary TEXT NOT NULL,
  topics TEXT[],
  flags TEXT[],
  -- archived: soft-archive oldest entries when count exceeds 10. Never hard-delete.
  archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================
-- 6. FLAG EVENTS (escalated flags for family)
-- ============================================
CREATE TABLE IF NOT EXISTS flag_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  senior_id UUID REFERENCES seniors(id) ON DELETE CASCADE,
  call_log_id UUID REFERENCES call_logs(id),
  flag_category TEXT NOT NULL
    CHECK (flag_category IN ('physical', 'emotional', 'cognitive', 'safety')),
  flag_description TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low', 'medium', 'high', 'urgent')),
  notified_family BOOLEAN DEFAULT FALSE,
  acknowledged_by UUID REFERENCES family_members(id),
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_call_logs_senior_date
  ON call_logs(senior_id, call_date DESC);

CREATE INDEX IF NOT EXISTS idx_memory_entries_senior
  ON memory_entries(senior_id, call_date DESC);

CREATE INDEX IF NOT EXISTS idx_flag_events_senior
  ON flag_events(senior_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_seniors_call_time
  ON seniors(call_time, timezone) WHERE is_active = TRUE;


-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE seniors ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_senior_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE flag_events ENABLE ROW LEVEL SECURITY;

-- Family members can only see their own profile row
DROP POLICY IF EXISTS "family_own_data" ON family_members;
CREATE POLICY "family_own_data" ON family_members
  FOR ALL USING (auth_user_id = auth.uid());

-- Family members can see seniors linked to them
DROP POLICY IF EXISTS "family_sees_linked_seniors" ON seniors;
CREATE POLICY "family_sees_linked_seniors" ON seniors
  FOR ALL USING (
    id IN (
      SELECT senior_id FROM family_senior_links
      WHERE family_member_id IN (
        SELECT id FROM family_members WHERE auth_user_id = auth.uid()
      )
    )
  );

-- Family members can see call logs for their linked seniors
DROP POLICY IF EXISTS "family_sees_call_logs" ON call_logs;
CREATE POLICY "family_sees_call_logs" ON call_logs
  FOR SELECT USING (
    senior_id IN (
      SELECT senior_id FROM family_senior_links
      WHERE family_member_id IN (
        SELECT id FROM family_members WHERE auth_user_id = auth.uid()
      )
    )
  );

-- Family members can see memory entries for their linked seniors
DROP POLICY IF EXISTS "family_sees_memory" ON memory_entries;
CREATE POLICY "family_sees_memory" ON memory_entries
  FOR SELECT USING (
    senior_id IN (
      SELECT senior_id FROM family_senior_links
      WHERE family_member_id IN (
        SELECT id FROM family_members WHERE auth_user_id = auth.uid()
      )
    )
  );

-- Family members can see and acknowledge flag events for their linked seniors
DROP POLICY IF EXISTS "family_sees_flags" ON flag_events;
CREATE POLICY "family_sees_flags" ON flag_events
  FOR ALL USING (
    senior_id IN (
      SELECT senior_id FROM family_senior_links
      WHERE family_member_id IN (
        SELECT id FROM family_members WHERE auth_user_id = auth.uid()
      )
    )
  );
