import { Router, Request, Response } from 'express';
import { DateTime } from 'luxon';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../db/supabase';
import { getSeniorLocalDate } from '../utils/timezone';
import { logger } from '../utils/logger';
import type { BriefChannel, CallFrequency, MemoryFlag } from '../db/types';

const router = Router();

router.use(requireAuth);

// ── HELPERS ──────────────────────────────────────────────────────────────────

function pick(obj: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (k in obj) out[k] = obj[k];
  }
  return out;
}

async function getCallerFamilyMemberId(req: Request): Promise<string | null> {
  const { data } = await req.supabase
    .from('family_members')
    .select('id')
    .eq('auth_user_id', req.authUser.id)
    .single();
  return data?.id ?? null;
}

// ── ONBOARDING ───────────────────────────────────────────────────────────────

// POST /api/onboarding/family
// Creates (or updates) the caller's family_member profile row.
router.post('/onboarding/family', async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;
  if (!body['full_name'] || !body['phone']) {
    res.status(400).json({ error: 'full_name and phone are required' });
    return;
  }

  // Upsert: update if row already exists for this auth user, otherwise insert.
  const { data: existing } = await req.supabase
    .from('family_members')
    .select('id')
    .eq('auth_user_id', req.authUser.id)
    .maybeSingle();

  const fields = {
    full_name: body['full_name'] as string,
    phone: body['phone'] as string,
    whatsapp_number: (body['whatsapp_number'] as string | undefined) ?? null,
    timezone: (body['timezone'] as string | undefined) ?? 'America/New_York',
    preferred_brief_channel: (body['preferred_brief_channel'] as BriefChannel | undefined) ?? 'sms',
    updated_at: new Date().toISOString(),
  };

  let data, error;
  if (existing) {
    ({ data, error } = await req.supabase
      .from('family_members')
      .update(fields)
      .eq('id', existing.id as string)
      .select()
      .single());
  } else {
    ({ data, error } = await req.supabase
      .from('family_members')
      .insert({ ...fields, auth_user_id: req.authUser.id, email: req.authUser.email! })
      .select()
      .single());
  }

  if (error) {
    logger.error('POST /onboarding/family failed', { error });
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(201).json({ familyMember: data });
});

// POST /api/onboarding/senior
// Creates the senior profile and links them to the calling family member.
// Uses supabaseAdmin for the INSERT because the seniors RLS INSERT policy is a
// chicken-and-egg: the link doesn't exist yet when the senior is first created.
router.post('/onboarding/senior', async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;

  if (!body['full_name'] || !body['preferred_name'] || !body['phone'] || !body['relationship']) {
    res.status(400).json({ error: 'full_name, preferred_name, phone, and relationship are required' });
    return;
  }

  const familyMemberId = await getCallerFamilyMemberId(req);
  if (!familyMemberId) {
    res.status(400).json({ error: 'Complete your profile first (POST /api/onboarding/family)' });
    return;
  }

  const { data: senior, error: seniorErr } = await supabaseAdmin
    .from('seniors')
    .insert({
      primary_family_member_id: familyMemberId,
      full_name: body['full_name'] as string,
      preferred_name: body['preferred_name'] as string,
      phone: body['phone'] as string,
      age: body['age'] ?? null,
      companion_name: (body['companion_name'] as string | undefined) ?? 'Clara',
      call_time: (body['call_time'] as string | undefined) ?? '09:00',
      call_frequency: (body['call_frequency'] as CallFrequency | undefined) ?? 'weekdays',
      timezone: (body['timezone'] as string | undefined) ?? 'America/New_York',
      hobbies: body['hobbies'] ?? null,
      personality_notes: body['personality_notes'] ?? null,
      cultural_notes: body['cultural_notes'] ?? null,
      health_notes: body['health_notes'] ?? null,
      relationship_status: body['relationship_status'] ?? null,
      living_situation: body['living_situation'] ?? null,
      is_active: true,
      onboarding_completed: false,
    })
    .select()
    .single();

  if (seniorErr || !senior) {
    logger.error('POST /onboarding/senior: insert failed', { error: seniorErr });
    res.status(500).json({ error: seniorErr?.message ?? 'Insert failed' });
    return;
  }

  // Create the primary family link
  const { error: linkErr } = await supabaseAdmin
    .from('family_senior_links')
    .insert({
      family_member_id: familyMemberId,
      senior_id: senior.id as string,
      relationship: body['relationship'] as string,
      receives_briefs: true,
      receives_flags: true,
      is_primary: true,
    });

  if (linkErr) {
    logger.error('POST /onboarding/senior: link insert failed', { error: linkErr });
    // Roll back the senior insert so we don't leave orphans
    await supabaseAdmin.from('seniors').delete().eq('id', senior.id as string);
    res.status(500).json({ error: 'Failed to create family link' });
    return;
  }

  res.status(201).json({ senior });
});

// POST /api/onboarding/complete
// Marks the senior as active and ready for calls. First call fires next morning.
router.post('/onboarding/complete', async (req: Request, res: Response) => {
  const { seniorId } = req.body as { seniorId?: string };
  if (!seniorId) {
    res.status(400).json({ error: 'seniorId is required' });
    return;
  }

  const { error } = await req.supabase
    .from('seniors')
    .update({ onboarding_completed: true, is_active: true, updated_at: new Date().toISOString() })
    .eq('id', seniorId);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ ok: true });
});

// ── SENIORS ──────────────────────────────────────────────────────────────────

// GET /api/seniors
router.get('/seniors', async (req: Request, res: Response) => {
  const { data, error } = await req.supabase
    .from('seniors')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ seniors: data ?? [] });
});

// GET /api/seniors/:id
router.get('/seniors/:id', async (req: Request, res: Response) => {
  const { data, error } = await req.supabase
    .from('seniors')
    .select('*')
    .eq('id', req.params['id'])
    .single();

  if (error) {
    res.status(error.code === 'PGRST116' ? 404 : 500).json({ error: error.message });
    return;
  }

  res.json({ senior: data });
});

// PUT /api/seniors/:id — update profile fields
router.put('/seniors/:id', async (req: Request, res: Response) => {
  const updates = pick(req.body as Record<string, unknown>, [
    'full_name', 'preferred_name', 'phone', 'age', 'date_of_birth',
    'hobbies', 'personality_notes', 'cultural_notes', 'health_notes',
    'relationship_status', 'living_situation', 'memory_flag',
  ]);

  if (!updates['memory_flag'] || ['NORMAL', 'CAUTION', 'ALERT'].includes(updates['memory_flag'] as string)) {
    // valid or absent — fine
  } else {
    res.status(400).json({ error: 'memory_flag must be NORMAL, CAUTION, or ALERT' });
    return;
  }

  updates['updated_at'] = new Date().toISOString();

  const { data, error } = await req.supabase
    .from('seniors')
    .update(updates)
    .eq('id', req.params['id'])
    .select()
    .single();

  if (error) {
    res.status(error.code === 'PGRST116' ? 404 : 500).json({ error: error.message });
    return;
  }

  res.json({ senior: data });
});

// PUT /api/seniors/:id/preferences — update call schedule preferences
router.put('/seniors/:id/preferences', async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;
  const updates = pick(body, [
    'call_time', 'call_frequency', 'custom_call_days', 'companion_name', 'timezone', 'is_active',
  ]);

  const validFrequencies: CallFrequency[] = ['daily', 'weekdays', 'every_2_days', '3x_week', 'custom'];
  if (updates['call_frequency'] && !validFrequencies.includes(updates['call_frequency'] as CallFrequency)) {
    res.status(400).json({ error: `call_frequency must be one of: ${validFrequencies.join(', ')}` });
    return;
  }

  updates['updated_at'] = new Date().toISOString();

  const { data, error } = await req.supabase
    .from('seniors')
    .update(updates)
    .eq('id', req.params['id'])
    .select()
    .single();

  if (error) {
    res.status(error.code === 'PGRST116' ? 404 : 500).json({ error: error.message });
    return;
  }

  res.json({ senior: data });
});

// ── BRIEFS ───────────────────────────────────────────────────────────────────

// GET /api/briefs/:seniorId — paginated brief history
router.get('/briefs/:seniorId', async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt((req.query['page'] as string) ?? '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt((req.query['limit'] as string) ?? '20', 10)));
  const offset = (page - 1) * limit;

  const { data, error, count } = await req.supabase
    .from('call_logs')
    .select(
      'id, call_date, call_time_utc, outcome, duration_seconds, mood_score, topics_mentioned, flags_detected, brief_text, brief_delivered, daily_theme',
      { count: 'exact' }
    )
    .eq('senior_id', req.params['seniorId'])
    .order('call_date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ briefs: data ?? [], total: count ?? 0, page, limit });
});

// GET /api/briefs/:seniorId/today — today's call log in the senior's timezone
router.get('/briefs/:seniorId/today', async (req: Request, res: Response) => {
  const { data: senior } = await req.supabase
    .from('seniors')
    .select('timezone')
    .eq('id', req.params['seniorId'])
    .single();

  const timezone = (senior?.timezone ?? 'UTC') as string;
  const today = getSeniorLocalDate(new Date(), timezone);

  const { data, error } = await req.supabase
    .from('call_logs')
    .select('*')
    .eq('senior_id', req.params['seniorId'])
    .eq('call_date', today)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ brief: data ?? null });
});

// GET /api/briefs/:seniorId/latest — most recent call log
router.get('/briefs/:seniorId/latest', async (req: Request, res: Response) => {
  const { data, error } = await req.supabase
    .from('call_logs')
    .select('*')
    .eq('senior_id', req.params['seniorId'])
    .order('call_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ brief: data ?? null });
});

// GET /api/briefs/:seniorId/mood — last 30 days for the mood chart
router.get('/briefs/:seniorId/mood', async (req: Request, res: Response) => {
  const thirtyDaysAgo = DateTime.now().minus({ days: 30 }).toISODate()!;

  const { data, error } = await req.supabase
    .from('call_logs')
    .select('call_date, mood_score, outcome, topics_mentioned, flags_detected')
    .eq('senior_id', req.params['seniorId'])
    .gte('call_date', thirtyDaysAgo)
    .order('call_date', { ascending: true });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ moodData: data ?? [] });
});

// ── FLAGS ─────────────────────────────────────────────────────────────────────

// GET /api/flags/:seniorId — all flags; pass ?unacknowledged=true to filter
router.get('/flags/:seniorId', async (req: Request, res: Response) => {
  let query = req.supabase
    .from('flag_events')
    .select('*')
    .eq('senior_id', req.params['seniorId'])
    .order('created_at', { ascending: false });

  if (req.query['unacknowledged'] === 'true') {
    query = query.is('acknowledged_at', null);
  }

  const { data, error } = await query;

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ flags: data ?? [] });
});

// PUT /api/flags/:id/acknowledge
router.put('/flags/:id/acknowledge', async (req: Request, res: Response) => {
  const familyMemberId = await getCallerFamilyMemberId(req);
  if (!familyMemberId) {
    res.status(400).json({ error: 'Family member profile not found' });
    return;
  }

  const { data, error } = await req.supabase
    .from('flag_events')
    .update({
      acknowledged_by: familyMemberId,
      acknowledged_at: new Date().toISOString(),
    })
    .eq('id', req.params['id'])
    .select()
    .single();

  if (error) {
    res.status(error.code === 'PGRST116' ? 404 : 500).json({ error: error.message });
    return;
  }

  res.json({ flag: data });
});

// ── FAMILY ───────────────────────────────────────────────────────────────────

// GET /api/family/:seniorId — list all linked family members
// Uses supabaseAdmin because family_senior_links has no user-facing RLS policy yet.
router.get('/family/:seniorId', async (req: Request, res: Response) => {
  // Verify the requester can see this senior (RLS check)
  const { data: senior } = await req.supabase
    .from('seniors')
    .select('id')
    .eq('id', req.params['seniorId'])
    .single();

  if (!senior) {
    res.status(404).json({ error: 'Senior not found or access denied' });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('family_senior_links')
    .select('id, relationship, receives_briefs, receives_flags, is_primary, family_member_id, family_members(id, full_name, email, preferred_brief_channel)')
    .eq('senior_id', req.params['seniorId']);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ members: data ?? [] });
});

// POST /api/family/invite — link an existing Dewcall user as a family member by email
// Uses supabaseAdmin to look up the invitee by email (cross-user lookup, intentional).
router.post('/family/invite', async (req: Request, res: Response) => {
  const { email, seniorId, relationship } = req.body as {
    email?: string;
    seniorId?: string;
    relationship?: string;
  };

  if (!email || !seniorId || !relationship) {
    res.status(400).json({ error: 'email, seniorId, and relationship are required' });
    return;
  }

  // Verify requester can access the senior
  const { data: senior } = await req.supabase
    .from('seniors')
    .select('id')
    .eq('id', seniorId)
    .single();

  if (!senior) {
    res.status(404).json({ error: 'Senior not found or access denied' });
    return;
  }

  // Find the invitee's family_member row by email
  const { data: targetMember, error: lookupErr } = await supabaseAdmin
    .from('family_members')
    .select('id, full_name')
    .eq('email', email)
    .maybeSingle();

  if (lookupErr) {
    res.status(500).json({ error: lookupErr.message });
    return;
  }
  if (!targetMember) {
    res.status(404).json({ error: 'No Dewcall account found for that email address' });
    return;
  }

  const { data: link, error: linkErr } = await supabaseAdmin
    .from('family_senior_links')
    .insert({
      family_member_id: targetMember.id as string,
      senior_id: seniorId,
      relationship,
      receives_briefs: true,
      receives_flags: true,
      is_primary: false,
    })
    .select()
    .single();

  if (linkErr) {
    if (linkErr.code === '23505') {
      res.status(409).json({ error: 'This person is already linked to the senior' });
      return;
    }
    res.status(500).json({ error: linkErr.message });
    return;
  }

  res.status(201).json({
    link,
    invitedMember: { id: targetMember.id, full_name: targetMember.full_name },
  });
});

// DELETE /api/family/:linkId — remove a family member link (cannot remove primary)
router.delete('/family/:linkId', async (req: Request, res: Response) => {
  // Verify the link is accessible and not primary
  const { data: link } = await supabaseAdmin
    .from('family_senior_links')
    .select('is_primary, senior_id')
    .eq('id', req.params['linkId'])
    .single();

  if (!link) {
    res.status(404).json({ error: 'Link not found' });
    return;
  }

  // Confirm requester can access the senior this link belongs to
  const { data: senior } = await req.supabase
    .from('seniors')
    .select('id')
    .eq('id', link.senior_id as string)
    .single();

  if (!senior) {
    res.status(404).json({ error: 'Access denied' });
    return;
  }

  if (link.is_primary) {
    res.status(400).json({ error: 'Cannot remove the primary family member' });
    return;
  }

  const { error } = await supabaseAdmin
    .from('family_senior_links')
    .delete()
    .eq('id', req.params['linkId']);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ ok: true });
});

// ── SETTINGS ─────────────────────────────────────────────────────────────────

// GET /api/settings
router.get('/settings', async (req: Request, res: Response) => {
  const { data, error } = await req.supabase
    .from('family_members')
    .select('*')
    .eq('auth_user_id', req.authUser.id)
    .single();

  if (error) {
    res.status(error.code === 'PGRST116' ? 404 : 500).json({ error: error.message });
    return;
  }

  res.json({ settings: data });
});

// PUT /api/settings
router.put('/settings', async (req: Request, res: Response) => {
  const updates = pick(req.body as Record<string, unknown>, [
    'full_name', 'phone', 'whatsapp_number', 'timezone', 'preferred_brief_channel',
  ]);
  updates['updated_at'] = new Date().toISOString();

  const { data, error } = await req.supabase
    .from('family_members')
    .update(updates)
    .eq('auth_user_id', req.authUser.id)
    .select()
    .single();

  if (error) {
    res.status(error.code === 'PGRST116' ? 404 : 500).json({ error: error.message });
    return;
  }

  res.json({ settings: data });
});

export default router;
