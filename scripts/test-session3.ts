import '../src/server/utils/config';
import { getRecentMemory } from '../src/server/services/memory-store';
import { buildCallSystemPrompt } from '../src/server/prompts/call-system-prompt';
import { getTodayTheme, DAILY_THEMES } from '../src/server/prompts/daily-themes';
import { supabaseAdmin } from '../src/server/db/supabase';

const SENIOR_ID = '06e1b56d-b762-4341-aee6-7d4902e5d1a8';

async function main() {
  // 1. Memory entries
  const memories = await getRecentMemory(SENIOR_ID);
  console.log(`Memory count: ${memories.length} (expected 3)`);
  memories.forEach((m) =>
    console.log(`  ${m.call_date} | ${m.memory_summary.slice(0, 60)}`)
  );

  // 2. Thursday + CAUTION should return Wednesday theme
  const cautionTheme =
    'CAUTION' === 'CAUTION' ? DAILY_THEMES['wednesday'] : DAILY_THEMES['thursday'];
  console.log(`\nThursday+CAUTION resolves to: "${cautionTheme.name}" (expected: Right Now)`);

  // 3. Today's theme (real)
  const theme = getTodayTheme('America/New_York', 'NORMAL');
  console.log(`Today theme (America/New_York, NORMAL): "${theme.name}"`);

  // 4. Build call prompt
  const { data: senior } = await supabaseAdmin
    .from('seniors')
    .select('*')
    .eq('id', SENIOR_ID)
    .single();

  if (!senior) {
    console.error('Senior not found');
    process.exit(1);
  }

  const prompt = buildCallSystemPrompt(senior, memories, theme);
  const hasUndefined = /undefined|\{null\}/.test(prompt);

  console.log(`\nPrompt clean (no undefined/null): ${!hasUndefined}`);
  console.log(`Prompt length: ${prompt.length} chars`);
  console.log('\n--- FIRST 600 CHARS ---');
  console.log(prompt.slice(0, 600));
  console.log('\n--- MEMORY BLOCK SECTION ---');
  const memStart = prompt.indexOf('MEMORY FROM RECENT CALLS:');
  const memEnd = prompt.indexOf("TODAY'S THEME:");
  console.log(prompt.slice(memStart, memEnd));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => process.exit(0));
