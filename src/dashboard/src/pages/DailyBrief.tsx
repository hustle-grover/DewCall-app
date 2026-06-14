import { useState, useEffect, memo } from 'react'
import { ChevronDown, ChevronUp, Phone } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useSenior } from '../lib/senior'
import { moodColor, moodEmoji, moodHeadline } from '../lib/mood'
import { formatCallDatetime, formatDuration } from '../lib/format'

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
  transcript:       string | null
}

// ── Sub-components ───────────────────────────────────────────────────────────

function BriefSkeleton() {
  return (
    <div
      className="bg-dew-surface rounded-card shadow-card overflow-hidden animate-pulse"
      aria-hidden="true"
    >
      <div className="border-l-[3px] border-dew-border p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-dew-border shrink-0" />
          <div className="h-6 bg-dew-border rounded w-3/4" />
        </div>
        <hr className="border-dew-border" />
        <div className="space-y-3">
          <div className="h-4 bg-dew-border rounded w-full" />
          <div className="h-4 bg-dew-border rounded w-5/6" />
          <div className="h-4 bg-dew-border rounded w-4/5" />
          <div className="h-4 bg-dew-border rounded w-full" />
          <div className="h-4 bg-dew-border rounded w-3/4" />
        </div>
        <div className="flex gap-2">
          <div className="h-6 w-20 bg-dew-border rounded-pill" />
          <div className="h-6 w-16 bg-dew-border rounded-pill" />
          <div className="h-6 w-24 bg-dew-border rounded-pill" />
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="bg-dew-surface rounded-card shadow-card p-10 text-center">
      <div className="text-5xl mb-4" role="img" aria-label="Sun">☀️</div>
      <h2 className="font-display text-xl font-semibold text-dew-text mb-2">
        Nothing yet this morning
      </h2>
      <p className="font-body text-base text-dew-muted leading-relaxed max-w-xs mx-auto">
        Your first brief arrives after tomorrow morning's call{' '}
        <span aria-hidden="true">☀️</span>
      </p>
    </div>
  )
}

function ErrorState() {
  return (
    <div className="bg-dew-surface rounded-card shadow-card p-10 text-center">
      <div className="text-5xl mb-4" role="img" aria-label="Cloud">☁️</div>
      <h2 className="font-display text-xl font-semibold text-dew-text mb-2">
        We couldn't load this morning's brief.
      </h2>
      <p className="font-body text-base text-dew-muted leading-relaxed max-w-xs mx-auto">
        It may be on its way — try refreshing in a moment.
      </p>
    </div>
  )
}

const BriefCard = memo(function BriefCard({ brief, seniorName }: { brief: CallLog; seniorName: string }) {
  const [transcriptOpen, setTranscriptOpen] = useState(false)

  const borderColor = moodColor(brief.mood_score)
  const headline    = moodHeadline(brief.mood_score, seniorName)
  const callTime    = formatCallDatetime(brief.call_date, brief.call_time_utc)
  const duration    = formatDuration(brief.duration_seconds)
  const answered    = brief.outcome === 'completed' ? 'Answered' : 'No answer'

  const lines = (brief.brief_text ?? '').split('\n').map(l => l.trim()).filter(Boolean)

  return (
    <article
      className="bg-dew-surface rounded-card shadow-card overflow-hidden"
      style={{ borderLeft: `3px solid ${borderColor}` }}
      aria-label={`Morning brief for ${seniorName}`}
    >
      <header className="px-6 pt-6 pb-4">
        <div className="flex items-start gap-4">
          <span className="text-5xl leading-none shrink-0" aria-hidden="true">
            {moodEmoji(brief.mood_score)}
          </span>
          <h2 className="font-display text-xl font-semibold text-dew-text leading-snug mt-1 min-w-0">
            {headline}
          </h2>
        </div>
      </header>

      <hr className="border-dew-border mx-6" />

      <div className="px-6 py-5 font-body text-base text-dew-text leading-[1.75]">
        {lines.length > 0 ? (
          <div className="space-y-3">
            {lines.map((line, i) => {
              const isBullet = /^[•\-*]/.test(line)
              if (isBullet) {
                return (
                  <div key={i} className="flex gap-2.5">
                    <span className="mt-[0.45em] text-dew-primary text-[10px] shrink-0">●</span>
                    <span>{line.replace(/^[•\-*]\s*/, '')}</span>
                  </div>
                )
              }
              return <p key={i}>{line}</p>
            })}
          </div>
        ) : (
          <p className="text-dew-muted italic">Brief text not available.</p>
        )}
      </div>

      {brief.topics_mentioned && brief.topics_mentioned.length > 0 && (
        <div className="px-6 pb-4 flex flex-wrap gap-2" aria-label="Topics mentioned">
          {brief.topics_mentioned.map(topic => (
            <span
              key={topic}
              className="px-3 py-1 rounded-pill text-xs font-medium font-body bg-dew-chip-bg text-dew-primary"
            >
              {topic}
            </span>
          ))}
        </div>
      )}

      {brief.flags_detected && brief.flags_detected.length > 0 && (
        <div
          className="mx-6 mb-4 p-4 rounded-lg bg-dew-flag-bg font-body"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-2.5">
            <span className="text-base leading-none mt-0.5 shrink-0" aria-hidden="true">💛</span>
            <div>
              <p className="text-sm font-semibold text-dew-flag-text">
                Something to keep in mind
              </p>
              <ul className="mt-1.5 space-y-1">
                {brief.flags_detected.map((flag, i) => (
                  <li key={i} className="text-sm text-dew-text">{flag}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <hr className="border-dew-border mx-6" />

      <footer className="px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 text-xs font-body text-dew-muted">
          <Phone size={12} strokeWidth={1.5} aria-hidden="true" />
          <span>
            {[duration, answered, callTime].filter(Boolean).join(' · ')}
          </span>
        </div>

        {brief.transcript && (
          <button
            onClick={() => setTranscriptOpen(v => !v)}
            className="flex items-center gap-1 text-xs font-body font-medium text-dew-primary hover:text-dew-primary-dk focus:outline-none focus-visible:ring-2 focus-visible:ring-dew-primary focus-visible:ring-offset-1 rounded transition-colors shrink-0 py-2 px-1 -my-2 -mx-1"
            aria-expanded={transcriptOpen}
            aria-controls="transcript-panel"
          >
            {transcriptOpen ? 'Hide transcript' : 'View transcript'}
            {transcriptOpen
              ? <ChevronUp  size={14} aria-hidden="true" />
              : <ChevronDown size={14} aria-hidden="true" />
            }
          </button>
        )}
      </footer>

      {transcriptOpen && brief.transcript && (
        <div id="transcript-panel" className="px-6 pb-6">
          <div className="bg-dew-bg rounded-lg border border-dew-border p-4 text-sm font-body text-dew-text leading-relaxed whitespace-pre-wrap">
            {brief.transcript}
          </div>
        </div>
      )}
    </article>
  )
})

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DailyBrief() {
  const { profileName }    = useAuth()
  const { senior, seniorId } = useSenior()

  const [brief,   setBrief]   = useState<CallLog | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  const greeting = (() => {
    const h = new Date().getHours()
    if (h >= 5  && h < 12) return 'Good morning'
    if (h >= 12 && h < 17) return 'Good afternoon'
    if (h >= 17 && h < 21) return 'Good evening'
    return 'Good night'
  })()

  useEffect(() => {
    if (!seniorId) return

    let cancelled = false
    setLoading(true)
    setError(false)

    api.get<{ brief: CallLog | null }>(`/api/briefs/${seniorId}/today`)
      .then(({ brief }) => {
        if (!cancelled) setBrief(brief)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [seniorId])

  const seniorName = senior?.preferred_name || senior?.full_name || 'Mum'

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-[1.75rem] font-semibold text-dew-text">
          {greeting}{profileName ? `, ${profileName}` : ''}
        </h1>
        <p className="mt-1 font-body text-base text-dew-muted">{today}</p>
      </div>

      {loading ? (
        <BriefSkeleton />
      ) : error ? (
        <ErrorState />
      ) : !brief ? (
        <EmptyState />
      ) : (
        <BriefCard brief={brief} seniorName={seniorName} />
      )}
    </div>
  )
}
