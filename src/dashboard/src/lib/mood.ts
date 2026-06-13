export const MOOD_COLORS: Record<number, string> = {
  5: 'var(--color-mood-5)',
  4: 'var(--color-mood-4)',
  3: 'var(--color-mood-3)',
  2: 'var(--color-mood-2)',
  1: 'var(--color-mood-1)',
}

export const MOOD_EMOJIS: Record<number, string> = {
  5: '😊', 4: '🙂', 3: '😐', 2: '😟', 1: '⚠️',
}

export const MOOD_LABELS: Record<number, string> = {
  5: 'Great', 4: 'Good', 3: 'Okay', 2: 'Quiet', 1: 'Difficult',
}

export function moodColor(score: number | null): string {
  if (!score) return 'var(--color-muted)'
  return MOOD_COLORS[Math.min(5, Math.max(1, Math.round(score)))] ?? 'var(--color-muted)'
}

export function moodEmoji(score: number | null): string {
  if (!score) return '😐'
  return MOOD_EMOJIS[Math.min(5, Math.max(1, Math.round(score)))] ?? '😐'
}

export function moodLabel(score: number | null): string {
  if (!score) return ''
  return MOOD_LABELS[Math.min(5, Math.max(1, Math.round(score)))] ?? ''
}

export function moodHeadline(score: number | null, name: string): string {
  if (!score) return `${name}'s morning brief`
  if (score >= 5) return `${name} sounded bright and cheerful this morning`
  if (score >= 4) return `${name} was in good spirits this morning`
  if (score >= 3) return `${name} seemed okay this morning`
  if (score >= 2) return `${name} sounded a little quiet this morning`
  return `${name} seemed to be having a harder morning`
}
