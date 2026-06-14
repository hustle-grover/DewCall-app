import { useState, useEffect, memo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { api } from '../lib/api'
import { useSenior } from '../lib/senior'
import { moodColor, moodEmoji, moodLabel } from '../lib/mood'

// ── Types ────────────────────────────────────────────────────────────────────

interface MoodDataPoint {
  call_date:        string
  mood_score:       number
  outcome:          string
  topics_mentioned: string[] | null
  flags_detected:   string[] | null
}

// Derived shape used by recharts
interface ChartPoint {
  call_date:        string
  mood_score:       number
  topics_mentioned: string[]
  has_flags:        boolean
}

function toChartPoint(d: MoodDataPoint): ChartPoint {
  return {
    call_date:        d.call_date,
    mood_score:       d.mood_score,
    topics_mentioned: d.topics_mentioned ?? [],
    has_flags:        (d.flags_detected?.length ?? 0) > 0,
  }
}

// ── Recharts custom elements ─────────────────────────────────────────────────

function CustomDot(props: Record<string, unknown>) {
  const { cx, cy, payload } = props as { cx: number; cy: number; payload: ChartPoint }
  const color = moodColor(payload.mood_score)
  return (
    <g key={`dot-${cx}-${cy}`}>
      <circle cx={cx} cy={cy} r={4} fill={color} stroke="white" strokeWidth={1.5} />
      {payload.has_flags && (
        <text x={cx} y={cy - 10} textAnchor="middle" fontSize={10}>⚠️</text>
      )}
    </g>
  )
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: ChartPoint }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-dew-surface rounded-lg shadow-card px-3 py-2 text-sm font-body border border-dew-border">
      <p className="text-dew-muted text-xs mb-0.5">
        {new Date(`${d.call_date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}
      </p>
      <p className="text-dew-text font-medium">
        {moodEmoji(d.mood_score)} {moodLabel(d.mood_score)}
      </p>
      {d.has_flags && (
        <p className="text-dew-flag-text text-xs mt-0.5">⚠️ Flags noted</p>
      )}
    </div>
  )
}

// ── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-dew-surface rounded-card shadow-card p-5">
      <p className="font-body text-xs text-dew-muted mb-1.5">{label}</p>
      {children}
    </div>
  )
}

// ── Memoized chart ───────────────────────────────────────────────────────────

const MoodChart = memo(function MoodChart({ data }: { data: ChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 12, right: 8, left: -28, bottom: 0 }}>
        <ReferenceLine y={3} stroke="#EDE8E0" strokeDasharray="0" />
        <XAxis
          dataKey="call_date"
          tickFormatter={(d: string) =>
            new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
          }
          tick={{ fontSize: 11, fill: '#717171', fontFamily: 'Inter, system-ui, sans-serif' }}
          interval={6}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[1, 5]}
          ticks={[1, 2, 3, 4, 5]}
          tickFormatter={(v: number) =>
            ({ 1: '😟', 2: '😐', 3: '🙂', 4: '😊', 5: '⭐' }[v] ?? '')
          }
          tick={{ fontSize: 13 }}
          axisLine={false}
          tickLine={false}
          width={36}
        />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="mood_score"
          stroke="#4A7C6F"
          strokeWidth={2}
          dot={<CustomDot />}
          activeDot={{ r: 6, fill: '#4A7C6F', stroke: 'white', strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
})

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MoodTrends() {
  const { senior, seniorId } = useSenior()

  const [data,    setData]    = useState<ChartPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!seniorId) return

    let cancelled = false
    setLoading(true)

    api.get<{ moodData: MoodDataPoint[] }>(`/api/briefs/${seniorId}/mood`)
      .then(({ moodData }) => {
        if (!cancelled) setData(moodData.map(toChartPoint))
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [seniorId])

  const seniorName = senior?.preferred_name || senior?.full_name || 'Mum'

  // ── Computed stats ────────────────────────────────────────────────────────

  const now = new Date()
  const weekAgo = new Date(now)
  weekAgo.setDate(now.getDate() - 7)

  const thisWeekData = data.filter(d => new Date(`${d.call_date}T12:00:00`) >= weekAgo)
  const weekAvg = thisWeekData.length
    ? thisWeekData.reduce((s, d) => s + d.mood_score, 0) / thisWeekData.length
    : null

  const allAvg = data.length
    ? data.reduce((s, d) => s + d.mood_score, 0) / data.length
    : null

  const bestDay = data.length
    ? data.reduce((best, d) => (!best || d.mood_score > best.mood_score ? d : best), data[0])
    : null

  // ── Topic counts ─────────────────────────────────────────────────────────

  const topicCounts: Record<string, number> = {}
  for (const d of data) {
    for (const t of d.topics_mentioned) {
      topicCounts[t] = (topicCounts[t] ?? 0) + 1
    }
  }
  const maxCount = Math.max(1, ...Object.values(topicCounts))
  const topTopics = Object.entries(topicCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)

  const chipSize = (count: number) => {
    const r = count / maxCount
    if (r > 0.7) return 'text-sm px-3.5 py-1.5'
    if (r > 0.4) return 'text-xs px-3 py-1'
    return 'text-xs px-2.5 py-0.5'
  }

  // ── Skeleton ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6" aria-hidden="true">
        <div className="h-8 w-64 bg-dew-border rounded animate-pulse" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-dew-border rounded-card animate-pulse" />)}
        </div>
        <div className="h-64 bg-dew-border rounded-card animate-pulse" />
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="font-display text-[1.75rem] font-semibold text-dew-text">
            How {seniorName} has been
          </h1>
          <p className="mt-1 font-body text-base text-dew-muted">Mood from recent morning calls</p>
        </div>
        <div className="bg-dew-surface rounded-card shadow-card p-10 text-center">
          <div className="text-5xl mb-4" role="img" aria-label="Growing plant">🌱</div>
          <h2 className="font-display text-xl font-semibold text-dew-text mb-2">
            Patterns take a little time
          </h2>
          <p className="font-body text-base text-dew-muted leading-relaxed max-w-xs mx-auto">
            Trends will appear after a few morning calls.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-[1.75rem] font-semibold text-dew-text">
          How {seniorName} has been
        </h1>
        <p className="mt-1 font-body text-base text-dew-muted">
          Mood from recent morning calls
        </p>
      </div>

      {/* ── Summary row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="This week">
          {weekAvg ? (
            <p className="font-body text-base text-dew-text">
              <span className="mr-1">{moodEmoji(Math.round(weekAvg))}</span>
              {moodLabel(Math.round(weekAvg))} on average
            </p>
          ) : (
            <p className="font-body text-sm text-dew-muted">No calls yet</p>
          )}
        </StatCard>

        <StatCard label="Last 30 days">
          {allAvg ? (
            <p className="font-body text-base text-dew-text">
              <span className="mr-1">{moodEmoji(Math.round(allAvg))}</span>
              {moodLabel(Math.round(allAvg))} on average
            </p>
          ) : (
            <p className="font-body text-sm text-dew-muted">No data yet</p>
          )}
        </StatCard>

        <StatCard label="Best day">
          {bestDay ? (
            <p className="font-body text-base text-dew-text">
              <span className="mr-1">{moodEmoji(bestDay.mood_score)}</span>
              {new Date(`${bestDay.call_date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long' })}
            </p>
          ) : (
            <p className="font-body text-sm text-dew-muted">—</p>
          )}
        </StatCard>
      </div>

      {/* ── Mood chart ───────────────────────────────────────────────── */}
      <div className="bg-dew-surface rounded-card shadow-card p-5 mb-6">
        <h2 className="font-display text-lg font-semibold text-dew-text mb-4">
          Last 30 days
        </h2>
        <MoodChart data={data} />
      </div>

      {/* ── Topics ───────────────────────────────────────────────────── */}
      {topTopics.length > 0 && (
        <div className="bg-dew-surface rounded-card shadow-card p-5">
          <h2 className="font-display text-lg font-semibold text-dew-text mb-4">
            What {seniorName} talks about
          </h2>
          <div className="flex flex-wrap gap-2">
            {topTopics.map(([topic, count]) => (
              <span
                key={topic}
                className={`rounded-pill font-body font-medium bg-dew-chip-bg text-dew-primary ${chipSize(count)}`}
              >
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
