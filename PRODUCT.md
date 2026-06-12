# DewCall

## Product

**Type:** Family dashboard (authenticated web app)
**Register:** Product UI — design serves the task

A service that places a warm AI voice call to an elderly parent each morning, then delivers a plain-English brief about that call to their adult children via SMS / WhatsApp / Email.

**Buyer:** Adult child (40–60), checking in before work at 7am
**End user:** Elderly parent (senior) who receives the daily call

## Core task

The family member opens the app to read how Mum's morning went. In < 2 minutes they should feel informed and reassured — or appropriately concerned. Then they get on with their day.

## Tone

Warm, never clinical. Like a letter from a trusted friend, not a SaaS tool.
- "How Mum's doing" — never "Wellness Analytics"
- "Good to see you again" — never "Welcome back"
- Senior's first name always, never "the user" or "the patient"

## Design constraints

- Light mode only — this is read at 7am; no dark mode
- Mobile-first (many users check from bed/kitchen on phone)
- Max content width 680px (reading width)
- The morning brief card is always the hero — nothing above it
- Background: #FDFAF6 (warm off-white) everywhere including sidebar

## Stack

React + Vite + Tailwind CSS + Supabase Auth + Railway API

## Register

product
