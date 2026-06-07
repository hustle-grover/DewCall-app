import cron from 'node-cron';
import { supabaseAdmin } from '../db/supabase';
import { initiateCall } from './call-engine';
import { sendNoAnswerNotification } from './brief-delivery';
import { isSeniorCallTime, getSeniorLocalDate, getSeniorLocalDay } from '../utils/timezone';
import { DateTime } from 'luxon';
import { logger } from '../utils/logger';
import type { Senior, CallFrequency } from '../db/types';

// ── Frequency matching ───────────────────────────────────────────────────────

function matchesFrequency(
  senior: Senior,
  local: DateTime,
  weekday: ReturnType<typeof getSeniorLocalDay>,
  daysSinceLastCall: number | null,
): boolean {
  const freq: CallFrequency = senior.call_frequency;

  switch (freq) {
    case 'daily':
      return true;
    case 'weekdays':
      return !['saturday', 'sunday'].includes(weekday);
    case '3x_week':
      return ['monday', 'wednesday', 'friday'].includes(weekday);
    case 'every_2_days':
      // No prior call ever → call. Otherwise require 2+ days gap.
      return daysSinceLastCall === null || daysSinceLastCall >= 2;
    case 'custom':
      return (senior.custom_call_days ?? []).includes(weekday);
    default:
      return false;
  }
}

// ── Core query: who gets a call right now? ───────────────────────────────────

async function getSeniorsScheduledForNow(nowUtc: Date): Promise<Senior[]> {
  const { data: seniors, error } = await supabaseAdmin
    .from('seniors')
    .select('*')
    .eq('is_active', true);

  if (error) {
    logger.error('Scheduler: failed to query seniors', { error });
    return [];
  }
  if (!seniors || seniors.length === 0) return [];

  const scheduled: Senior[] = [];

  for (const senior of seniors) {
    // ── Time check (per senior's timezone) ────────────────────────────────────
    if (!isSeniorCallTime(senior, nowUtc)) continue;

    const local = DateTime.fromJSDate(nowUtc, { zone: 'utc' }).setZone(senior.timezone);
    const weekday = getSeniorLocalDay(nowUtc, senior.timezone);
    const localDate = getSeniorLocalDate(nowUtc, senior.timezone);

    // ── Already called today? ─────────────────────────────────────────────────
    // Any call_log row for today (including 'pending') means we've already
    // placed or are mid-call — skip to avoid duplicates.
    const { data: todayCalls } = await supabaseAdmin
      .from('call_logs')
      .select('id')
      .eq('senior_id', senior.id)
      .eq('call_date', localDate);

    if (todayCalls && todayCalls.length > 0) {
      logger.debug('Scheduler: already called today — skip', { name: senior.preferred_name });
      continue;
    }

    // ── every_2_days: need the last call date ─────────────────────────────────
    let daysSinceLastCall: number | null = null;
    if (senior.call_frequency === 'every_2_days') {
      const { data: lastLog } = await supabaseAdmin
        .from('call_logs')
        .select('call_date')
        .eq('senior_id', senior.id)
        .order('call_date', { ascending: false })
        .limit(1)
        .single();

      if (lastLog?.call_date) {
        const lastDate = DateTime.fromISO(lastLog.call_date as string, { zone: senior.timezone });
        daysSinceLastCall = local.startOf('day').diff(lastDate.startOf('day'), 'days').days;
      }
    }

    // ── Frequency check ───────────────────────────────────────────────────────
    if (!matchesFrequency(senior as Senior, local, weekday, daysSinceLastCall)) continue;

    scheduled.push(senior as Senior);
  }

  return scheduled;
}

// ── No-answer retry logic ────────────────────────────────────────────────────
// Fires every minute: finds no_answer calls from 14–16 minutes ago that
// haven't been retried yet, then places one retry call.
// On second no_answer, logs it and (TODO Session 8) notifies family.

async function runRetryCheck(): Promise<void> {
  const sixteenMinAgo = new Date(Date.now() - 16 * 60 * 1000).toISOString();
  const fourteenMinAgo = new Date(Date.now() - 14 * 60 * 1000).toISOString();

  const { data: noAnswerCalls, error } = await supabaseAdmin
    .from('call_logs')
    .select('id, senior_id, call_date, created_at')
    .eq('outcome', 'no_answer')
    .gt('created_at', sixteenMinAgo)
    .lt('created_at', fourteenMinAgo);

  if (error || !noAnswerCalls?.length) return;

  for (const naCal of noAnswerCalls) {
    // Has there been a call for this senior AFTER the no_answer? (= retry already fired)
    const { data: laterCalls } = await supabaseAdmin
      .from('call_logs')
      .select('id, outcome')
      .eq('senior_id', naCal.senior_id)
      .eq('call_date', naCal.call_date)
      .gt('created_at', naCal.created_at);

    if (laterCalls && laterCalls.length > 0) continue; // retry already attempted

    logger.info('Scheduler: retrying no-answer call', { seniorId: naCal.senior_id, originalCallLogId: naCal.id });

    try {
      await initiateCall(naCal.senior_id as string);
    } catch (err) {
      logger.error('Scheduler: retry call failed', { seniorId: naCal.senior_id, error: err });
    }

    // The no-answer notification runs in runNoAnswerNotificationCheck()
    // once both attempts are confirmed as no_answer
  }
}

// ── Family no-answer notification check ─────────────────────────────────────
// After two no-answers with no retry remaining, notify family.
// Both no-answer calls will be in the same call_date window.

async function runNoAnswerNotificationCheck(): Promise<void> {
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const twentyMinAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();

  // Find second no_answer calls (i.e. there are 2 no_answer rows for the same senior/date today)
  const { data: recentNoAnswer } = await supabaseAdmin
    .from('call_logs')
    .select('id, senior_id, call_date')
    .eq('outcome', 'no_answer')
    .gt('created_at', thirtyMinAgo)
    .lt('created_at', twentyMinAgo);

  if (!recentNoAnswer?.length) return;

  for (const call of recentNoAnswer) {
    // Check if this is the second no_answer for this senior today
    const { data: allNoAnswer } = await supabaseAdmin
      .from('call_logs')
      .select('id')
      .eq('senior_id', call.senior_id)
      .eq('call_date', call.call_date)
      .eq('outcome', 'no_answer');

    if (!allNoAnswer || allNoAnswer.length < 2) continue;

    logger.info('Scheduler: second no-answer confirmed — notifying family', {
      seniorId: call.senior_id,
      callDate: call.call_date,
    });
    sendNoAnswerNotification(call.senior_id as string).catch(err =>
      logger.error('Scheduler: sendNoAnswerNotification failed', { seniorId: call.senior_id, error: err })
    );
  }
}

// ── Public entry point ───────────────────────────────────────────────────────

export function startScheduler(): void {
  logger.info('Scheduler started — watching for calls every minute');

  // Main cron: check every minute who needs a call right now
  cron.schedule('* * * * *', async () => {
    const nowUtc = new Date();
    let seniors: Senior[];

    try {
      seniors = await getSeniorsScheduledForNow(nowUtc);
    } catch (err) {
      logger.error('Scheduler: getSeniorsScheduledForNow failed', { error: err });
      return;
    }

    if (seniors.length === 0) {
      logger.debug(`Scheduler: no seniors to call at ${nowUtc.toISOString()}`);
      return;
    }

    for (const senior of seniors) {
      logger.info('Scheduler: triggering call', { seniorId: senior.id, name: senior.preferred_name });
      initiateCall(senior.id).catch((err) =>
        logger.error('Scheduler: initiateCall failed', { seniorId: senior.id, error: err })
      );
    }
  });

  // Retry cron: same cadence, checks for no_answer calls needing a retry
  cron.schedule('* * * * *', async () => {
    try {
      await runRetryCheck();
      await runNoAnswerNotificationCheck();
    } catch (err) {
      logger.error('Scheduler: retry/notification check failed', { error: err });
    }
  });
}
