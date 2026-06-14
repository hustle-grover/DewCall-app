import { useState, useEffect, memo } from 'react'
import { ChevronDown, ChevronUp, Phone } from 'lucide-react'
import { api } from '../lib/api'
import { useSenior } from '../lib/senior'
import { moodColor, moodEmoji, moodHeadline } from '../lib/mood'
import { formatCallDatetime, formatDuration, formatDateLabel, formatMonthLabel } from '../lib/format'

// ── Types ────────────────────────────────────────────────────────────────────

interface CallLog {
  id:               string
  senior_id:        string
  call_date:        string
  call_time_utc:    string | null
  outcome:          string
  duration_seconds: number | null
  brief_text:       string | null
  mood_score:       number | null
  topics_mentioned: string[] | null
  flags_detected:   string[] | null
}

interface MonthGroup {
  monthLabel: string
  briefs:     CallLog[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function groupBriefsByMonth(briefs: CallLog[]): MonthGroup[] {
  const map = new Map<string, CallLog[]>()
  for (const b of briefs) {
    const label = formatMonthLabel(b.call_date)
    const group = map.get(label) ?? []
    group.push(b)
    map.set(label, group)
  }
  return Array.from(map.entries()).map(([monthLabel, briefs]) => ({ monthLabel, briefs }))
}

// ── History card ─────────────────────────────────────────────────────────────

const HistoryCard = memo(function HistoryCard({ brief, seniorName }: { brief: CallLog; seniorName: string }) {
  const [expanded, setExpanded] = useState(false)

  const borderColor = moodColor(brief.mood_score)
  const headline    = moodHeadline(brief.mood_score, seniorName)
  const callTime    = formatCallDatetime(brief.call_date, brief.call_time_utc)
  const duration    = formatDuration(brief.duration_seconds)
  const answered    = brief.outcome === 'completed' ? 'Answered' : 'No answer'
  const hasFlags    = !!brief.flags_detected?.length

  const lines = (brief.brief_text ?? '').split('\n').map(l => l.trim()).filter(Boolean)
  const visibleLines = expanded ? lines : lines.slice(0, 2)
  const hasMore = lines.length > 2

  return (
    <article
      className="bg-dew-surface rounded-card shadow-card overflow-hidden"
      style={{ borderLeft: `3px solid ${borderColor}` }}
      aria-label={`Brief for ${seniorName}`}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="px-5 pt-5 pb-3">
        <div className="flex items-start gap-3">
          <span className="text-3xl leading-none shrink-0 mt-0.5" aria-hidden="true">
            {moodEmoji(brief.mood_score)}
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-base font-semibold text-dew-text leading-snug">
              {headline}
            </h3>
            <div className="mt-1 flex items-center gap-1.5 text-xs font-body text-dew-muted">
              <Phone size={11} strokeWidth={1.5} aria-hidden="true" />
              <span>
                {[callTime, answered, duration].filter(Boolean).join(' · ')}
              </span>
            </div>
          </div>
          {hasFlags && (
            <span className="text-sm shrink-0" aria-label="Flags noted this call" title="Flags noted">⚠️</span>
          )}
        </div>
      </header>

      {/* ── Brief body ─────────────────────────────────────────────────── */}
      {lines.length > 0 && (
        <div className="px-5 pb-3 font-body text-sm text-dew-text leading-[1.65]">
          <div className="space-y-1.5">
            {visibleLines.map((line, i) => {
              const isBullet = /^[•\-*]/.test(line)
              if (isBullet) {
                return (
                  <div key={i} className="flex gap-2">
                    <span className="mt-[0.4em] text-dew-primary text-[9px] shrink-0">●</span>
                    <span>{line.replace(/^[•\-*]\s*/, '')}</span>
                  </div>
                )
              }
              return <p key={i}>{line}</p>
            })}
          </div>

          {hasMore && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="mt-2 flex items-center gap-1 text-xs font-medium text-dew-primary hover:text-dew-primary-dk focus:outline-none focus-visible:ring-2 focus-visible:ring-dew-primary rounded transition-colors"
              aria-expanded={expanded}
            >
              {expanded ? 'Show less' : 'Read more'}
              {expanded
                ? <ChevronUp  size={12} aria-hidden="true" />
                : <ChevronDown size={12} aria-hidden="true" />
              }
            </button>
          )}
        </div>
      )}

      {/* ── Topic chips ─────────────────────────────────────────────────── */}
      {brief.topics_mentioned && brief.topics_mentioned.length > 0 && (
        <div className="px-5 pb-4 flex flex-wrap gap-1.5" aria-label="Topics mentioned">
          {brief.topics_mentioned.map(topic => (
            <span
              key={topic}
              className="px-2.5 py-0.5 rounded-pill text-xs font-medium font-body bg-dew-chip-bg text-dew-primary"
            >
              {topic}
            </span>
          ))}
        </div>
      )}
    </article>
  )
})

// ── Page ─────────────────────────────────────────────────────────────────────

const LIMIT = 20

export default function BriefHistory() {
  const { senior, seniorId } = useSenior()

  const [briefs,      setBriefs]      = useState<CallLog[]>([])
  const [loading,     setLoading]     = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore,     setHasMore]     = useState(true)
  const [page,        setPage]        = useState(1)

  useEffect(() => {
    if (!seniorId) return

    let cancelled = false
    setLoading(true)

    api.get<{ briefs: CallLog[]; total: number }>(`/api/briefs/${seniorId}?limit=${LIMIT}&page=1`)
      .then(({ briefs, total }) => {
        if (cancelled) return
        setBriefs(briefs)
        setHasMore(briefs.length < total)
        setPage(1)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [seniorId])

  const loadMore = async () => {
    if (!seniorId || loadingMore) return
    setLoadingMore(true)
    const nextPage = page + 1
    try {
      const { briefs: more, total } = await api.get<{ briefs: CallLog[]; total: number }>(
        `/api/briefs/${seniorId}?limit=${LIMIT}&page=${nextPage}`
      )
      setBriefs(prev => [...prev, ...more])
      setPage(nextPage)
      setHasMore(briefs.length + more.length < total)
    } catch {
      // silent
    } finally {
      setLoadingMore(false)
    }
  }

  const seniorName = senior?.preferred_name || senior?.full_name || 'Mum'
  const groups = groupBriefsByMonth(briefs)

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-[1.75rem] font-semibold text-dew-text">
          Recent mornings
        </h1>
        <p className="mt-1 font-body text-base text-dew-muted">
          A record of every conversation
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-dew-surface rounded-card shadow-card p-5 animate-pulse space-y-3" aria-hidden="true">
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-dew-border shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-dew-border rounded w-3/4" />
                  <div className="h-3 bg-dew-border rounded w-1/2" />
                </div>
              </div>
              <div className="h-3 bg-dew-border rounded w-full" />
              <div className="h-3 bg-dew-border rounded w-5/6" />
            </div>
          ))}
        </div>
      ) : briefs.length === 0 ? (
        <div className="bg-dew-surface rounded-card shadow-card p-10 text-center">
          <div className="text-5xl mb-4" role="img" aria-label="Sunrise">🌅</div>
          <h2 className="font-display text-xl font-semibold text-dew-text mb-2">
            No calls yet
          </h2>
          <p className="font-body text-base text-dew-muted leading-relaxed max-w-xs mx-auto">
            Briefs will appear here after {seniorName}'s first morning call.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map(({ monthLabel, briefs: monthBriefs }) => (
            <div key={monthLabel}>
              <p className="text-sm font-body font-semibold text-dew-text mb-4">
                {monthLabel}
              </p>
              <div className="space-y-5">
                {monthBriefs.map(brief => (
                  <div key={brief.id}>
                    <p className="text-xs font-body text-dew-muted mb-2">
                      {formatDateLabel(brief.call_date)}
                    </p>
                    <HistoryCard brief={brief} seniorName={seniorName} />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {hasMore && (
            <div className="pt-2 text-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="text-sm font-body font-medium text-dew-primary hover:text-dew-primary-dk focus:outline-none focus-visible:ring-2 focus-visible:ring-dew-primary rounded transition-colors disabled:opacity-60"
              >
                {loadingMore ? 'Loading…' : 'Load earlier mornings'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
