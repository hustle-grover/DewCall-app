# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current State

**Sessions 1–11 are complete.** The backend is fully built and deployed to Railway. This includes: TypeScript monolith scaffolded, Supabase schema applied, call pipeline (`call-scheduler`, `call-engine`, `call-agent`, `brief-generator`, `brief-delivery`, `flag-handler`) implemented, REST API routes with Supabase RLS auth middleware, and Railway deployment config. The GitHub repo is `hustle-grover/DewCall-app` on `main`. **Session 12 starts the dashboard** (`/src/dashboard` — React + Vite + Tailwind).

The primary spec is `Dewcall-PRD.md`. Treat it as the source of truth for architecture, data model, API surface, and the exact LLM system prompts. `DESIGN.md` is the source of truth for all frontend visual decisions.

**The app is named Dewcall.** "MorningBrief" was an earlier working title used while writing the PRD — it is obsolete. Use **Dewcall** everywhere: package name, user-facing strings, `APP_URL`, env naming, etc. The spec's filename was renamed to `Dewcall-PRD.md`, but its *body text* still says "MorningBrief" throughout — read it as "Dewcall."

## What This Product Is

A service that places a warm AI voice call to an elderly parent each morning, then delivers a plain-English brief about that call to their adult children via SMS / WhatsApp / Email. Buyer (adult child) and end user (senior) are different people — a B2C2F model. The emotional tone ("warm, never clinical") is a hard product requirement, not a nicety; it governs the LLM prompts, the brief copy, and the dashboard UI language (say "How Mum's doing", never "Wellness Analytics").

## Architecture (target, per PRD)

A single Node 20+ / TypeScript monolith — **do not split into microservices for the MVP** (§8.4). Two deployable halves under `/src`:

- `/src/server` — Express/Fastify API + the call/brief pipeline. This is the heart of the product.
- `/src/dashboard` — React + Vite + Tailwind family web app.

### The call → brief pipeline (the core loop)

This chain is what the whole product hinges on; understand it before touching any service:

1. **`call-scheduler.ts`** — cron runs every minute, queries `seniors` for anyone whose local `call_time` matches now and whose `call_frequency` includes today. Timezone correctness is critical: a senior in PST must be called at *their* 9am, never server time. A missed scheduled call is defined as a product failure. On no-answer: retry once after 15 min; if still unanswered, mark the call `no_answer` and notify family ("…didn't answer today. You may want to check in. 💛"). Per PRD §4.1.1 / §4.3.2.
2. **`call-engine.ts`** — orchestrates one call: loads senior profile + last 5 `memory_entries` + today's theme, builds the system prompt, initiates the Twilio outbound call, manages the real-time loop, persists the transcript to `call_logs`.
3. **`call-agent.ts`** — the live conversation. STT (Deepgram/Twilio) → Claude (call system prompt) → TTS (ElevenLabs/Azure) → Twilio audio, looping until Claude signals the close. Target 2–3 min, hard cap 6 min.
4. **`brief-generator.ts`** — after the call, sends the transcript to Claude with the brief prompt. Returns the human brief text **plus** structured JSON: `memory_update`, `mood_score` (1–5), `topics_mentioned[]`, `flags_detected[]`. Writes to `call_logs`, `memory_entries`, and (if flagged) `flag_events`.
5. **`brief-delivery.ts`** — sends the brief to every linked family member on their chosen channel(s). Normal briefs ≤5 min after call; flag briefs immediately; urgent (safety/physical) flags also fire a separate SMS regardless of channel preference. Retry 3× with exponential backoff.
6. **`flag-handler.ts`** — escalates red flags into `flag_events` and triggers urgent notifications.

### Memory system (continuity)

This is what makes the AI feel like it "remembers." Each call's `memory_update` (2–3 sentences) is stored in `memory_entries`; the next call injects the last 5 entries into the call system prompt's `[MEMORY_BLOCK]`. Cap 10 per senior — archive the oldest, never delete. Success criterion: by call #3 the AI references something from call #1 naturally.

### Prompts are product surface, not config

The exact call and brief system prompts live in `Dewcall-PRD.md` §7.1/§7.2 and belong in `/src/server/prompts/`. The 7-day theme rotation (`daily-themes.ts`) is in §7.3 — Thursday's "A Story" theme must be skipped (use Wednesday's) when a senior's `memory_flag = 'CAUTION'`, because cognitive-concern seniors shouldn't be pushed on memory recall. Changes to these prompts change product behavior; treat them as carefully as code.

## Data Model Notes

Full schema in `Dewcall-PRD.md` §3.1. Key relationships and rules:

- A **senior** can have multiple **family members** via the `family_senior_links` join table (siblings share briefs). One senior = one subscription.
- **Supabase Row Level Security is the authorization boundary** — family members may only ever see seniors linked to them. RLS policies are defined in the schema; do not bypass them with the service-role key in user-facing request paths. The service-role key is for the backend pipeline (scheduler, brief writer) only.
- No call audio is stored — transcripts only, by design (privacy).
- `subscription_status` and `memory_flag` are CHECK-constrained enums; keep app-level types in sync with the DB constraints.

## Commands

- `npm run dev` — start server with hot reload (ts-node-dev, port 3000)
- `npm run build` — compile TypeScript → `dist/`
- `npm start` — run compiled server (`node dist/server/index.js`)
- `curl http://localhost:3000/health` — verify server is up

Scripts added in later sessions (not yet runnable):
- `npx ts-node scripts/test-call.ts <senior-id>` — trigger a live test call (Session 6)
- `npx ts-node scripts/test-brief.ts` — generate a brief from a sample transcript (Session 7)
- `npx ts-node src/server/db/seed.ts` — seed test family + senior data (Session 2)
- Dashboard dev: `cd src/dashboard && npm run dev` (Session 12, Vite on port 5173)

## External Services & Config

Config is env-driven (`/src/server/utils/config.ts`); the full list is in `Dewcall-PRD.md` §2.3 / `.env.example`. The app cannot do anything meaningful without: Supabase (DB + auth), Anthropic, Twilio (voice + SMS + WhatsApp), ElevenLabs (TTS), Deepgram (STT), Resend (email), Stripe (billing). **Model IDs:** the PRD pins `claude-sonnet-4-20250514`, which is outdated — use the current `claude-sonnet-4-6` instead. Consider splitting models by stage: a fast model (e.g. Haiku) for the latency-bound live call loop (§8.1 budgets <1.5s STT→Claude→TTS), and a stronger Sonnet/Opus model for brief generation where quality matters more than speed. Webhook endpoints (`/webhooks/twilio/*`, `/api/billing/webhook`) are called by Twilio/Stripe, not the frontend, and need a publicly reachable always-on host (Railway/Render) — serverless/cron-less platforms won't satisfy the per-minute scheduler.

## Build Order (PRD's recommendation)

Backend first: scaffold → apply schema → get `call-engine.ts` + `call-agent.ts` working for one real test call → then brief generation → then delivery → then build the dashboard outward. Get one real call working end-to-end before broadening.

## Frontend Design Rules

ALWAYS read DESIGN.md before writing any frontend code.
Run /impeccable after building each page.
Run /interface-design:init at the start of each dashboard session.

NEVER use:
- Generic color schemes (purple gradients, clinical white-blue, teal wellness)
- Inter as display font (body only — Playfair Display for all headlines)
- Harsh drop shadows or heavy borders on cards
- "Dashboard", "analytics", "metrics", "data" language in copy
- Medical/clinical terms (patient, user, wellness data)
- Generic empty states ("No data available", "Nothing here yet")
- Uppercase button text
- Dark mode (DewCall is a warm light-mode product)

ALWAYS:
- Reference DESIGN.md tokens by name, never hardcode hex values
- Use Playfair Display for all emotional/headline moments
- Write copy as if texting a caring family member
- Mobile-first — check mobile layout before desktop
- Keep max content width 680px on desktop
- Declare design choices before writing each component