# DewCall Design System

## Identity
Product: DewCall — AI morning companion for elderly parents
Audience: Adult children (40–60) checking on ageing parents
Aesthetic family: Warm Editorial
Tone: Trusted, caring, unhurried — like a good GP's waiting room, not a SaaS startup
Anti-examples: Corporate healthcare blue-white, Stripe-lookalike, glassmorphism,
               dark mode, startup-modern gradients, "wellness app" teal

## Color Tokens
--color-bg:        #FDFAF6   /* warm off-white — like good writing paper */
--color-surface:   #FFFFFF   /* card backgrounds */
--color-primary:   #4A7C6F   /* sage green — calm, trustworthy, natural */
--color-accent:    #E8956D   /* warm amber — alerts, highlights, CTAs */
--color-text:      #2D2D2D   /* soft black — never pure #000 */
--color-muted:     #8C8C8C   /* secondary text, captions */
--color-border:    #EDE8E0   /* subtle dividers */
--color-flag-bg:   #FEF3EC   /* flag alert background */
--color-flag-text: #C4521A   /* flag alert text */

## Typography
Display: 'Playfair Display' — page titles, mood headlines, emotional moments
Body:    'Inter' — all UI text, minimum 16px, line-height 1.6
Mono:    Not used

Type scale:
- Page title:   Playfair Display, 28px, weight 600
- Section head: Playfair Display, 20px, weight 500
- Body:         Inter, 16px, weight 400
- Caption:      Inter, 13px, weight 400, color --color-muted
- CTA button:   Inter, 15px, weight 500

## Spacing
Base unit: 4px. Use multiples: 4, 8, 12, 16, 24, 32, 48, 64
Section padding: 24px mobile, 48px desktop
Card padding: 20px

## Components
Cards: white bg, border-radius 12px,
       box-shadow: 0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)
       NO harsh shadows, NO borders
Buttons (primary): bg --color-primary, text white, border-radius 8px,
                   padding 12px 24px, NO uppercase
Buttons (secondary): transparent bg, 1.5px border --color-primary,
                     text --color-primary
Mood emojis: 48px on home page, 24px in history cards
Pills/chips: bg #F0F4F2, text --color-primary, border-radius 20px,
             padding 4px 12px, Inter 13px
Flags: bg --color-flag-bg, left border 3px solid --color-accent,
       border-radius 8px, padding 16px

## Layout
Navigation: Bottom tab bar on mobile, left sidebar on desktop (240px)
Max content width: 680px (reading width, never full-bleed on desktop)
Grid: single column mobile, sidebar + content desktop

## Motion
Subtle only. Page transitions: 150ms ease. Skeleton loading only.
NO bounces, NO dramatic reveals. This app is read at 7am by worried adults.

## Copy Rules
✓ "How Mum's doing" — never "Wellness Analytics"
✓ "Good to see you again" — never "Welcome back"
✓ "Your first brief arrives after tomorrow morning's call ☀️" — never "No data"
✓ Use senior's name (Maggie) — never "the patient" or "the user"
✓ Errors are calm and helpful, never alarming
✗ No "dashboard", "analytics", "metrics", "data" language anywhere