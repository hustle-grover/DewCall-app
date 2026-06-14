export function formatCallTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export function formatDuration(seconds: number | null): string {
  if (!seconds) return ''
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m} min ${s} sec` : `${m} min`
}

export function formatHistoryDate(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
}

export function formatTimePretty(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

// Convert call_date (YYYY-MM-DD) + call_time_utc (HH:MM:SS) to local time string.
export function formatCallDatetime(callDate: string, callTimeUtc: string | null): string {
  if (!callTimeUtc) return ''
  try {
    const dt = new Date(`${callDate}T${callTimeUtc}Z`)
    return dt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  } catch { return '' }
}

// Group label: "June 2026"
export function formatMonthLabel(callDate: string): string {
  return new Date(`${callDate}T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

// Short date label within a month group: "Thursday, 12 June"
export function formatDateLabel(callDate: string): string {
  const d = new Date(`${callDate}T12:00:00`)
  const today     = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString())     return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
}
