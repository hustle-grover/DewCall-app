import twilio from 'twilio';
import { Resend } from 'resend';
import { DateTime } from 'luxon';
import { config } from '../utils/config';
import { supabaseAdmin } from '../db/supabase';
import { logger } from '../utils/logger';
import type { DetectedFlag, FamilyMember, FlagCategory, FlagSeverity } from '../db/types';

const twilioClient = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
const resend = new Resend(config.RESEND_API_KEY);

const SMS_CHAR_LIMIT = 600;
// TODO: change to hello@dewcall.app after domain verified
const FROM_EMAIL = 'DewCall <onboarding@resend.dev>';

// ── Retry helper ─────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function retryWithBackoff<T>(fn: () => Promise<T>, label: string): Promise<T> {
  const delays = [2000, 4000, 8000];
  let lastErr: unknown;
  for (let i = 0; i < delays.length; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      logger.warn(`Delivery attempt ${i + 1}/3 failed: ${label}`, { error: (err as Error).message });
      if (i < delays.length - 1) await sleep(delays[i]);
    }
  }
  throw lastErr;
}

// ── Channel senders ──────────────────────────────────────────────────────────

async function sendSms(to: string, body: string): Promise<void> {
  const truncated = body.length > SMS_CHAR_LIMIT ? body.slice(0, SMS_CHAR_LIMIT - 3) + '...' : body;
  await retryWithBackoff(
    () => twilioClient.messages.create({
      to,
      from: config.TWILIO_PHONE_NUMBER,
      body: truncated,
    }),
    `SMS to ${to.slice(-4).padStart(to.length, '*')}`
  );
}

async function sendWhatsapp(to: string, body: string): Promise<void> {
  const truncated = body.length > SMS_CHAR_LIMIT ? body.slice(0, SMS_CHAR_LIMIT - 3) + '...' : body;
  await retryWithBackoff(
    () => twilioClient.messages.create({
      to: `whatsapp:${to}`,
      from: `whatsapp:${config.TWILIO_WHATSAPP_NUMBER}`,
      body: truncated,
    }),
    `WhatsApp to ${to.slice(-4).padStart(to.length, '*')}`
  );
}

async function sendEmail(
  to: string,
  subject: string,
  briefText: string,
  seniorName: string,
): Promise<void> {
  const emailBody = `${briefText}

—
Sent by Dewcall · Reply to this email to contact support
To manage your notification preferences, visit dewcall.app`;

  await retryWithBackoff(
    () => resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      text: emailBody,
    }).then(r => {
      if (r.error) throw new Error(r.error.message);
    }),
    `Email to ${to}`
  );
}

// ── Formatting helpers ───────────────────────────────────────────────────────

function buildEmailSubject(seniorName: string, callDateUtc: string, timezone: string): string {
  const dt = DateTime.fromISO(callDateUtc, { zone: 'utc' }).setZone(timezone);
  const dayDate = dt.toFormat('cccc d MMM'); // e.g. "Tuesday 3 Jun"
  return `${seniorName}'s Morning — ${dayDate} ☀️`;
}

// ── Primary export: deliver a brief to all linked family members ─────────────

export async function deliverBrief(callLogId: string): Promise<void> {
  // 1. Load call_log
  const { data: callLog, error: callLogErr } = await supabaseAdmin
    .from('call_logs')
    .select('senior_id, brief_text, call_time_utc, flags_detected')
    .eq('id', callLogId)
    .single();

  if (callLogErr || !callLog) {
    throw new Error(`deliverBrief: call log not found: ${callLogId}`);
  }
  if (!callLog.brief_text) {
    logger.warn('deliverBrief: no brief_text yet — skipping delivery', { callLogId });
    return;
  }

  const briefText = callLog.brief_text as string;

  // 2. Load senior (for name + timezone)
  const { data: senior } = await supabaseAdmin
    .from('seniors')
    .select('full_name, preferred_name, timezone')
    .eq('id', callLog.senior_id)
    .single();

  const seniorName = (senior?.preferred_name ?? senior?.full_name ?? 'your parent') as string;
  const timezone = (senior?.timezone ?? 'UTC') as string;

  // 3. Load linked family members who receive briefs
  const { data: links } = await supabaseAdmin
    .from('family_senior_links')
    .select('family_member_id')
    .eq('senior_id', callLog.senior_id)
    .eq('receives_briefs', true);

  if (!links?.length) {
    logger.info('deliverBrief: no family members to notify', { callLogId });
    return;
  }

  const memberIds = links.map((l: { family_member_id: string }) => l.family_member_id);
  const { data: members } = await supabaseAdmin
    .from('family_members')
    .select('id, full_name, email, phone, whatsapp_number, preferred_brief_channel')
    .in('id', memberIds);

  if (!members?.length) return;

  const emailSubject = buildEmailSubject(seniorName, callLog.call_time_utc as string, timezone);
  const successfulChannels: string[] = [];

  // 4. Send to each family member via their preferred channel
  for (const member of members as FamilyMember[]) {
    const channel = member.preferred_brief_channel;

    const shouldSendSms = channel === 'sms' || channel === 'all';
    const shouldSendWhatsapp = channel === 'whatsapp' || channel === 'all';
    const shouldSendEmail = channel === 'email' || channel === 'all';

    if (shouldSendSms && member.phone) {
      try {
        await sendSms(member.phone, briefText);
        successfulChannels.push('sms');
        logger.info('Brief delivered via SMS', { callLogId, memberId: member.id });
      } catch (err) {
        logger.error('SMS delivery failed after 3 attempts', { callLogId, memberId: member.id, error: err });
      }
    }

    const waNumber = member.whatsapp_number ?? member.phone;
    if (shouldSendWhatsapp && waNumber) {
      try {
        await sendWhatsapp(waNumber, briefText);
        successfulChannels.push('whatsapp');
        logger.info('Brief delivered via WhatsApp', { callLogId, memberId: member.id });
      } catch (err) {
        logger.error('WhatsApp delivery failed after 3 attempts', { callLogId, memberId: member.id, error: err });
      }
    }

    if (shouldSendEmail && member.email) {
      try {
        await sendEmail(member.email, emailSubject, briefText, seniorName);
        successfulChannels.push('email');
        logger.info('Brief delivered via email', { callLogId, memberId: member.id });
      } catch (err) {
        logger.error('Email delivery failed after 3 attempts', { callLogId, memberId: member.id, error: err });
      }
    }
  }

  // 5. Mark call_log as delivered
  await supabaseAdmin
    .from('call_logs')
    .update({
      brief_delivered: true,
      brief_delivered_at: new Date().toISOString(),
      brief_delivery_channels: [...new Set(successfulChannels)],
    })
    .eq('id', callLogId);

  logger.info('Brief delivery complete', {
    callLogId,
    channels: [...new Set(successfulChannels)],
    recipientCount: members.length,
  });

  // 6. Send urgent flag SMS (safety/physical or high/urgent severity)
  // Query for unnotified urgent flags on this call
  const URGENT_CATEGORIES: FlagCategory[] = ['safety', 'physical'];
  const URGENT_SEVERITIES: FlagSeverity[] = ['high', 'urgent'];

  const { data: urgentFlags } = await supabaseAdmin
    .from('flag_events')
    .select('id, flag_category, flag_description, severity')
    .eq('call_log_id', callLogId)
    .eq('notified_family', false);

  if (urgentFlags?.length) {
    for (const flagRow of urgentFlags) {
      const isUrgent =
        URGENT_CATEGORIES.includes(flagRow.flag_category as FlagCategory) ||
        URGENT_SEVERITIES.includes(flagRow.severity as FlagSeverity);

      if (!isUrgent) continue;

      const flag: DetectedFlag = {
        category: flagRow.flag_category as FlagCategory,
        description: flagRow.flag_description as string,
        severity: flagRow.severity as FlagSeverity,
      };

      await sendUrgentFlagNotification(callLog.senior_id as string, flag);

      // Mark notified
      await supabaseAdmin
        .from('flag_events')
        .update({ notified_family: true })
        .eq('id', flagRow.id as string);
    }
  }
}

// ── Urgent flag SMS — always via SMS regardless of channel preference ─────────

export async function sendUrgentFlagNotification(
  seniorId: string,
  flag: DetectedFlag,
): Promise<void> {
  const { data: links } = await supabaseAdmin
    .from('family_senior_links')
    .select('family_member_id')
    .eq('senior_id', seniorId)
    .eq('receives_flags', true);

  if (!links?.length) return;

  const memberIds = links.map((l: { family_member_id: string }) => l.family_member_id);
  const { data: members } = await supabaseAdmin
    .from('family_members')
    .select('phone')
    .in('id', memberIds);

  if (!members?.length) return;

  // Load senior name for the message
  const { data: senior } = await supabaseAdmin
    .from('seniors')
    .select('preferred_name, full_name')
    .eq('id', seniorId)
    .single();

  const seniorName = (senior?.preferred_name ?? senior?.full_name ?? 'Your parent') as string;
  const body = `⚠️ Dewcall flag for ${seniorName}: ${flag.description}`;

  for (const member of members as { phone: string }[]) {
    if (!member.phone) continue;
    try {
      await sendSms(member.phone, body);
      logger.info('Urgent flag SMS sent', { seniorId, category: flag.category, severity: flag.severity });
    } catch (err) {
      logger.error('Urgent flag SMS failed', { seniorId, error: err });
    }
  }
}

// ── No-answer notification ───────────────────────────────────────────────────

export async function sendNoAnswerNotification(seniorId: string): Promise<void> {
  const { data: links } = await supabaseAdmin
    .from('family_senior_links')
    .select('family_member_id')
    .eq('senior_id', seniorId)
    .eq('receives_flags', true);

  if (!links?.length) return;

  const memberIds = links.map((l: { family_member_id: string }) => l.family_member_id);
  const { data: members } = await supabaseAdmin
    .from('family_members')
    .select('phone')
    .in('id', memberIds);

  if (!members?.length) return;

  const { data: senior } = await supabaseAdmin
    .from('seniors')
    .select('preferred_name, full_name')
    .eq('id', seniorId)
    .single();

  const seniorName = (senior?.preferred_name ?? senior?.full_name ?? 'Your parent') as string;
  const body = `${seniorName} didn't answer their morning call today. You may want to check in. 💛`;

  for (const member of members as { phone: string }[]) {
    if (!member.phone) continue;
    try {
      await sendSms(member.phone, body);
      logger.info('No-answer notification sent', { seniorId });
    } catch (err) {
      logger.error('No-answer notification failed', { seniorId, error: err });
    }
  }
}
