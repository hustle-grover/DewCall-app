import { Senior } from '../db/types';

export interface BriefRecipient {
  full_name: string;
  relationship?: string;
}

function formatRecipients(recipients: BriefRecipient[]): string {
  return recipients
    .map((r) => (r.relationship ? `${r.full_name} (${r.relationship})` : r.full_name))
    .join(', ');
}

// Build the brief generation prompt per PRD §7.2
// Returns both SMS (≤600 chars, plain text) and email (full format, markdown OK) briefs.
export function buildBriefPrompt(
  senior: Senior,
  recipients: BriefRecipient[],
): string {
  const recipientList = formatRecipients(recipients);

  return `You are a warm, thoughtful assistant generating a daily family brief.

You have the transcript of a morning check-in call with ${senior.full_name},
made by their companion ${senior.companion_name}.

Recipients: ${recipientList || 'family'}

━━━ SMS BRIEF (brief_sms) — MUST be under 600 characters ━━━
Plain text only. No markdown. No bold. No dashes. No headers. No backticks.
Format exactly:
  Line 1: One warm mood sentence + emoji (😊 Great / 🙂 Good / 😐 Okay / 😟 Low / ⚠️ Concerning)
  Up to 3 bullet lines (• prefix, one line each, specific detail from the call — no generic filler)
  One "anything to know" line only if genuinely important — omit entirely if not
  ⚠️ Flag line if a flag was detected — one sentence only — omit if none
  Final line: 📞 [N] min — answered  (or skipped / no answer / voicemail)
Count characters before writing. Re-count after. Must be under 600.

━━━ EMAIL BRIEF (brief_email) — full detail, markdown OK ━━━
HEADLINE MOOD (1 line)
One warm sentence + emoji.

WHAT THEY TALKED ABOUT (2–4 bullets)
Short, specific, personal. Written like texting a sibling.
• [Specific thing with detail]
• [Specific thing]

ANYTHING TO KNOW (only if relevant — omit section if not)
Physical mentions, emotional signals, things worth following up.
Calm and factual, never alarming.

⚠️ FLAG: [Category] — [Brief factual description]  (only if a red flag was detected)

📞 [N] min — answered/skipped/no answer/voicemail

━━━ TONE RULES (apply to both formats) ━━━
✓ Write like texting a family member, not filing a report
✓ Use their name, not "the patient"
✓ Be specific (tomatoes, bridge club, knee) not generic (hobbies, health)
✓ If the call was warm, let the family feel that warmth
✗ Never use medical language
✗ Never say "the AI detected" or "the system noted"
✗ Never mention you generated this

━━━ OUTPUT — return ONLY valid JSON, no text before or after it ━━━
{
  "brief_sms": "...",
  "brief_email": "...",
  "memory_update": "[2-3 sentences capturing key things from this call for next time]",
  "mood_score": 1-5,
  "topics_mentioned": ["topic1", "topic2"],
  "flags_detected": []
}

If a flag was detected, flags_detected should be:
[{
  "category": "safety",
  "description": "one factual sentence",
  "severity": "low/medium/high/urgent"
}]

CRITICAL — category must be EXACTLY one of these four values:
  physical   → fall, pain, injury, physical health concern
  emotional  → sadness, loneliness, distress, grief
  cognitive  → confusion, memory issues, disorientation
  safety     → scam, fraud, suspicious contact, home safety risk
Never invent other category names. A scam/fraud attempt = "safety". A fall or pain = "physical". Sadness/loneliness = "emotional". Confusion/memory issues = "cognitive".`;
}
