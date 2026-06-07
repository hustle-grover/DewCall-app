/**
 * test-brief.ts — generate a brief from a hardcoded sample transcript.
 *
 * Usage: npx ts-node scripts/test-brief.ts
 *
 * Inserts a test call_log row, runs generateBrief(), prints the brief text
 * and metadata. Requires the server env (SUPABASE_*, ANTHROPIC_API_KEY).
 */

import { supabaseAdmin } from '../src/server/db/supabase';
import { generateBrief } from '../src/server/services/brief-generator';

// Sample transcript: warm conversation + a safety flag (neighbour bank scam attempt)
const SAMPLE_TRANSCRIPT = `Clara: Good morning, Maggie! This is Clara calling. I hope I've caught you at a good time — how are you doing today?
Senior: Oh, Clara! How lovely to hear from you. I'm doing alright, yes. A bit slow getting going this morning but I'm up.
Clara: I'm glad you're up and about! How did you sleep?
Senior: Not too bad, not too bad. My knee was aching a bit in the night but it's feeling much better this morning actually.
Clara: Oh I'm glad the knee is feeling better today. Are you keeping up with those little walks you mentioned?
Senior: I try! I went to the end of the garden yesterday and back. The tomatoes are absolutely coming along, Clara. Big red ones. I'll have to make sauce soon.
Clara: How wonderful — homemade tomato sauce from your own garden! That sounds like a real treat.
Senior: It is, it is. Oh, and I almost forgot — that nice lady from next door, Mrs. Patterson, she rang me yesterday. Said she'd heard about some scheme where they help people check their bank account. Wanted my sort code. I said I wasn't sure about that.
Clara: That was very wise of you, Maggie. It's always best not to give out bank details over the phone — that does sound like it could be a scam. You did exactly the right thing.
Senior: That's what I thought. I didn't give her anything. My son always says never give out numbers over the phone.
Clara: Your son is absolutely right. You were smart to trust your instincts there. How is your son these days, is he visiting soon?
Senior: He might come down next weekend, fingers crossed. He's been so busy with work.
Clara: That would be lovely! Something nice to look forward to. Well Maggie, it's been such a pleasure chatting with you this morning.
Senior: Oh yes, lovely as always. You do brighten my day, Clara.
Clara: You brighten mine too! Have a beautiful day, and enjoy those tomatoes. Talk soon!
Senior: Goodbye dear, thank you!`;

async function main() {
  // Find the test senior
  const { data: senior, error: seniorErr } = await supabaseAdmin
    .from('seniors')
    .select('id, full_name, preferred_name')
    .ilike('full_name', '%Maggie%')
    .single();

  if (seniorErr || !senior) {
    console.error('Could not find test senior (Maggie). Run: npx ts-node src/server/db/seed.ts\n', seniorErr?.message);
    process.exit(1);
  }

  console.log(`Using senior: ${senior.full_name as string} (${senior.id as string})`);

  // Insert a test call_log with the sample transcript
  const { data: callLog, error: insertErr } = await supabaseAdmin
    .from('call_logs')
    .insert({
      senior_id: senior.id as string,
      call_sid: `test-brief-${Date.now()}`,
      call_date: new Date().toISOString().split('T')[0],
      call_time_utc: new Date().toISOString(),
      outcome: 'answered',
      duration_seconds: 185,
      daily_theme: 'Morning Check-in',
      transcript: SAMPLE_TRANSCRIPT,
      mood_score: null,
      topics_mentioned: null,
      flags_detected: [],
      memory_update: null,
      brief_text: null,
      brief_delivered: false,
      brief_delivered_at: null,
      brief_delivery_channels: null,
    })
    .select('id')
    .single();

  if (insertErr || !callLog) {
    console.error('Failed to insert test call_log:', insertErr?.message);
    process.exit(1);
  }

  const callLogId = callLog.id as string;
  console.log(`Inserted test call_log: ${callLogId}`);
  console.log('Generating brief (claude-sonnet-4-6)...\n');

  try {
    const result = await generateBrief(callLogId);

    console.log('=== SMS BRIEF (sent via Twilio) ===');
    console.log(result.briefText);
    console.log(`\nSMS length: ${result.briefText.length} chars (limit: 600) ${result.briefText.length > 600 ? '⚠️ OVER LIMIT' : '✓'}`);

    console.log('\n=== EMAIL BRIEF (dashboard format) ===');
    console.log(result.briefEmail);

    console.log('\n=== METADATA ===');
    console.log(JSON.stringify({
      mood_score: result.moodScore,
      topics: result.topicsMentioned,
      flags: result.flagsDetected,
      memory_update: result.memoryUpdate,
    }, null, 2));
    if (result.flagsDetected.length > 0) {
      console.log(`\n⚠️  ${result.flagsDetected.length} flag(s) detected and saved to flag_events table`);
    }
  } catch (err) {
    console.error('Brief generation failed:', err);
    process.exit(1);
  }

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
