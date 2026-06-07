import { supabaseAdmin } from '../db/supabase';
import { logger } from '../utils/logger';
import type { DetectedFlag, FlagCategory, FlagSeverity } from '../db/types';

const VALID_CATEGORIES: FlagCategory[] = ['physical', 'emotional', 'cognitive', 'safety'];
const VALID_SEVERITIES: FlagSeverity[] = ['low', 'medium', 'high', 'urgent'];

// Flags that warrant an urgent, channel-independent SMS (handled by brief-delivery.ts Session 8)
const URGENT_CATEGORIES: FlagCategory[] = ['safety', 'physical'];
const URGENT_SEVERITIES: FlagSeverity[] = ['high', 'urgent'];

/**
 * Persists each detected flag to flag_events and returns those that require
 * an urgent notification (safety/physical category, or high/urgent severity).
 * The actual SMS is sent by brief-delivery.ts — this service only persists and classifies.
 */
export async function processFlags(
  callLogId: string,
  seniorId: string,
  flags: DetectedFlag[]
): Promise<DetectedFlag[]> {
  const urgentFlags: DetectedFlag[] = [];

  for (const flag of flags) {
    if (!VALID_CATEGORIES.includes(flag.category) || !VALID_SEVERITIES.includes(flag.severity)) {
      logger.warn('Skipping flag with invalid category/severity', { callLogId, flag });
      continue;
    }

    const { error } = await supabaseAdmin
      .from('flag_events')
      .insert({
        senior_id: seniorId,
        call_log_id: callLogId,
        flag_category: flag.category,
        flag_description: flag.description,
        severity: flag.severity,
        notified_family: false,
        acknowledged_by: null,
        acknowledged_at: null,
      });

    if (error) {
      logger.error('Failed to insert flag_event', { callLogId, flag, error });
    } else {
      logger.info('Flag event created', {
        callLogId,
        seniorId,
        category: flag.category,
        severity: flag.severity,
      });
    }

    if (URGENT_CATEGORIES.includes(flag.category) || URGENT_SEVERITIES.includes(flag.severity)) {
      urgentFlags.push(flag);
    }
  }

  return urgentFlags;
}
