import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { TIMEZONES } from '../lib/constants'

// ── Types ────────────────────────────────────────────────────────────────────

interface Senior {
  id:               string
  name:             string
  preferred_name:   string | null
  phone:            string
  age:              number | null
  timezone:         string
  call_time:        string
  call_frequency:   string
  custom_days:      string[] | null
  companion_name:   string
  memory_flag:      'normal' | 'caution'
  hobbies:          string | null
  personality:      string | null
  health_context:   string | null
  cultural_notes:   string | null
}

type CallFrequency = 'daily' | 'weekdays' | 'every_other' | 'custom'
type MemoryFlag    = 'normal' | 'caution'

// ── Shared input styles ───────────────────────────────────────────────────────

const inputCls =
  'w-full px-4 py-2.5 rounded-button border border-dew-border bg-dew-bg text-dew-text ' +
  'placeholder:text-dew-muted text-base focus:outline-none focus:border-dew-primary ' +
  'focus-visible:ring-2 focus-visible:ring-dew-primary focus-visible:ring-offset-1 transition-colors'

const textareaCls = inputCls + ' resize-none'
const selectCls   = inputCls

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium font-body text-dew-text mb-1.5" htmlFor={htmlFor}>
      {children}
    </label>
  )
}

function SectionDivider({ title }: { title: string }) {
  return (
    <div className="pt-8">
      <hr className="border-dew-border mb-6" />
      <h2 className="font-display text-lg font-semibold text-dew-text mb-5">{title}</h2>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ParentProfile() {
  const [senior,   setSenior]   = useState<Senior | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [error,    setError]    = useState('')

  // Form state
  const [name,             setName]            = useState('')
  const [preferredName,    setPreferredName]    = useState('')
  const [phone,            setPhone]           = useState('')
  const [age,              setAge]             = useState('')
  const [timezone,         setTimezone]        = useState('America/New_York')
  const [callTime,         setCallTime]        = useState('09:00')
  const [callFrequency,    setCallFrequency]   = useState<CallFrequency>('weekdays')
  const [companionName,    setCompanionName]   = useState('Clara')
  const [memoryFlag,       setMemoryFlag]      = useState<MemoryFlag>('normal')
  const [hobbies,          setHobbies]         = useState('')
  const [personality,      setPersonality]     = useState('')
  const [healthContext,    setHealthContext]    = useState('')
  const [culturalNotes,    setCulturalNotes]   = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const seniors = await api.get<Senior[]>('/api/seniors')
        if (cancelled || !seniors.length) { setLoading(false); return }

        const s = seniors[0]
        setSenior(s)

        setName(s.name)
        setPreferredName(s.preferred_name ?? '')
        setPhone(s.phone)
        setAge(s.age?.toString() ?? '')
        setTimezone(s.timezone)
        setCallTime(s.call_time)
        setCallFrequency(s.call_frequency as CallFrequency)
        setCompanionName(s.companion_name)
        setMemoryFlag(s.memory_flag)
        setHobbies(s.hobbies ?? '')
        setPersonality(s.personality ?? '')
        setHealthContext(s.health_context ?? '')
        setCulturalNotes(s.cultural_notes ?? '')
      } catch {
        // show read-only empty state
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  const handleSave = async () => {
    if (!senior) return
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      await api.put(`/api/seniors/${senior.id}`, {
        name,
        preferred_name:   preferredName || undefined,
        phone,
        age:              age ? Number(age) : undefined,
        timezone,
        call_time:        callTime,
        call_frequency:   callFrequency,
        companion_name:   companionName,
        memory_flag:      memoryFlag,
        hobbies:          hobbies || undefined,
        personality:      personality || undefined,
        health_context:   healthContext || undefined,
        cultural_notes:   culturalNotes || undefined,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const displayName = senior?.preferred_name || senior?.name || 'your parent'

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse" aria-hidden="true">
        <div className="h-8 w-48 bg-dew-border rounded" />
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-dew-border rounded-button" />)}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-[1.75rem] font-semibold text-dew-text">
          About {displayName}
        </h1>
        <p className="mt-1 font-body text-base text-dew-muted">
          Help Clara know {displayName} better
        </p>
      </div>

      {/* ── Section 1: The basics ──────────────────────────────────── */}
      <h2 className="font-display text-lg font-semibold text-dew-text mb-5">The basics</h2>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel htmlFor="name">Full name</FieldLabel>
            <input id="name" type="text" value={name} onChange={e => setName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <FieldLabel htmlFor="preferredName">What they like to be called</FieldLabel>
            <input id="preferredName" type="text" value={preferredName} onChange={e => setPreferredName(e.target.value)}
              className={inputCls} placeholder="e.g. Maggie" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel htmlFor="phone">Their phone number</FieldLabel>
            <input id="phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} />
          </div>
          <div>
            <FieldLabel htmlFor="age">Age (optional)</FieldLabel>
            <input id="age" type="number" min="50" max="120" value={age} onChange={e => setAge(e.target.value)}
              className={inputCls} placeholder="78" />
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="timezone">Their timezone</FieldLabel>
          <select id="timezone" value={timezone} onChange={e => setTimezone(e.target.value)} className={selectCls}>
            {TIMEZONES.map(tz => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Section 2: Call preferences ──────────────────────────── */}
      <SectionDivider title="Call preferences" />

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel htmlFor="callTime">Call time</FieldLabel>
            <input id="callTime" type="time" value={callTime} onChange={e => setCallTime(e.target.value)} className={inputCls} />
          </div>
          <div>
            <FieldLabel htmlFor="callFrequency">Frequency</FieldLabel>
            <select id="callFrequency" value={callFrequency}
              onChange={e => setCallFrequency(e.target.value as CallFrequency)} className={selectCls}>
              <option value="daily">Every day</option>
              <option value="weekdays">Weekdays only</option>
              <option value="every_other">Every other day</option>
              <option value="custom">Custom</option>
            </select>
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="companionName">Companion name</FieldLabel>
          <input id="companionName" type="text" value={companionName}
            onChange={e => setCompanionName(e.target.value)} className={inputCls} placeholder="Clara" />
        </div>

        <div>
          <p className="text-sm font-medium font-body text-dew-text mb-2">Memory</p>
          <div className="flex gap-2">
            {(['normal', 'caution'] as MemoryFlag[]).map(flag => (
              <button
                key={flag}
                type="button"
                onClick={() => setMemoryFlag(flag)}
                className={`px-5 py-2 rounded-pill text-sm font-body font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-dew-primary ${
                  memoryFlag === flag
                    ? 'bg-dew-primary text-white'
                    : 'bg-dew-border text-dew-text hover:bg-dew-chip-bg'
                }`}
                aria-pressed={memoryFlag === flag}
              >
                {flag === 'normal' ? 'Normal' : 'Caution'}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs font-body text-dew-muted">
            Use Caution if memory is a concern — Clara will adjust her conversation style.
          </p>
        </div>
      </div>

      {/* ── Section 3: Who they are ───────────────────────────────── */}
      <SectionDivider title="Who they are" />

      <div className="space-y-4">
        <div>
          <FieldLabel htmlFor="hobbies">Hobbies and interests</FieldLabel>
          <textarea id="hobbies" rows={2} value={hobbies} onChange={e => setHobbies(e.target.value)}
            className={textareaCls}
            placeholder="What does she love doing? Bridge club, gardening, mystery novels…" />
        </div>
        <div>
          <FieldLabel htmlFor="personality">Personality</FieldLabel>
          <textarea id="personality" rows={2} value={personality} onChange={e => setPersonality(e.target.value)}
            className={textareaCls}
            placeholder="Is she chatty or quiet in the mornings? Loves a laugh? Gets anxious easily?" />
        </div>
        <div>
          <FieldLabel htmlFor="healthContext">Anything Clara should be gentle about</FieldLabel>
          <textarea id="healthContext" rows={2} value={healthContext} onChange={e => setHealthContext(e.target.value)}
            className={textareaCls}
            placeholder="Topics to tread gently around, tiring quickly, recent changes…" />
        </div>
        <div>
          <FieldLabel htmlFor="culturalNotes">Cultural notes (optional)</FieldLabel>
          <textarea id="culturalNotes" rows={2} value={culturalNotes} onChange={e => setCulturalNotes(e.target.value)}
            className={textareaCls}
            placeholder="Any topics to avoid or embrace? Special days to acknowledge?" />
        </div>
      </div>

      {/* ── Error / success ───────────────────────────────────────── */}
      {error && (
        <div role="alert" className="mt-6 text-sm text-dew-flag-text bg-dew-flag-bg rounded-lg p-3 font-body">
          {error}
        </div>
      )}
      {saved && (
        <div role="status" aria-live="polite" className="mt-6 text-sm text-dew-primary bg-dew-chip-bg rounded-lg p-3 font-body">
          Changes saved.
        </div>
      )}

      {/* ── Save ─────────────────────────────────────────────────── */}
      <div className="mt-8 pb-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full md:w-auto md:px-8 py-3 rounded-button bg-dew-primary text-white font-body font-medium text-base hover:bg-dew-primary-dk focus:outline-none focus-visible:ring-2 focus-visible:ring-dew-primary focus-visible:ring-offset-2 disabled:opacity-60 transition-colors"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}
