/**
 * Dewcall — Test Data Seed Script
 *
 * Creates a test family member + senior with 3 sample memory entries.
 * Safe to re-run: deletes existing test data before inserting fresh.
 *
 * BEFORE RUNNING: update the phone numbers below to real numbers you
 * can receive calls/SMS on during development.
 *
 * Run: npx ts-node src/server/db/seed.ts
 */

import '../utils/config'; // load and validate env vars first
import { supabaseAdmin } from './supabase';
import { logger } from '../utils/logger';

// ── Update these before testing calls/SMS ────────────────────────────────────
const FAMILY_PHONE = '+919255435752';   // Sarah's phone — receives briefs via SMS
const SENIOR_PHONE = '+919255435752';   // Maggie's phone — receives morning calls
// ─────────────────────────────────────────────────────────────────────────────

async function seed() {
  logger.info('Starting seed...');

  // ── 1. Clean up any existing test data ────────────────────────────────────
  const { data: existing } = await supabaseAdmin
    .from('family_members')
    .select('id')
    .eq('email', 'test@dewcall.dev')
    .single();

  if (existing) {
    logger.info('Existing test data found — cleaning up...');

    // Get all linked senior IDs first
    const { data: links } = await supabaseAdmin
      .from('family_senior_links')
      .select('senior_id')
      .eq('family_member_id', existing.id);

    const seniorIds = (links ?? []).map((l: { senior_id: string }) => l.senior_id);

    if (seniorIds.length > 0) {
      // Delete memory entries and call logs (flag_events cascade from call_logs)
      await supabaseAdmin.from('memory_entries').delete().in('senior_id', seniorIds);
      await supabaseAdmin.from('flag_events').delete().in('senior_id', seniorIds);
      await supabaseAdmin.from('call_logs').delete().in('senior_id', seniorIds);
      await supabaseAdmin.from('family_senior_links').delete().in('senior_id', seniorIds);
      await supabaseAdmin.from('seniors').delete().in('id', seniorIds);
    }

    await supabaseAdmin.from('family_members').delete().eq('id', existing.id);
    logger.info('Cleanup complete.');
  }

  // ── 2. Insert test family member ──────────────────────────────────────────
  const { data: familyMember, error: fmError } = await supabaseAdmin
    .from('family_members')
    .insert({
      full_name: 'Sarah Test',
      email: 'test@dewcall.dev',
      phone: FAMILY_PHONE,
      whatsapp_number: FAMILY_PHONE,
      preferred_brief_channel: 'sms',
      subscription_status: 'trial',
      trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      timezone: 'America/New_York',
    })
    .select()
    .single();

  if (fmError || !familyMember) {
    logger.error('Failed to insert family member', { error: fmError });
    process.exit(1);
  }
  logger.info(`Family member created: ${familyMember.full_name} (${familyMember.id})`);

  // ── 3. Insert test senior ─────────────────────────────────────────────────
  const { data: senior, error: sError } = await supabaseAdmin
    .from('seniors')
    .insert({
      primary_family_member_id: familyMember.id,
      full_name: 'Maggie Test',
      preferred_name: 'Maggie',
      phone: SENIOR_PHONE,
      age: 72,
      companion_name: 'Clara',
      relationship_status: 'Widowed',
      living_situation: 'Lives alone in her home',
      hobbies: 'gardening, bridge, reading mysteries',
      personality_notes: 'Warm, chatty, loves to laugh',
      cultural_notes: null,
      health_notes: 'Mild arthritis in left knee. Takes blood pressure medication.',
      memory_flag: 'NORMAL',
      call_frequency: 'weekdays',
      call_time: '09:00:00',
      timezone: 'America/New_York',
      is_active: true,
      onboarding_completed: true,
    })
    .select()
    .single();

  if (sError || !senior) {
    logger.error('Failed to insert senior', { error: sError });
    process.exit(1);
  }
  logger.info(`Senior created: ${senior.full_name} (${senior.id})`);

  // ── 4. Link family member to senior ──────────────────────────────────────
  const { error: linkError } = await supabaseAdmin
    .from('family_senior_links')
    .insert({
      family_member_id: familyMember.id,
      senior_id: senior.id,
      relationship: 'daughter',
      receives_briefs: true,
      receives_flags: true,
      is_primary: true,
    });

  if (linkError) {
    logger.error('Failed to insert family_senior_link', { error: linkError });
    process.exit(1);
  }
  logger.info('Family-senior link created.');

  // ── 5. Insert 3 sample memory entries (matches PRD §4.4.2 example) ────────
  const memoryEntries = [
    {
      senior_id: senior.id,
      call_date: '2026-05-27',
      mood_score: 4,
      memory_summary:
        "Maggie's tomatoes are finally growing. Daughter Sarah visited last weekend. Knee pain improving. She mentioned missing her husband on quiet evenings.",
      topics: ['gardening', 'family', 'health'],
      flags: [] as string[],
      archived: false,
    },
    {
      senior_id: senior.id,
      call_date: '2026-05-26',
      mood_score: 3,
      memory_summary:
        "Seemed tired, didn't sleep well. Bridge club cancelled this week. Nothing concerning.",
      topics: ['sleep', 'bridge club'],
      flags: [] as string[],
      archived: false,
    },
    {
      senior_id: senior.id,
      call_date: '2026-05-23',
      mood_score: 5,
      memory_summary:
        "Very cheerful. Talked about a new book she's reading — mystery novel. Asked about Michael's new job.",
      topics: ['reading', 'family'],
      flags: [] as string[],
      archived: false,
    },
  ];

  const { error: memError } = await supabaseAdmin
    .from('memory_entries')
    .insert(memoryEntries);

  if (memError) {
    logger.error('Failed to insert memory entries', { error: memError });
    process.exit(1);
  }
  logger.info('3 memory entries created.');

  // ── Done ──────────────────────────────────────────────────────────────────
  logger.info('');
  logger.info('✅ Seed complete.');
  logger.info(`   Family: ${familyMember.full_name} (${familyMember.email})`);
  logger.info(`   Senior: ${senior.full_name} (preferred: ${senior.preferred_name})`);
  logger.info(`   Senior ID: ${senior.id}  ← save this for test scripts`);
  logger.info(`   Family ID: ${familyMember.id}`);
  logger.info('');
  logger.info('Next: update FAMILY_PHONE and SENIOR_PHONE in this file with real numbers.');

  process.exit(0);
}

seed().catch((err) => {
  logger.error('Seed failed unexpectedly', { err });
  process.exit(1);
});
