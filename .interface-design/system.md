# Dewcall Design System

## Direction

**Personality:** Warmth & Approachability — editorial warmth, never clinical. Like a thoughtful morning newspaper or a letter from a trusted friend, not a SaaS dashboard.

**Who uses this:** Adult children (40–60) checking on an ageing parent at 7am before work. Mildly anxious. Want to scan quickly, feel reassured, and move on.

**Foundation:** warm — `#FDFAF6` base, never pure white or cold grey

**Depth:** subtle-shadows — soft lift only. `box-shadow: 0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)`. NO harsh shadows, NO borders on cards.

**Dark mode:** Never. Dewcall is a warm light-mode product.

## Tokens

### Spacing
Base: 4px
Scale: 4, 8, 12, 16, 24, 32, 48, 64
Section padding: 24px mobile, 48px desktop
Card padding: 20px

### Colors
```css
--color-bg:         #FDFAF6   /* warm off-white — writing paper */
--color-surface:    #FFFFFF   /* card backgrounds */
--color-primary:    #4A7C6F   /* sage green — calm, trustworthy, natural */
--color-primary-dk: #3D6B60   /* hover state for primary */
--color-accent:     #E8956D   /* warm amber — alerts, highlights, CTAs */
--color-text:       #2D2D2D   /* soft black — never pure #000 */
--color-muted:      #717171   /* secondary text — WCAG AA 4.70:1 on surface */
--color-border:     #EDE8E0   /* subtle dividers */
--color-chip-bg:    #EEF3F1   /* topic pill background */
--color-flag-bg:    #FEF3EC   /* flag section background */
--color-flag-text:  #C4521A   /* flag section text */

/* Mood-score rule — used as dynamic left-rule on BriefCard article only */
--color-mood-5: #4A7C6F   /* score 5 — very happy (matches primary) */
--color-mood-4: #6B9E92   /* score 4 — happy (light sage) */
--color-mood-3: #E8956D   /* score 3 — neutral (amber) */
--color-mood-2: #D4956D   /* score 2 — quiet (muted amber) */
--color-mood-1: #C4521A   /* score 1 — concerned (rust) */
```

**Never hardcode hex values.** Always reference tokens by name.

### Radius
Scale: 8px (buttons, inputs), 12px (cards), 16px (modals), 20px (pills/chips)

### Typography
Display font: Playfair Display — page titles, mood headlines, emotional moments, any headline that carries feeling
Body font: Inter — all UI text, minimum 16px, line-height 1.6
Mono: Not used

Scale:
- Page title: Playfair Display, 28px (1.75rem), weight 600
- Section head: Playfair Display, 20px, weight 500
- Body: Inter, 16px, weight 400, line-height 1.75
- Caption: Inter, 13px (text-xs), weight 400, color `--color-muted`
- CTA button: Inter, 16px, weight 500

**Rule:** Playfair Display for ALL emotional/headline moments. Inter for body and UI only. Never use Inter as a display font.

**Global text-wrap rules (in index.css base layer):**
- `h1, h2, h3 { text-wrap: balance }` — prevents awkward line breaks in headings
- `p { text-wrap: pretty }` — reduces orphans in prose

## Layout

Navigation: Bottom tab bar on mobile (64px, `bg-dew-surface`), left sidebar on desktop (240px)
Max content width: 680px — reading width, never full-bleed on desktop
Grid: single column mobile, sidebar + content desktop
Sidebar bg: same `--color-bg` as page — separated by a single `--color-border` line, no color shift
Auth pages: `min-h-[100dvh]` (not `min-h-screen` — iOS keyboard fix) + `py-8 overflow-y-auto`

## Patterns

### BriefCard (the signature component)

The brief reads like a printed letter — not a metric tile. It is the hero of every page that shows it. Nothing goes above it.

**Root element:** `<article aria-label="Morning brief for {seniorName}">`
- `bg-dew-surface rounded-card shadow-card overflow-hidden`
- `style={{ borderLeft: '3px solid var(--color-mood-N)' }}` — the mood stripe (see Exceptions below)
- `overflow-hidden` is critical — clips the mood stripe flush with the border-radius at corners

**Header zone:** `px-6 pt-6 pb-4`
```
flex items-start gap-4
  <span aria-hidden="true" class="text-5xl leading-none shrink-0">  ← emoji, decorative
  <h2 class="font-display text-xl font-semibold text-dew-text leading-snug mt-1 min-w-0">
    {moodHeadline}  ← this is the semantic mood conveyor, not the emoji
```

**Divider:** `<hr class="border-dew-border mx-6">`

**Brief body zone:** `px-6 py-5 font-body text-base text-dew-text leading-[1.75]`
- Paragraphs: plain `<p>` tags, space-y-3 between them
- Bullets: `flex gap-2.5` — `<span class="text-dew-primary text-[10px] shrink-0">●</span>` + `<span>` for text

**Topic chips zone:** `px-6 pb-4 flex flex-wrap gap-2` with `aria-label="Topics mentioned"`
- Each chip: `px-3 py-1 rounded-pill text-xs font-medium bg-dew-chip-bg text-dew-primary`

**Flag section:** (conditional — only when `flags_detected.length > 0`)
```
mx-6 mb-4 p-4 rounded-lg bg-dew-flag-bg
role="status" aria-live="polite"   ← NOT role="alert" — that fires on mount
  flex items-start gap-2.5
    <span aria-hidden="true">💛</span>   ← leading icon, sets emotional register
    <p class="text-sm font-semibold text-dew-flag-text">Something to keep in mind</p>
    <ul class="mt-1.5 space-y-1">
      <li class="text-sm text-dew-text">...</li>
```

**Divider + Footer:** `px-6 py-3 flex items-center justify-between gap-4`
- Left: `flex items-center gap-1.5 text-xs text-dew-muted` — Phone icon (12px, aria-hidden) + metadata string
- Right: transcript toggle button (conditional)

**Transcript toggle button:**
```
text-xs text-dew-primary hover:text-dew-primary-dk
focus:outline-none focus-visible:ring-2 focus-visible:ring-dew-primary focus-visible:ring-offset-1 rounded
transition-colors shrink-0
py-2 px-1 -my-2 -mx-1   ← expands tap target to 44px without changing visual size
aria-expanded={bool} aria-controls="transcript-panel"
```
- ChevronDown/Up icons are `aria-hidden="true"`

**Transcript panel:** `id="transcript-panel"` `px-6 pb-6`
- Inner: `bg-dew-bg rounded-lg border border-dew-border p-4 text-sm whitespace-pre-wrap`

### BriefSkeleton

Same card shell as BriefCard: `bg-dew-surface rounded-card shadow-card overflow-hidden animate-pulse`
- `aria-hidden="true"` — hidden from screen readers entirely
- Inner div uses `border-l-[3px] border-dew-border` to hold the left-indent shape during loading
- All skeleton blocks use `bg-dew-border` — the neutral border color, never a colored accent

### EmptyState (generic pattern, used across pages)

```
bg-dew-surface rounded-card shadow-card p-10 text-center
  <div role="img" aria-label="...">  ← large emoji (text-5xl mb-4)
  <h2 class="font-display text-xl font-semibold text-dew-text mb-2">
  <p class="font-body text-base text-dew-muted leading-relaxed max-w-xs mx-auto">
```
- Copy follows the product tone: warm, specific, time-aware. Never "No data available."
- Emoji inside a following `<p>` tag: wrap in `<span aria-hidden="true">` if decorative

**Page-level empty state examples:**
| Page | Emoji | Heading | Body |
|------|-------|---------|------|
| DailyBrief | ☀️ | Nothing yet this morning | Your first brief arrives after tomorrow morning's call |
| BriefHistory | 🌅 | Your call history will live here | After the first few mornings, you'll be able to look back… |
| MoodTrends | 🌱 | Patterns take a little time | Over the coming weeks, you'll be able to see… |
| ParentProfile | 👩‍🦳 | Mum's profile lives here | Her name, call time, interests… |
| Settings | ⚙️ | Your preferences | Call times, delivery preferences… |

### Card Default
- Background: `--color-surface`
- Border-radius: 12px
- Shadow: `0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)`
- Padding: 20px
- NO border, NO harsh divider

### Button Primary
- Background: `--color-primary`, hover: `--color-primary-dk`
- Text: white, Inter 16px weight 500
- Border-radius: 8px
- Padding: `py-3` full-width (auth), `py-2 px-4` inline
- NO uppercase
- Focus: `focus:outline-none focus-visible:ring-2 focus-visible:ring-dew-primary focus-visible:ring-offset-2`
- Disabled: `opacity-60`

### Button Secondary
- Background: transparent
- Border: 1.5px solid `--color-primary`
- Text: `--color-primary`

### Input / Form Field
```
w-full px-4 py-2.5 rounded-button
border border-dew-border bg-dew-bg
text-dew-text placeholder:text-dew-muted
focus:outline-none focus:border-dew-primary
focus-visible:ring-2 focus-visible:ring-dew-primary focus-visible:ring-offset-1
transition-colors
```
- Always paired with a `<label htmlFor="...">` in `text-sm font-medium text-dew-text mb-1.5`
- Error state: `role="alert"` div using `text-dew-flag-text bg-dew-flag-bg rounded-lg p-3` — NO side-stripe border

### Mood Display
- BriefCard: 48px emoji (`text-5xl`), `aria-hidden="true"` (h2 conveys mood semantically)
- History cards (future): 24px emoji

### Pills / Chips
- Background: `--color-chip-bg` (`#EEF3F1`)
- Text: `--color-primary`
- Border-radius: 20px (`rounded-pill`)
- Padding: `px-3 py-1`
- Inter `text-xs font-medium`

### HistoryCard (BriefHistory)

Compact history entry — same structural family as BriefCard but condensed for timeline use.

**Root element:** `<article aria-label="Brief for {seniorName}" class="bg-dew-surface rounded-card shadow-card overflow-hidden">`
- `style={{ borderLeft: '3px solid {moodColor}' }}` — same mood-stripe exception as BriefCard (see Exceptions)

**Header zone:** `px-5 pt-5 pb-3`
```
flex items-start gap-3
  <span aria-hidden="true" class="text-3xl leading-none shrink-0 mt-0.5">  ← mood emoji, decorative
  <div class="flex-1 min-w-0">
    <h3 class="font-display text-base font-semibold text-dew-text leading-snug">  ← moodHeadline
    <div class="mt-1 flex items-center gap-1.5 text-xs text-dew-muted">
      <Phone size={11} aria-hidden="true" />
      <span>{callTime} · {answered} · {duration}</span>
  {hasFlags && <span class="text-sm shrink-0" aria-label="Flags noted">⚠️</span>}
```

**Brief body:** `px-5 pb-3 font-body text-sm text-dew-text leading-[1.65]` + expand/collapse
- Collapsed: first 2 lines; "Read more" / "Show less" toggle
- Toggle button: `text-xs font-medium text-dew-primary flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-dew-primary`
- `aria-expanded={bool}` on toggle button

**Topic chips:** `px-5 pb-4 flex flex-wrap gap-1.5` — identical to BriefCard chips

**Date group label** (above each day's group in BriefHistory):
```
<p class="text-sm font-body font-medium text-dew-muted mb-3">
  {dateLabel}   ← "Today", "Yesterday", "Thursday, 29 May"
```
**DO NOT** add `uppercase tracking-wide` — that is the absolute-banned eyebrow pattern.

---

### DeliveryChannelPicker

Reusable component at `src/components/DeliveryChannelPicker.tsx`. Used in Onboarding step 4 and Settings.

```
<div class="grid grid-cols-2 gap-3">
  {DELIVERY_CHANNELS.map(ch =>
    <button
      type="button"
      aria-pressed={value === ch.id}
      class="flex items-start gap-3 p-4 rounded-card border-[1.5px] text-left
             transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-dew-primary
             [selected]: border-dew-primary bg-dew-chip-bg
             [default]:  border-dew-border bg-dew-surface hover:border-dew-primary/40"
    >
      <span aria-hidden="true" class="text-xl leading-none shrink-0 mt-0.5">{ch.icon}</span>
      <div>
        <p class="font-body text-sm font-semibold text-dew-text">{ch.title}</p>
        <p class="font-body text-xs text-dew-muted mt-0.5">{ch.desc}</p>
      </div>
    </button>
  )}
</div>
```
- `aria-pressed` (not `aria-selected`) — these are toggle buttons, not a listbox
- 2×2 grid, icon + title + description layout

---

### Onboarding Wizard

Full-page step-by-step flow. `min-h-[100dvh]` layout (not inside the App layout shell).

**Container:** `min-h-[100dvh] bg-dew-bg flex flex-col items-center justify-center px-4 py-8 overflow-y-auto`
**Inner width:** `max-w-[560px] w-full` (narrower than content max — wizard is intimate, not wide)

**Progress dots:**
```
<div role="progressbar"
     aria-label="Setup progress"          ← stable label naming the widget
     aria-valuenow={step + 1}
     aria-valuemin={1}
     aria-valuemax={TOTAL_STEPS}
     aria-valuetext={`Step ${step + 1} of ${TOTAL_STEPS}`}   ← human-readable current value
     class="flex gap-2 justify-center mb-10"
>
  {dots}: w-2 h-2 rounded-full
    active:   bg-dew-primary
    visited:  bg-dew-primary/40
    upcoming: bg-dew-border
```

**Step heading block:** `mb-6 text-center`
- `<h1 class="font-display text-[1.75rem] font-semibold text-dew-text leading-snug">`
- `<p class="mt-2 font-body text-base text-dew-muted">` subtext (optional)

**Step card:** `bg-dew-surface rounded-card shadow-card p-6 space-y-4` (all steps except final summary)

**Navigation footer:** `flex justify-between items-center mt-8`
- Back: `text-sm text-dew-muted hover:text-dew-text` (hidden on step 0)
- Continue: primary button `px-6 py-2.5 rounded-button` — `disabled:opacity-40` when step validation fails

**Final summary step (step 6):**
- `text-center space-y-6` — no card wrapper, summary dl inside `bg-dew-surface rounded-card`
- `<dl>` with `<div class="flex justify-between text-sm font-body">` rows
- Submit button is full-width inside the step content, no separate nav footer

---

### MoodTrends StatCard

Warm summary figures — NOT KPI tiles. Semantic alternatives to the hero-metric template.

```
<div class="bg-dew-surface rounded-card shadow-card p-5">
  <p class="font-body text-xs text-dew-muted mb-1.5">{label}</p>
  <p class="font-body text-base text-dew-text">
    <span class="mr-1" aria-hidden="true">{moodEmoji}</span>
    {moodLabel} on average    ← full sentence, not a bare number
  </p>
</div>
```
- Grid: `grid-cols-1 sm:grid-cols-3 gap-4` — **must be responsive**; `grid-cols-3` breaks on 375px phones
- `text-xs` label + `text-base` warm sentence: this is NOT the banned hero-metric template
- Hero-metric ban = big number + small label + gradient. StatCard uses prose text, no numbers.

**recharts theming note:**
Recharts SVG attrs (`stroke`, `fill`, `tick.fill`) cannot consume CSS custom properties — they require literal hex values. The values `#4A7C6F` (primary), `#EDE8E0` (border), `#717171` (muted) are hardcoded by necessity. This is a documented P2 theming limitation, not a token violation. Keep in sync with token changes manually.

---

### Section Divider (ParentProfile / Settings)

Groups of related form fields separated by a horizontal rule + section heading. **No nested cards.**

```html
<hr class="border-dew-border my-8" />  (or mb-6 inside a div wrapper)
<h2 class="font-display text-lg font-semibold text-dew-text mb-5">
  {sectionTitle}
</h2>
```
- Section content: `space-y-4` block of inputs below the h2
- Heading hierarchy: page uses `<h1>`, sections use `<h2>` — maintained throughout
- Use `<hr>` + `<h2>` **not** a card wrapper — nested cards are always wrong

---

## Exceptions to the Side-Stripe Absolute Ban

The impeccable absolute ban prohibits `border-left > 1px` as a colored accent on cards, list items, callouts, or alerts. **One documented exception:**

**BriefCard and HistoryCard mood stripe** — `style={{ borderLeft: '3px solid var(--color-mood-N)' }}` on the `<article>` element. Permitted because:
1. It carries semantic data (the mood score), not decoration. The color is drawn from the mood-score color system.
2. It is applied to the outermost article, clipped by `overflow-hidden` on the card — not a child element creating a visual accent inside the card.
3. Consistent across both BriefCard (DailyBrief) and HistoryCard (BriefHistory) — product signature, not one-off decoration.

All other side-stripe borders — on callouts, alerts, error messages, flag sections, list items — are banned. The flag section specifically uses `bg-dew-flag-bg` + leading 💛 emoji instead.

## Motion
Subtle only. Page transitions: 150ms ease. Skeleton loading only.
No bounces, no dramatic reveals. This is read at 7am by worried adults.
Prefers-reduced-motion handled globally in index.css: `animation-duration: 0.01ms` for all animations.

## Accessibility Baselines
- All icon-only buttons: `aria-label` required
- Decorative emojis inside text: `<span aria-hidden="true">`
- Emoji conveying meaning: `role="img" aria-label="descriptive label"`
- Mood emoji in BriefCard: `aria-hidden="true"` — the adjacent h2 conveys mood fully
- Async flag sections: `role="status" aria-live="polite"` (not `role="alert"`)
- Transcript toggle: `aria-expanded` + `aria-controls` required
- All inputs: `focus-visible:ring-2` (not `focus:ring`) — keyboard-only focus indicator
- Locale: use `undefined` (browser locale) in `toLocaleDateString` / `toLocaleTimeString`, never hardcode `'en-GB'`

## Copy Rules
✓ "How Mum's doing" — never "Wellness Analytics"
✓ "Good to see you again" — never "Welcome back"
✓ "Your first brief arrives after tomorrow morning's call ☀️" — never "No data"
✓ Use senior's name (Maggie) — never "the patient" or "the user"
✓ Errors are calm and helpful, never alarming
✗ No "dashboard", "analytics", "metrics", "data" language anywhere
✗ No medical/clinical terms (patient, wellness data)
✗ No uppercase button text

## Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Warm off-white `#FDFAF6` as base, not white | Matches product tone — writing paper, not clinical white. Reduces eye strain at 7am. | 2026-06-11 |
| Subtle shadows, no card borders | Warmth requires softness. Borders feel clinical. The product should feel like paper, not a spreadsheet. | 2026-06-11 |
| Playfair Display for headlines | Serif editorial warmth vs Inter's corporate neutrality. Signals this is a human product, not a SaaS tool. | 2026-06-11 |
| Brief card as full-width hero | The brief IS the product. Everything else is secondary. No KPI tiles above the fold. | 2026-06-11 |
| Sidebar same bg as page | Preventing "sidebar world" vs "content world" fragmentation. One warm space, not a control panel. | 2026-06-11 |
| Sage green primary, not blue | Blue reads as corporate/health-tech. Sage reads as natural, calm, trustworthy — like a kitchen herb garden. | 2026-06-11 |
| Mood emoji `aria-hidden` on BriefCard | h2 immediately adjacent already fully describes the mood ("Mum was in good spirits"). Emoji is decorative in context. Screen readers don't need it twice. | 2026-06-12 |
| Flag section: bg-tint + 💛 icon, no side-stripe | Side-stripe on callout is the impeccable absolute ban. Warm bg + leading emoji provides the alert register without the banned pattern. `role="status"` not `role="alert"` — avoids firing on initial mount. | 2026-06-12 |
| `--color-muted` darkened `#8C8C8C` → `#717171` | Original value gave 3.23:1 on warm bg — fails WCAG AA (4.5:1). New value gives 4.70:1 on surface, 4.89:1 on white. | 2026-06-12 |
| Locale `undefined` not `'en-GB'` in date formatters | Hardcoded locale violates web-design-guidelines; users in different regions see their own date format. | 2026-06-12 |
| Date group labels in BriefHistory: `text-sm font-medium text-dew-muted`, NOT `uppercase tracking-wide` | `uppercase tracking-wide text-xs` is the absolute-banned eyebrow pattern, regardless of content. Dates use the same small-weight muted style. | 2026-06-12 |
| MoodTrends stat cards: `grid-cols-1 sm:grid-cols-3` | `grid-cols-3` without breakpoint breaks on 375px phones (~109px per card). Always use responsive prefix. | 2026-06-12 |
| Onboarding progressbar: `aria-label` stable + `aria-valuetext` for current value | `aria-label` names the widget ("Setup progress"). `aria-valuetext` conveys current state ("Step 3 of 7"). Mutating `aria-label` with step state creates confusing screen reader re-announcements. | 2026-06-12 |
| Recharts hex values hardcoded: P2, documented exception | recharts SVG `stroke`/`fill`/`tick.fill` cannot consume CSS custom properties. Values must be kept manually in sync with token changes. | 2026-06-12 |
| HistoryCard mood stripe: same exception as BriefCard | Both cards display mood-scored content; the stripe carries semantic data in both. Exception extends to all `<article>` elements that render a mood score. | 2026-06-12 |
