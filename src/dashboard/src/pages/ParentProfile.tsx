import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useSenior } from '../lib/senior'
import { useToast } from '../components/Toast'
import { TIMEZONES } from '../lib/constants'

// ── Types ────────────────────────────────────────────────────────────────────

type CallFrequency = 'daily' | 'weekdays' | 'every_2_days' | '3x_week' | 'custom'
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
  const { senior, seniorId } = useSenior()
  const { showToast }        = useToast()
  const [saving, setSaving]  = useState(false)

  // Form state — populated once from context senior
  const [name,          setName]          = useState('')
  const [preferredName, setPreferredName] = useState('')
  const [phone,         setPhone]         = useState('')
  const [age,           setAge]           = useState('')
  const [timezone,      setTimezone]      = useState('America/New_York')
  const [callTime,      setCallTime]      = useState('09:00')
  const [callFrequency, setCallFrequency] = useState<CallFrequency>('weekdays')
  const [companionName, setCompanionName] = useState('Clara')
  const [memoryFlag,    setMemoryFlag]    = useState<MemoryFlag>('normal')
  const [hobbies,       setHobbies]       = useState('')
  const [personality,   setPersonality]   = useState('')
  const [healthContext, setHealthContext] = useState('')
  const [culturalNotes, setCulturalNotes] = useState('')

  // Populate form from context (runs once when senior is available)
  useEffect(() => {
    if (!senior) return
    setName(senior.full_name)
    setPreferredName(senior.preferred_name ?? '')
    setPhone(senior.phone)
    setAge(senior.age?.toString() ?? '')
    setTimezone(senior.timezone)
    setCallTime(senior.call_time)
    setCallFrequency(senior.call_frequency as CallFrequency)
    setCompanionName(senior.companion_name)
    setMemoryFlag((senior.memory_flag?.toLowerCase() as MemoryFlag) ?? 'normal')
    setHobbies(senior.hobbies ?? '')
    setPersonality(senior.personality_notes ?? '')
    setHealthContext(senior.health_notes ?? '')
    setCulturalNotes(senior.cultural_notes ?? '')
  }, [senior])

  const handleSave = async () => {
    if (!seniorId) return
    setSaving(true)
    try {
      await Promise.all([
        api.put(`/api/seniors/${seniorId}`, {
          full_name:         name,
          preferred_name:    preferredName || undefined,
          phone,
          age:               age ? Number(age) : undefined,
          memory_flag:       memoryFlag.toUpperCase(),
          hobbies:           hobbies || undefined,
          personality_notes: personality || undefined,
          health_notes:      healthContext || undefined,
          cultural_notes:    culturalNotes || undefined,
        }),
        api.put(`/api/seniors/${seniorId}/preferences`, {
          timezone,
          call_time:      callTime,
          call_frequency: callFrequency,
          companion_name: companionName,
        }),
      ])
      showToast('Changes saved')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save. Please try again.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const displayName = senior?.preferred_name || senior?.full_name || 'your parent'

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-[1.75rem] font-semibold text-dew-text">
          About {displayName}
        </h1>
        <p className="mt-1 font-body text-base text-dew-muted">
          Help {companionName || 'Clara'} know {displayName} better
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
            <input id="preferredName" type="text" value={preferredName}
              onChange={e => setPreferredName(e.target.value)}
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
            <input id="age" type="number" min="50" max="120" value={age}
              onChange={e => setAge(e.target.value)} className={inputCls} placeholder="78" />
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
            <input id="callTime" type="time" value={callTime}
              onChange={e => setCallTime(e.target.value)} className={inputCls} />
          </div>
          <div>
            <FieldLabel htmlFor="callFrequency">Frequency</FieldLabel>
            <select id="callFrequency" value={callFrequency}
              onChange={e => setCallFrequency(e.target.value as CallFrequency)} className={selectCls}>
              <option value="daily">Every day</option>
              <option value="weekdays">Weekdays only</option>
              <option value="every_2_days">Every other day</option>
              <option value="3x_week">Three times a week</option>
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
            Use Caution if memory is a concern — {companionName || 'Clara'} will adjust her conversation style.
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
          <FieldLabel htmlFor="healthContext">Anything {companionName || 'Clara'} should be gentle about</FieldLabel>
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
