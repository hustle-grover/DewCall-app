import { supabaseAdmin } from '../db/supabase';
import { MemoryEntry, InsertMemoryEntry } from '../db/types';
import { logger } from '../utils/logger';

const MEMORY_CAP = 10;

// Fetch the last N active (non-archived) memory entries for a senior, newest first
export async function getRecentMemory(
  seniorId: string,
  limit = 5
): Promise<MemoryEntry[]> {
  const { data, error } = await supabaseAdmin
    .from('memory_entries')
    .select('*')
    .eq('senior_id', seniorId)
    .eq('archived', false)
    .order('call_date', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error('Failed to fetch recent memory', { seniorId, error });
    throw error;
  }

  return (data ?? []) as MemoryEntry[];
}

// Insert a new memory entry, then prune if over the cap
export async function saveMemoryEntry(entry: InsertMemoryEntry): Promise<void> {
  const { error } = await supabaseAdmin
    .from('memory_entries')
    .insert(entry);

  if (error) {
    logger.error('Failed to save memory entry', { seniorId: entry.senior_id, error });
    throw error;
  }

  await pruneOldMemory(entry.senior_id);
}

// If active memory entries exceed MEMORY_CAP, archive the oldest ones.
// Never hard-deletes — archived entries remain in the DB for audit/history.
export async function pruneOldMemory(seniorId: string): Promise<void> {
  const { data: entries, error: fetchError } = await supabaseAdmin
    .from('memory_entries')
    .select('id, call_date')
    .eq('senior_id', seniorId)
    .eq('archived', false)
    .order('call_date', { ascending: true }); // oldest first

  if (fetchError) {
    logger.error('Failed to fetch entries for pruning', { seniorId, error: fetchError });
    return;
  }

  const active = entries ?? [];
  if (active.length <= MEMORY_CAP) return;

  const toArchive = active.slice(0, active.length - MEMORY_CAP);
  const ids = toArchive.map((e: { id: string }) => e.id);

  const { error: archiveError } = await supabaseAdmin
    .from('memory_entries')
    .update({ archived: true })
    .in('id', ids);

  if (archiveError) {
    logger.error('Failed to archive old memory entries', { seniorId, error: archiveError });
    return;
  }

  logger.info(`Archived ${ids.length} old memory entries for senior`, { seniorId });
}
