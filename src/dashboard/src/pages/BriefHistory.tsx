import { useState, useEffect, memo } from 'react'
import { ChevronDown, ChevronUp, Phone } from 'lucide-react'
import { api } from '../lib/api'
import { moodColor, moodEmoji, moodHeadline } from '../lib/mood'
import { formatCallTime, formatDuration, formatHistoryDate } from '../lib/format'

// ── Types ────────────────────────────────────────────────────────────────────

interface Senior {
  id:   string
  name: string
}

interface CallLog {
  id:               string
  senior_id:        string
  status:           string
  started_at:       string
  ended_at:         string | null
  duration_seconds: number | null
  brief_text:       string | null
  mood_score:       number | null
  topics_mentioned: string[] | null
  flags_detected:   string[] | null
  transcript:       string | null
}

interface BriefGroup {
  dateLabel: string
  briefs:    CallLog[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function groupBriefsByDate(briefs: CallLog[]): BriefGroup[] {
  const map = new Map<string, CallLog[]>()
  for (const b of briefs) {
    const label = formatHistoryDate(b.started_at)
    const group = map.get(label) ?? []
    group.push(b)
    map.set(label, group)
  }
  return Array.from(map.entries()).map(([dateLabel, briefs]) => ({ dateLabel, briefs }))
}

// ── History card ─────────────────────────────────────────────────────────────

const HistoryCard = memo(function HistoryCard({ brief, seniorName }: { brief: CallLog; seniorName: string }) {
  const [expanded, setExpanded] = useState(false)

  const borderColor = moodColor(brief.mood_score)
  const headline    = moodHeadline(brief.mood_score, seniorName)
  const callTime    = brief.started_at ? formatCallTime(brief.started_at) : ''
  const duration    = formatDuration(brief.duration_seconds)
  const answered    = brief.status === 'completed' ? 'Answered' : 'No answer'
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

export default function BriefHistory() {
  const [senior,   setSenior]   = useState<Senior | null>(null)
  const [briefs,   setBriefs]   = useState<CallLog[]>([])
  const [loading,  setLoading]  = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore,  setHasMore]  = useState(true)
  const [offset,   setOffset]   = useState(0)
  const LIMIT = 20

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const seniors = await api.get<Senior[]>('/api/seniors')
        if (cancelled || !seniors.length) { setLoading(false); return }

        const s = seniors[0]
        setSenior(s)

        const data = await api.get<CallLog[]>(`/api/briefs/${s.id}?limit=${LIMIT}&offset=0`)
        if (!cancelled) {
          setBriefs(data)
          setHasMore(data.length === LIMIT)
          setOffset(LIMIT)
        }
      } catch {
        // silently show empty state
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  const loadMore = async () => {
    if (!senior || loadingMore) return
    setLoadingMore(true)
    try {
      const more = await api.get<CallLog[]>(`/api/briefs/${senior.id}?limit=${LIMIT}&offset=${offset}`)
      setBriefs(prev => [...prev, ...more])
      setOffset(prev => prev + LIMIT)
      setHasMore(more.length === LIMIT)
    } catch {
      // silent
    } finally {
      setLoadingMore(false)
    }
  }

  const seniorName = senior?.name ?? 'Mum'
  const groups = groupBriefsByDate(briefs)

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
        <div className="space-y-6">
          {groups.map(({ dateLabel, briefs: dayBriefs }) => (
            <div key={dateLabel}>
              <p className="text-sm font-body font-medium text-dew-muted mb-3">
                {dateLabel}
              </p>
              <div className="space-y-3">
                {dayBriefs.map(brief => (
                  <HistoryCard key={brief.id} brief={brief} seniorName={seniorName} />
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
