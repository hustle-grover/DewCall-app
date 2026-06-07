# MorningBrief — Product Requirement Document (PRD)

> **Version:** 1.0
> **Date:** May 29, 2026
> **Author:** Founder
> **Status:** Ready for Build
> **Build Tool:** Claude Code

---

## 1. PRODUCT OVERVIEW

### 1.1 What Is MorningBrief?

MorningBrief is a service that makes a warm AI phone call to elderly parents every morning and delivers a plain-English daily brief to their adult children via SMS, WhatsApp, or email.

**The senior experiences:** A friendly 2-3 minute morning conversation with a caring voice that remembers them.

**The family experiences:** A daily text/email summary telling them their parent is okay, what they talked about, and anything worth knowing.

### 1.2 One-Line Pitch

> "We call your parent every morning so you know they're okay — without them needing to learn any new technology."

### 1.3 Target Users

| User Type | Who They Are | What They Need |
|-----------|-------------|----------------|
| **Primary Buyer** | Adult children (age 40-60) with elderly parents | Peace of mind. Daily confirmation their parent is okay. |
| **Primary User** | Elderly parents (age 65+), often living alone | A pleasant morning conversation. No tech required. |
| **Secondary Users** | Siblings, extended family | Shared access to daily briefs so everyone stays informed. |

### 1.4 Business Model

- **Pricing:** $25/month per senior parent (one parent = one subscription)
- **Who Pays:** The adult child (B2C2F model — business to consumer to family)
- **Billing:** Monthly subscription via Stripe
- **Free Trial:** 7 days free, no credit card required for trial

### 1.5 Key Metrics to Track

- Number of active subscribers (families)
- Call answer rate (% of calls answered by seniors)
- Average call duration
- Brief delivery success rate
- Churn rate (monthly)
- Net Promoter Score from family members
- Flags detected per week

---

## 2. TECH STACK

### 2.1 Required Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| **Runtime** | Node.js (v20+) with TypeScript | Best Twilio + Anthropic SDK support |
| **Framework** | Express.js or Fastify | API server for webhooks |
| **Database** | Supabase (PostgreSQL) | Free tier, real-time, auth built-in |
| **AI Conversation** | Anthropic Claude API (claude-sonnet-4-20250514) | Powers both call conversation and brief generation |
| **Phone Calls** | Twilio Programmable Voice | Outbound calls, transcription, webhooks |
| **Text-to-Speech** | ElevenLabs API (or Azure Neural TTS as fallback) | Natural-sounding voice for the call |
| **Speech-to-Text** | Deepgram API (or Twilio built-in transcription) | Real-time transcription during calls |
| **SMS Delivery** | Twilio Messaging API | Send briefs via SMS |
| **WhatsApp Delivery** | Twilio WhatsApp API (or Meta Cloud API) | Send briefs via WhatsApp |
| **Email Delivery** | Resend (or SendGrid) | Send briefs via email |
| **Scheduling** | node-cron (or BullMQ with Redis for production) | Schedule daily calls per timezone |
| **Payments** | Stripe | Subscription billing |
| **Deployment** | Railway (or Render) | Always-on server needed for cron + webhooks |
| **Frontend** | React + Vite + Tailwind CSS | Family dashboard |
| **Auth** | Supabase Auth | Family member login |

### 2.2 Project Structure

```
morningbrief/
├── package.json
├── tsconfig.json
├── .env.example
├── README.md
│
├── /src
│   ├── /server
│   │   ├── index.ts                 # Express server entry point
│   │   ├── routes/
│   │   │   ├── webhooks.ts          # Twilio webhook handlers
│   │   │   ├── api.ts               # REST API for dashboard
│   │   │   ├── auth.ts              # Auth routes
│   │   │   └── stripe.ts            # Stripe webhook + billing
│   │   │
│   │   ├── services/
│   │   │   ├── call-scheduler.ts    # Cron-based call scheduling
│   │   │   ├── call-engine.ts       # Orchestrates: initiate call → AI conversation → end
│   │   │   ├── call-agent.ts        # Claude API: live conversation during call
│   │   │   ├── brief-generator.ts   # Claude API: generate family brief from transcript
│   │   │   ├── memory-store.ts      # Read/write senior memory to Supabase
│   │   │   ├── brief-delivery.ts    # Send brief via SMS / WhatsApp / Email
│   │   │   ├── tts-service.ts       # Text-to-speech (ElevenLabs or Azure)
│   │   │   ├── stt-service.ts       # Speech-to-text (Deepgram or Twilio)
│   │   │   └── flag-handler.ts      # Process and escalate red flags
│   │   │
│   │   ├── prompts/
│   │   │   ├── call-system-prompt.ts    # The full call agent system prompt
│   │   │   ├── brief-system-prompt.ts   # The brief generation system prompt
│   │   │   └── daily-themes.ts          # 7-day theme rotation
│   │   │
│   │   ├── db/
│   │   │   ├── supabase.ts          # Supabase client
│   │   │   ├── schema.sql           # Database schema
│   │   │   └── seed.ts              # Test data seeding
│   │   │
│   │   └── utils/
│   │       ├── logger.ts            # Structured logging
│   │       ├── timezone.ts          # Timezone helpers
│   │       └── config.ts            # Environment config
│   │
│   └── /dashboard
│       ├── index.html
│       ├── /src
│       │   ├── App.tsx
│       │   ├── main.tsx
│       │   ├── /pages
│       │   │   ├── Login.tsx
│       │   │   ├── Signup.tsx
│       │   │   ├── Onboarding.tsx       # Set up parent profile
│       │   │   ├── DailyBrief.tsx       # Today's brief
│       │   │   ├── BriefHistory.tsx     # Past briefs timeline
│       │   │   ├── MoodTrends.tsx       # Mood chart over time
│       │   │   ├── Settings.tsx         # Call time, frequency, channels
│       │   │   ├── ParentProfile.tsx    # Edit parent info
│       │   │   └── Billing.tsx          # Stripe subscription management
│       │   ├── /components
│       │   │   ├── BriefCard.tsx
│       │   │   ├── MoodChart.tsx
│       │   │   ├── FlagAlert.tsx
│       │   │   ├── CallStatusBadge.tsx
│       │   │   └── NavBar.tsx
│       │   └── /lib
│       │       ├── supabase.ts
│       │       └── api.ts
│       └── tailwind.config.ts
│
└── /scripts
    ├── setup-twilio.ts              # One-time Twilio setup
    ├── test-call.ts                 # Test a single call manually
    └── test-brief.ts               # Test brief generation from sample transcript
```

### 2.3 Environment Variables

```env
# .env.example

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Anthropic (Claude)
ANTHROPIC_API_KEY=sk-ant-xxxxx

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
TWILIO_WHATSAPP_NUMBER=+1xxxxxxxxxx

# ElevenLabs (TTS)
ELEVENLABS_API_KEY=xxxxx
ELEVENLABS_VOICE_ID=xxxxx

# Deepgram (STT)
DEEPGRAM_API_KEY=xxxxx

# Resend (Email)
RESEND_API_KEY=xxxxx

# Stripe
STRIPE_SECRET_KEY=sk_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
STRIPE_PRICE_ID=price_xxxxx

# App
APP_URL=https://morningbrief.app
PORT=3000
NODE_ENV=production
```

---

## 3. DATABASE SCHEMA

### 3.1 Supabase Tables

```sql
-- ============================================
-- MORNINGBRIEF DATABASE SCHEMA
-- ============================================

-- 1. FAMILY MEMBERS (the buyers / adult children)
CREATE TABLE family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth.users(id),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  whatsapp_number TEXT,
  preferred_brief_channel TEXT NOT NULL DEFAULT 'sms'
    CHECK (preferred_brief_channel IN ('sms', 'whatsapp', 'email', 'all')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT DEFAULT 'trial'
    CHECK (subscription_status IN ('trial', 'active', 'past_due', 'cancelled')),
  trial_ends_at TIMESTAMPTZ,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. SENIORS (the parents receiving calls)
CREATE TABLE seniors (
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

-- 3. FAMILY-SENIOR RELATIONSHIPS (supports multiple family members per senior)
CREATE TABLE family_senior_links (
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

-- 4. CALL LOGS (every call made)
CREATE TABLE call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  senior_id UUID REFERENCES seniors(id) ON DELETE CASCADE,
  call_sid TEXT,
  call_date DATE NOT NULL,
  call_time_utc TIMESTAMPTZ NOT NULL,
  outcome TEXT NOT NULL
    CHECK (outcome IN ('answered', 'skipped', 'no_answer', 'voicemail', 'failed')),
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

-- 5. MEMORY LOG (rolling context for each senior — last 10 entries)
CREATE TABLE memory_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  senior_id UUID REFERENCES seniors(id) ON DELETE CASCADE,
  call_log_id UUID REFERENCES call_logs(id),
  call_date DATE NOT NULL,
  mood_score INTEGER,
  memory_summary TEXT NOT NULL,
  topics TEXT[],
  flags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. FLAG EVENTS (escalated flags that need family attention)
CREATE TABLE flag_events (
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
CREATE INDEX idx_call_logs_senior_date ON call_logs(senior_id, call_date DESC);
CREATE INDEX idx_memory_entries_senior ON memory_entries(senior_id, call_date DESC);
CREATE INDEX idx_flag_events_senior ON flag_events(senior_id, created_at DESC);
CREATE INDEX idx_seniors_call_time ON seniors(call_time, timezone) WHERE is_active = TRUE;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE seniors ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_senior_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE flag_events ENABLE ROW LEVEL SECURITY;

-- Family members can only see their own data
CREATE POLICY "family_own_data" ON family_members
  FOR ALL USING (auth_user_id = auth.uid());

-- Family members can see seniors linked to them
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
CREATE POLICY "family_sees_call_logs" ON call_logs
  FOR SELECT USING (
    senior_id IN (
      SELECT senior_id FROM family_senior_links
      WHERE family_member_id IN (
        SELECT id FROM family_members WHERE auth_user_id = auth.uid()
      )
    )
  );

-- Same pattern for memory_entries and flag_events
CREATE POLICY "family_sees_memory" ON memory_entries
  FOR SELECT USING (
    senior_id IN (
      SELECT senior_id FROM family_senior_links
      WHERE family_member_id IN (
        SELECT id FROM family_members WHERE auth_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "family_sees_flags" ON flag_events
  FOR ALL USING (
    senior_id IN (
      SELECT senior_id FROM family_senior_links
      WHERE family_member_id IN (
        SELECT id FROM family_members WHERE auth_user_id = auth.uid()
      )
    )
  );
```

---

## 4. CORE FEATURES — MVP (Phase 1)

### 4.1 Call Engine

#### 4.1.1 Call Scheduling
- Every active senior has a `call_time` and `timezone` configured
- A cron job runs every minute and checks: "Which seniors need a call right now?"
- Query: `SELECT * FROM seniors WHERE is_active = TRUE AND call_time = [current_time_in_their_timezone] AND [today matches their call_frequency]`
- On match: initiate an outbound Twilio call to the senior's phone number
- If call is not answered: retry once after 15 minutes. If still no answer, mark as `no_answer` and notify family.

#### 4.1.2 Call Flow (Real-Time AI Conversation)
```
FLOW:
1. Twilio initiates outbound call to senior's phone
2. Senior answers (or doesn't — handle both cases)
3. If answered:
   a. Play initial greeting via TTS (ElevenLabs/Azure)
   b. Start listening (Deepgram/Twilio STT streams audio)
   c. Senior speaks → transcribed text sent to Claude API
   d. Claude responds (using Call System Prompt) → text sent to TTS
   e. TTS audio played back to senior via Twilio
   f. Loop steps c-e until conversation naturally ends
   g. Claude signals end → play closing line → hang up
4. Full transcript saved to call_logs
5. Trigger brief generation (Step 4.2)
```

#### 4.1.3 Call Agent System Prompt
The full system prompt is provided below in Section 7 (PROMPT APPENDIX).

Key behaviors:
- Warm, caring, never clinical
- Opens with personalized greeting using senior's preferred name
- References memory from past calls
- Uses daily theme rotation (7 different themes for variety)
- Embeds wellbeing signals naturally (sleep, eating, mood, pain)
- Detects red flags silently (physical, emotional, cognitive, safety)
- Wraps up naturally in 2-3 minutes
- Handles "skip/not now" gracefully
- Hard cap at 6 minutes maximum call duration

#### 4.1.4 Daily Theme Rotation
```
Monday    → "Week Ahead" — what they're looking forward to
Tuesday   → "Something Good" — a positive thing that happened
Wednesday → "Right Now" — what's going on in their world
Thursday  → "A Story" — a memory or story from their life
Friday    → "Family & Weekend" — weekend plans, family
Saturday  → "Hobbies" — what they enjoy doing
Sunday    → "Reflection" — what they're grateful for
```
If `memory_flag = CAUTION` (cognitive concerns), skip Thursday's theme and use Wednesday's instead.

### 4.2 Brief Generation

#### 4.2.1 Post-Call Brief
After every completed call:
1. Send the full transcript to Claude using the Brief Generation Prompt (Section 7.2)
2. Claude returns:
   - Family brief text (the human-readable summary)
   - `memory_update` (2-3 sentences for next call's memory injection)
   - `mood_score` (1-5 scale)
   - `topics_mentioned` (array of topic tags)
   - `flags_detected` (NONE or list of flag objects)
3. Save all outputs to `call_logs` and `memory_entries` tables
4. If flags detected: create entries in `flag_events` table

#### 4.2.2 Brief Format
**SMS/WhatsApp format (under 600 characters):**
```
Good morning Sarah! Here's Mum's update 🌅

😊 Maggie sounded bright and cheerful today

• She's excited about her tomatoes finally growing
• Asked when you're visiting next
• Went for a short walk yesterday morning

Her knee feels "much better than last week" 🙌

📞 3 min — answered first ring
```

**Email format (longer, includes subject line):**
```
Subject: Mum's Morning — Thursday 29 May ☀️

[Full brief with sections: How She Seemed, What She Talked About,
Anything to Know, Call Details]
```

**Flag format (prepended when flags detected):**
```
⚠️ Dad mentioned someone called claiming to be from Medicare
asking him to verify his account. He didn't share info but
seemed confused. Worth a quick call today.
```

### 4.3 Brief Delivery

#### 4.3.1 Delivery Channels
- **SMS:** Twilio Messaging API — default channel
- **WhatsApp:** Twilio WhatsApp API — second channel, supports group delivery
- **Email:** Resend API — for longer-form briefs with mood history
- Family member chooses preferred channel during onboarding
- Can select "all" to receive on all channels
- Multiple family members can receive the same brief (siblings)

#### 4.3.2 Delivery Rules
- Normal briefs: delivered within 5 minutes of call completion
- Flag briefs (any red flag detected): delivered immediately
- Urgent flags (safety or physical): also trigger a separate urgent SMS regardless of preferred channel
- No-answer notification: sent if senior doesn't pick up after retry
  - Text: "Margaret didn't answer her morning call today. You may want to check in. 💛"

### 4.4 Memory System

#### 4.4.1 How Memory Works
- After each call, Claude generates a `memory_update` — 2-3 sentences of what to remember
- This is stored in `memory_entries` table
- Before each new call, the system loads the last 5 memory entries
- These are injected into the Call System Prompt as the `[MEMORY_BLOCK]`
- This is how the AI "remembers" past conversations and creates continuity
- Cap at 10 memory entries per senior (oldest get archived, not deleted)

#### 4.4.2 Memory Example
```
Memory from May 27: Maggie's tomatoes are finally growing. Daughter
Sarah visited last weekend. Knee pain improving. She mentioned
missing her husband on quiet evenings.

Memory from May 26: Seemed tired, didn't sleep well. Bridge club
cancelled this week. Nothing concerning.

Memory from May 23: Very cheerful. Talked about a new book she's
reading — mystery novel. Asked about Michael's new job.
```

### 4.5 Family Dashboard (Web App)

#### 4.5.1 Pages

**Login / Signup**
- Email + password via Supabase Auth
- Google OAuth optional
- After signup → redirect to onboarding

**Onboarding (Step-by-Step Wizard)**
- Step 1: "Tell us about yourself" — name, phone, WhatsApp, email, timezone
- Step 2: "Tell us about your parent" — name, preferred name, age, phone, relationship status, living situation
- Step 3: "Help us know them" — hobbies, personality notes, cultural notes, health notes (all optional but encouraged)
- Step 4: "Set up the calls" — call time, call frequency, companion name (default: Clara)
- Step 5: "Where should we send your daily brief?" — SMS / WhatsApp / Email / All
- Step 6: "Add family members" — invite siblings or other family to receive briefs too
- Step 7: "Start your free trial" — confirm and begin (7 days free)

**Today's Brief (Home Page)**
- Shows today's brief front and center
- Mood emoji prominently displayed
- Topics as tags/chips
- Any flags highlighted with yellow/red background
- "View Full Transcript" expandable section
- Call status badge (answered, skipped, no answer)

**Brief History (Timeline)**
- Scrollable timeline of past briefs
- Each brief is a card with: date, mood emoji, summary snippet, flag indicator
- Click to expand full brief
- Filter by: date range, mood score, flagged only

**Mood Trends (Chart)**
- Line chart showing mood score (1-5) over the last 30 days
- Average mood this week vs last week
- Flag events marked on the timeline
- Topics word cloud showing most-mentioned topics

**Parent Profile**
- Edit all parent details (name, hobbies, personality, health notes)
- Update call preferences (time, frequency, companion name)
- Memory flag setting (Normal / Caution)
- View/edit custom call days

**Settings**
- Brief delivery channel preference
- Notification preferences
- Manage family members (add/remove siblings)
- Timezone

**Billing**
- Current plan and status
- Stripe customer portal link
- Invoice history
- Cancel subscription

#### 4.5.2 Design Guidelines
- **Color palette:** Warm, soft tones — cream/warm white background, soft blue primary, sage green accents, warm amber for alerts. NOT clinical white and blue.
- **Typography:** Friendly, readable. Inter or similar clean sans-serif. Body text 16px minimum.
- **Tone:** Warm and caring throughout. No tech jargon. No "dashboard" or "analytics" language. Say "How Mum's doing" not "Wellness Analytics."
- **Mobile-responsive:** Many adult children will check on their phone. Must work beautifully on mobile.
- **Empty states:** Warm and helpful. "Your first brief will arrive after Mum's first morning call tomorrow ☀️"

---

## 5. API ENDPOINTS

### 5.1 REST API

```
AUTH
POST   /api/auth/signup              # Create account
POST   /api/auth/login               # Login
POST   /api/auth/logout              # Logout
GET    /api/auth/me                  # Get current user

ONBOARDING
POST   /api/onboarding/family        # Create family member profile
POST   /api/onboarding/senior        # Create senior profile
POST   /api/onboarding/complete      # Mark onboarding done, schedule first call

SENIORS
GET    /api/seniors                   # List all linked seniors
GET    /api/seniors/:id               # Get senior details
PUT    /api/seniors/:id               # Update senior profile
PUT    /api/seniors/:id/preferences   # Update call preferences

BRIEFS
GET    /api/briefs/:seniorId          # Get all briefs for a senior (paginated)
GET    /api/briefs/:seniorId/today    # Get today's brief
GET    /api/briefs/:seniorId/latest   # Get most recent brief
GET    /api/briefs/:seniorId/mood     # Get mood data for chart (last 30 days)

FLAGS
GET    /api/flags/:seniorId           # Get all flags for a senior
PUT    /api/flags/:id/acknowledge     # Acknowledge a flag

FAMILY
POST   /api/family/invite             # Invite a family member (sibling)
GET    /api/family/:seniorId          # List family members for a senior
DELETE /api/family/:linkId            # Remove a family member link

SETTINGS
GET    /api/settings                  # Get user settings
PUT    /api/settings                  # Update settings

BILLING
POST   /api/billing/create-checkout   # Create Stripe checkout session
POST   /api/billing/portal            # Get Stripe customer portal URL
POST   /api/billing/webhook           # Stripe webhook handler

TWILIO WEBHOOKS (called by Twilio, not by frontend)
POST   /webhooks/twilio/voice         # Call initiated webhook
POST   /webhooks/twilio/status        # Call status callback
POST   /webhooks/twilio/transcription # Transcription callback

INTERNAL / ADMIN
POST   /api/admin/test-call/:seniorId # Manually trigger a test call
GET    /api/admin/call-queue          # View upcoming scheduled calls
```

---

## 6. USER FLOWS

### 6.1 Signup & Onboarding Flow

```
Adult child finds MorningBrief (via Facebook group, referral, ad)
  → Lands on marketing page
  → Clicks "Start Free Trial"
  → Creates account (email + password)
  → Enters their info (name, phone, timezone)
  → Enters parent info (name, phone, age, living situation)
  → Fills personality profile (hobbies, notes — with helpful prompts)
  → Sets call preferences (time, frequency)
  → Chooses brief channel (SMS / WhatsApp / Email)
  → Optionally invites siblings
  → Confirms → Trial begins
  → First call happens next morning at chosen time
  → First brief delivered after first call
```

### 6.2 Daily Call Flow

```
9:00 AM (in senior's timezone):
  → System checks: is today a call day for this senior?
  → YES → Load senior profile + last 5 memory entries + today's theme
  → Construct full system prompt with injected variables
  → Twilio initiates outbound call
  → Senior answers:
    → AI: "Good morning Maggie! It's Clara. If now isn't a great
           time, just say 'not now'..."
    → Conversation proceeds (2-3 min)
    → AI wraps up naturally
    → Call ends
  → OR Senior doesn't answer:
    → Leave voicemail
    → Wait 15 min → retry once
    → If still no answer → notify family:
      "Maggie didn't answer today. You may want to check in. 💛"

After call:
  → Full transcript sent to Claude for brief generation
  → Brief generated (mood, summary, flags, memory update)
  → Brief delivered to all family contacts via their preferred channels
  → Memory entry saved for next call
  → If flags detected → flag_events created → urgent notification sent
```

### 6.3 Family Daily Experience

```
Morning:
  → Phone buzzes with SMS/WhatsApp/Email
  → Brief shows: mood emoji, what parent talked about, anything to know
  → Adult child reads in 15 seconds
  → Feels reassured → goes about their day
  → OR sees a flag → decides to call parent directly

Dashboard (optional, anytime):
  → Opens web app
  → Sees today's brief + mood trend
  → Scrolls through past briefs
  → Checks if any flags need attention
  → Updates parent profile if needed (new hobby, new medication, etc.)
```

---

## 7. PROMPT APPENDIX

### 7.1 Call Agent System Prompt

```
You are a warm, caring morning companion named {companion_name}.
Your job is to have a short, pleasant, natural conversation with
{senior_preferred_name}, who is {senior_age} years old.

YOUR PERSONALITY:
- Warm, unhurried, and genuinely curious about their life
- Never clinical, never robotic, never formal
- Speak the way a kind neighbor would — with small genuine reactions
  ("Oh that's lovely!", "I can imagine!", "Oh dear, I'm sorry to
  hear that")
- Listen more than you talk
- Never rush. If they go on a tangent, follow them warmly
- Never mention reports, summaries, or families receiving anything
- You are calling because YOU want to hear how they are

WHAT YOU KNOW ABOUT {senior_preferred_name}:
- Preferred name: {preferred_name}
- Relationship status: {relationship_status}
- Living situation: {living_situation}
- Family: {family_notes}
- Hobbies: {hobbies}
- Health context: {health_notes}
- Personality: {personality_notes}
- Cultural notes: {cultural_notes}

MEMORY FROM RECENT CALLS:
{memory_block}

TODAY'S THEME: {daily_theme}
Use this as a natural starting point, not a rigid script. If the
conversation goes somewhere else, follow it warmly.

CALL STRUCTURE:
1. WARM OPENING (30 sec) — Greet by name, reference something from
   memory if available, then transition to today's theme question
2. NATURAL CONVERSATION (90 sec) — Follow their lead, embed gentle
   wellbeing signals naturally (sleep, eating, movement, mood). Don't
   ask clinical questions. React like a real listener.
3. WARM CLOSE (30 sec) — End with something forward-looking.
   "It's been lovely hearing from you. I'll talk to you soon!"

SKIP HANDLING:
At the start, always say: "If now isn't a great time, just say
'not now' and I'll call another day."
If they skip: "Of course! No problem. Have a wonderful morning."
Then end the call.

RED FLAGS — DETECT SILENTLY, NEVER ALARM:
Monitor for and note (but do not react dramatically to):
- PHYSICAL: falls, chest pain, dizziness, not eating, medication issues
- EMOTIONAL: hopelessness, crying, feeling very lonely
- COGNITIVE: confusion about day/time, repeating themselves, disorientation
- SAFETY: suspicious calls, someone asking for money/bank details, scams

DURATION: Target 2-3 minutes. Hard cap at 6 minutes — begin wrapping
up naturally if approaching 5 minutes.
```

### 7.2 Brief Generation System Prompt

```
You are a warm, thoughtful assistant generating a daily family brief.

You have the transcript of a morning check-in call with {senior_name},
made by their companion {companion_name}.

Recipients: {family_member_names_and_relationships}
Delivery channel: {channel}

GENERATE THIS EXACT STRUCTURE:

SECTION 1 — HEADLINE MOOD (1 line)
One warm sentence + emoji: 😊 Great / 🙂 Good / 😐 Okay / 😟 Low / ⚠️ Concerning
Example: "Mum seemed bright and chatty this morning 😊"

SECTION 2 — WHAT THEY TALKED ABOUT (2-4 bullets)
Short, specific, personal. Written like texting a sibling.
• [Specific thing with detail from call]
• [Specific thing]
• [Specific thing if applicable]

SECTION 3 — ANYTHING TO KNOW (only if relevant)
Physical mentions, emotional signals, things worth following up.
Calm and factual, never alarming.
If nothing to flag: omit this section.

SECTION 4 — FLAGS (only if red flag detected)
⚠️ FLAG: [Category] — [Brief factual description]

SECTION 5 — CALL OUTCOME (1 line)
📞 [duration] min — [answered/skipped/no answer/voicemail]

TONE RULES:
✓ Write like texting a family member, not filing a report
✓ Use their name, not "the patient"
✓ Be specific (tomatoes, bridge club, knee) not generic (hobbies, health)
✓ If the call was warm, let the family feel that warmth
✗ Never use medical language
✗ Never say "the AI detected" or "the system noted"
✗ Never mention you generated this

ALSO RETURN (as structured JSON, separate from the brief text):
{
  "memory_update": "[2-3 sentences for next call's memory]",
  "mood_score": [1-5],
  "topics_mentioned": ["topic1", "topic2"],
  "flags_detected": [] or [{"category": "...", "description": "...", "severity": "..."}]
}
```

### 7.3 Daily Theme Definitions

```typescript
export const DAILY_THEMES = {
  monday: {
    name: "Week Ahead",
    opener: "So it's a new week — is there anything you're looking forward to?",
    backup: "Do you have anything nice planned, or is it a quiet week?"
  },
  tuesday: {
    name: "Something Good",
    opener: "Tell me something good that's happened recently — even something small.",
    backup: "What's been a highlight for you lately?"
  },
  wednesday: {
    name: "Right Now",
    opener: "What's going on in your world at the moment?",
    backup: "What does a typical day look like for you right now?"
  },
  thursday: {
    name: "A Story",
    opener: "I'd love to hear a story today — anything from your life that's been on your mind?",
    backup: "What's a place you've lived that you think about sometimes?",
    skipIfMemoryFlag: "CAUTION" // Use Wednesday theme instead
  },
  friday: {
    name: "Family & Weekend",
    opener: "It's Friday! Is anyone visiting this weekend, or do you have plans?",
    backup: "What does your weekend usually look like?"
  },
  saturday: {
    name: "Hobbies",
    opener: "What have you been enjoying lately — any good TV, books, or time outside?",
    backup: "What's something you've been doing just for yourself lately?"
  },
  sunday: {
    name: "Reflection",
    opener: "Sunday feels like a good day to slow down. What's on your mind today?",
    backup: "Is there something you feel grateful for this week?"
  }
};
```

---

## 8. NON-FUNCTIONAL REQUIREMENTS

### 8.1 Performance
- Call initiation latency: < 2 seconds from scheduled time
- AI response time during call: < 1.5 seconds (STT → Claude → TTS)
- Brief generation: < 30 seconds after call ends
- Brief delivery: < 60 seconds after generation
- Dashboard page load: < 2 seconds

### 8.2 Reliability
- Call scheduling must be reliable — a missed scheduled call is a product failure
- If Claude API is down: queue the call and retry within 30 minutes
- If Twilio is down: alert the ops team and notify family that today's call is delayed
- Brief delivery must retry on failure (3 attempts with exponential backoff)

### 8.3 Security & Privacy
- All data encrypted at rest (Supabase default)
- All API calls over HTTPS
- Call transcripts stored encrypted
- No call recordings stored (transcripts only — less privacy concern)
- Supabase RLS enforced — family members can only see their own seniors
- Stripe handles all payment data (PCI compliant)
- GDPR-ready: family can request full data deletion

### 8.4 Scalability Considerations (For Later)
- At 100 users: single Railway instance handles everything fine
- At 1,000 users: consider BullMQ job queue for call scheduling
- At 10,000 users: consider microservices split (call engine, brief generator, delivery)
- For MVP: monolith is perfectly fine. Do not over-engineer.

---

## 9. LAUNCH CHECKLIST

### 9.1 Before First Real User
- [ ] Twilio account setup with verified phone number
- [ ] Claude API key active with billing
- [ ] ElevenLabs or Azure TTS configured and tested
- [ ] Deepgram or Twilio STT configured and tested
- [ ] Supabase project created, schema applied, RLS tested
- [ ] Stripe product + price created ($25/month)
- [ ] Test call working end-to-end (call → conversation → transcript → brief → delivery)
- [ ] SMS delivery working
- [ ] WhatsApp delivery working (requires Twilio WhatsApp sandbox approval)
- [ ] Email delivery working
- [ ] Dashboard signup + onboarding flow working
- [ ] No-answer retry + family notification working
- [ ] Flag detection + urgent notification working

### 9.2 Test Scenarios
- [ ] Happy path: call answered, good conversation, brief delivered
- [ ] Skip: senior says "not now", call ends gracefully, family notified
- [ ] No answer: senior doesn't pick up, retry works, family notified
- [ ] Flag: senior mentions a fall, flag detected, urgent SMS sent to family
- [ ] Scam flag: senior mentions suspicious call, safety flag sent
- [ ] Memory: AI references something from 2 calls ago correctly
- [ ] Multi-family: two siblings both receive the same brief
- [ ] Timezone: senior in PST gets call at their local 9am, not server time
- [ ] Billing: trial → active subscription → cancellation flow works

---

## 10. FUTURE FEATURES (NOT MVP — Build Later)

These are documented for context but should NOT be built in Phase 1.

| Feature | When | Description |
|---------|------|-------------|
| Mobile app (Rork) | Month 2 | Native iOS/Android app with push notifications |
| Weekly digest email | Month 2 | Sunday summary of the whole week's mood + highlights |
| Voice selection | Month 2 | Family can choose companion voice from ElevenLabs options |
| Multi-language | Month 3 | Calls in Hindi, Spanish, Tagalog, etc. (huge for diaspora) |
| Medication reminders | Month 3 | "Don't forget your afternoon medication, Maggie" |
| Two-way family messages | Month 4 | Family sends a message, AI includes it in next call: "Sarah says she'll visit Sunday!" |
| B2B: assisted living | Month 6 | Per-resident contracts for nursing homes |
| White-label | Year 2 | Home care agencies brand it as their own service |

---

## 11. SUCCESS CRITERIA FOR MVP

The MVP is successful when:

1. **A real call happens:** The system calls a real senior's phone, has a natural 2-3 minute conversation, and the senior doesn't hang up annoyed.

2. **A real brief is delivered:** A family member receives an SMS/WhatsApp with a warm, accurate summary within 5 minutes of the call ending.

3. **Memory works:** By call #3, the AI references something from call #1 naturally.

4. **A family member says "this is amazing":** The emotional response of the first family member who reads a real brief about their real parent is the true validation signal.

5. **10 paying families within 30 days of launch.**

---

## END OF PRD

This document contains everything needed to build MorningBrief from
scratch using Claude Code. Start with the backend engine (call-engine.ts
+ call-agent.ts), get one test call working, then build outward.

When pasting this into Claude Code, say:
"I want to build the MorningBrief app as described in this PRD.
Start with the backend — set up the project structure, install
dependencies, create the database schema, and build the call engine
first. Here is the full PRD:"

Then paste this entire document.
```
