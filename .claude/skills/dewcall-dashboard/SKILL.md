---
name: dewcall-dashboard
description: >
  Master orchestrator for DewCall dashboard UI sessions.
  Activate automatically whenever building, editing, or
  reviewing any file inside src/dashboard/. Coordinates
  all design skills in the correct order.
---

# DewCall Dashboard Orchestrator

## Activate When
- Any work inside src/dashboard/
- Building new pages or components
- Reviewing or auditing existing dashboard code
- Adding routes, layouts, or UI elements

## Step 1 — Load Design Context (Every Session, First)
1. Read DESIGN.md at project root
2. Run /interface-design:init to load .interface-design/system.md
3. Confirm the brief card north star:
   "A printed letter, not a metric tile.
   Playfair Display salutation, senior's name
   as opener, thin left-rule in mood color."

## Step 2 — Before Writing Any UI Code
Invoke frontend-design skill:
- Declare the aesthetic direction for this session
- Confirm color tokens match DESIGN.md
- Confirm typography: Playfair Display headlines, Inter body, never swapped
- Confirm layout: brief is hero, sidebar same background as page, 680px max content width
- State one thing that will make this page feel warm and human, not like a SaaS tool

## Step 3 — While Building Each Component
Apply ui-ux-pro-max intelligence:
- Use "Warmth & Approachability" design direction
- Stack: React + Tailwind + shadcn/ui
- Every component declares its tokens before implementation (color, spacing, typography)
- No component hardcodes hex values — always use CSS variables from DESIGN.md

## Step 4 — Before Adding Any Motion or Interaction
Apply emil-design-eng rules:
- Ask: how frequently will users perform this action?
- Daily actions (reading brief, nav): subtle or no animation
- One-time actions (signup, onboarding): gentle entrance animation allowed
- Never animate keyboard-initiated actions
- Page transitions: 150ms ease maximum
- Loading: skeleton only, no spinners

## Step 5 — After Building Each Page
Run impeccable audit:
/impeccable audit <page-file-path>

Fix in priority order:
1. Anything that looks like generic AI output
2. Typography violations (wrong font, wrong weight)
3. Color violations (wrong tokens, hardcoded hex)
4. Spacing inconsistencies
5. Copy violations (clinical language, wrong tone)

## Step 6 — Final Quality Gate
Run Vercel web-design-guidelines check:
/web-design-guidelines <page-file-path>

Fix in priority order:
1. Accessibility violations (ARIA, focus states, labels, touch targets)
2. Semantic HTML issues
3. Keyboard navigation gaps
4. Reduced motion support

## Step 7 — Save New Patterns
After each page is approved, run:
/interface-design:extract <page-file-path>

This saves any new component patterns to .interface-design/system.md
so future sessions inherit them automatically.

## Non-Negotiable Rules (Apply Always)
- Background: #FDFAF6 everywhere — page AND sidebar
- Brief card = printed letter, never a metric tile
- Playfair Display for every headline and salutation
- Copy tone: texting a caring family member
- Empty states: warm and forward-looking, never "No data"
- No dark mode, no purple gradients, no clinical blue
- No "Dashboard", "Analytics", "Metrics" language
- Mobile-first on every component

## Skill Registry
- frontend-design → aesthetic direction before coding
- interface-design → session memory and consistency
- ui-ux-pro-max → component intelligence and tokens
- emil-design-eng → motion and interaction quality
- impeccable → post-build polish and audit
- web-design-guidelines → accessibility quality gate
