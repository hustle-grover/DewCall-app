import Anthropic from '@anthropic-ai/sdk';
import { config } from '../utils/config';
import { supabaseAdmin } from '../db/supabase';
import { buildBriefPrompt, BriefRecipient } from '../prompts/brief-system-prompt';
import { saveMemoryEntry } from './memory-store';
import { processFlags } from './flag-handler';
import { getSeniorLocalDate } from '../utils/timezone';
import { logger } from '../utils/logger';
import type { Senior, DetectedFlag } from '../db/types';

const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

export interface BriefResult {
  briefText: string;   // SMS version (≤600 chars) — stored in call_logs.brief_text
  briefEmail: string;  // Full email version — logged for now; needs DB column when dashboard is built
  moodScore: number;
  topicsMentioned: string[];
  flagsDetected: DetectedFlag[];
  memoryUpdate: string;
}

export async function generateBrief(callLogId: string): Promise<BriefResult> {
  // 1. Load call_log
  const { data: callLog, error: callLogErr } = await supabaseAdmin
    .from('call_logs')
    .select('*')
    .eq('id', callLogId)
    .single();

  if (callLogErr || !callLog) {
    throw new Error(`Call log not found: ${callLogId}`);
  }
  if (!callLog.transcript) {
    throw new Error(`Call log ${callLogId} has no transcript — cannot generate brief`);
  }

  // 2. Load senior
  const { data: senior, error: seniorErr } = await supabaseAdmin
    .from('seniors')
    .select('*')
    .eq('id', callLog.senior_id)
    .single();

  if (seniorErr || !senior) {
    throw new Error(`Senior not found for call log ${callLogId}`);
  }

  // 3. Load linked family members who receive briefs
  const { data: links, error: linksErr } = await supabaseAdmin
    .from('family_senior_links')
    .select('family_member_id, relationship')
    .eq('senior_id', callLog.senior_id)
    .eq('receives_briefs', true);

  if (linksErr) {
    logger.error('Failed to load family links', { callLogId, error: linksErr });
    throw linksErr;
  }

  const familyMemberIds = (links ?? []).map((l: { family_member_id: string }) => l.family_member_id);

  let recipients: BriefRecipient[] = [];
  if (familyMemberIds.length > 0) {
    const { data: members } = await supabaseAdmin
      .from('family_members')
      .select('id, full_name')
      .in('id', familyMemberIds);

    recipients = (members ?? []).map((m: { id: string; full_name: string }) => {
      const link = (links ?? []).find((l: { family_member_id: string }) => l.family_member_id === m.id);
      return { full_name: m.full_name, relationship: link?.relationship };
    });
  }

  // 4. Build prompt and call Claude (Sonnet for quality)
  const promptText = buildBriefPrompt(senior as Senior, recipients);

  logger.info('Generating brief', {
    callLogId,
    seniorId: callLog.senior_id,
    transcriptLength: (callLog.transcript as string).length,
    recipientCount: recipients.length,
  });

  let responseText: string;
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: promptText,
      messages: [{ role: 'user', content: `TRANSCRIPT:\n${callLog.transcript}` }],
    });
    responseText = response.content[0].type === 'text' ? response.content[0].text : '';
  } catch (err) {
    logger.error('Claude brief generation failed', { callLogId, error: err });
    throw err;
  }

  // 5. Parse response — the prompt now returns ONLY a JSON object
  let briefText = '';    // brief_sms — goes to call_logs.brief_text and SMS/WhatsApp delivery
  let briefEmail = '';   // brief_email — richer format for dashboard (needs DB column in future)
  let moodScore = 3;
  let topicsMentioned: string[] = [];
  let flagsDetected: DetectedFlag[] = [];
  let memoryUpdate = '';

  const jsonMatch = responseText.match(/\{[\s\S]*"brief_sms"[\s\S]*\}/);
  let parsed: Record<string, unknown> = {};

  if (jsonMatch) {
    try {
      parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    } catch {
      // One retry: ask Claude to return only the JSON
      logger.warn('JSON parse failed — retrying extraction', { callLogId });
      try {
        const retry = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 600,
          system: 'Return only the JSON object, no other text.',
          messages: [{ role: 'user', content: `Extract and return only the JSON from:\n${responseText}` }],
        });
        const retryText = retry.content[0].type === 'text' ? retry.content[0].text : '{}';
        const retryMatch = retryText.match(/\{[\s\S]*\}/);
        if (retryMatch) parsed = JSON.parse(retryMatch[0]) as Record<string, unknown>;
      } catch {
        logger.warn('JSON retry also failed — using defaults', { callLogId });
      }
    }
  } else {
    logger.warn('No JSON block found in brief response — using full response as SMS brief', { callLogId });
    briefText = responseText.slice(0, 597) + (responseText.length > 597 ? '...' : '');
  }

  briefText = typeof parsed['brief_sms'] === 'string' ? (parsed['brief_sms'] as string) : briefText;
  briefEmail = typeof parsed['brief_email'] === 'string' ? (parsed['brief_email'] as string) : briefText;
  memoryUpdate = typeof parsed['memory_update'] === 'string' ? (parsed['memory_update'] as string) : '';

  if (typeof parsed['mood_score'] === 'number') {
    moodScore = Math.min(5, Math.max(1, Math.round(parsed['mood_score'] as number)));
  }
  if (Array.isArray(parsed['topics_mentioned'])) {
    topicsMentioned = (parsed['topics_mentioned'] as unknown[]).filter(t => typeof t === 'string') as string[];
  }
  if (Array.isArray(parsed['flags_detected'])) {
    flagsDetected = (parsed['flags_detected'] as unknown[]).filter(
      (f): f is DetectedFlag =>
        typeof f === 'object' && f !== null &&
        'category' in f && 'description' in f && 'severity' in f
    );
  }

  if (briefText.length > 600) {
    logger.warn('SMS brief exceeds 600 chars — truncating', { callLogId, length: briefText.length });
    briefText = briefText.slice(0, 597) + '...';
  }

  // brief_email is not yet a DB column — log it so it's not silently discarded
  logger.debug('Brief email format (needs DB column for dashboard)', { callLogId, briefEmail });

  // 6. Update call_logs — brief_text holds the SMS version
  await supabaseAdmin
    .from('call_logs')
    .update({
      brief_text: briefText,
      mood_score: moodScore,
      topics_mentioned: topicsMentioned,
      flags_detected: flagsDetected.map(f => `${f.category}:${f.severity}`),
      memory_update: memoryUpdate,
    })
    .eq('id', callLogId);

  // 7. Save memory entry
  const callDate = getSeniorLocalDate(new Date(callLog.call_time_utc as string), senior.timezone as string);
  await saveMemoryEntry({
    senior_id: callLog.senior_id as string,
    call_log_id: callLogId,
    call_date: callDate,
    mood_score: moodScore,
    memory_summary: memoryUpdate || briefEmail.slice(0, 200) || briefText.slice(0, 200),
    topics: topicsMentioned,
    flags: flagsDetected.map(f => f.category),
    archived: false,
  });

  // 8. Process flags — inserts flag_events, returns urgents for brief-delivery.ts (Session 8)
  if (flagsDetected.length > 0) {
    await processFlags(callLogId, callLog.senior_id as string, flagsDetected);
  }

  logger.info('Brief generated', {
    callLogId,
    moodScore,
    topicCount: topicsMentioned.length,
    flagCount: flagsDetected.length,
    smsLength: briefText.length,
  });

  return { briefText, briefEmail, moodScore, topicsMentioned, flagsDetected, memoryUpdate };
}
