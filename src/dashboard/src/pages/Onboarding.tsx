import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'
import DeliveryChannelPicker from '../components/DeliveryChannelPicker'
import { TIMEZONES, DAYS, CHANNEL_LABEL, FREQUENCY_LABEL, type DeliveryChannel } from '../lib/constants'
import { formatTimePretty } from '../lib/format'

// ── Types ────────────────────────────────────────────────────────────────────

type CallFrequency = 'daily' | 'weekdays' | 'every_other' | 'custom'

interface OnboardingData {
  fullName:           string
  phone:              string
  timezone:           string
  seniorFullName:     string
  seniorPreferredName:string
  seniorPhone:        string
  seniorAge:          string
  relationship:       string
  hobbies:            string
  personality:        string
  healthContext:      string
  culturalNotes:      string
  callTime:           string
  seniorTimezone:     string
  callFrequency:      CallFrequency
  customDays:         string[]
  companionName:      string
  deliveryChannel:    DeliveryChannel
  inviteEmails:       string[]
}

// ── Shared form element styles ────────────────────────────────────────────────

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

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Onboarding() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [step,         setStep]         = useState(0)
  const [submitting,   setSubmitting]   = useState(false)
  const [error,        setError]        = useState('')
  const [inviteInput,  setInviteInput]  = useState('')

  const [data, setData] = useState<OnboardingData>({
    fullName:            '',
    phone:               '',
    timezone:            'America/New_York',
    seniorFullName:      '',
    seniorPreferredName: '',
    seniorPhone:         '',
    seniorAge:           '',
    relationship:        'Daughter',
    hobbies:             '',
    personality:         '',
    healthContext:       '',
    culturalNotes:       '',
    callTime:            '09:00',
    seniorTimezone:      'America/New_York',
    callFrequency:       'weekdays',
    customDays:          ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    companionName:       'Clara',
    deliveryChannel:     'sms',
    inviteEmails:        [],
  })

  // Pre-fill name from auth metadata
  useEffect(() => {
    const name = (user?.user_metadata?.full_name as string | undefined) ?? ''
    if (name) setData(prev => ({ ...prev, fullName: name }))
  }, [user])

  useEffect(() => {
    if (!authLoading && !user) navigate('/signup', { replace: true })
  }, [user, authLoading, navigate])

  if (authLoading) {
    return (
      <div className="min-h-[100dvh] bg-dew-bg flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-dew-primary animate-pulse" />
      </div>
    )
  }

  const set = <K extends keyof OnboardingData>(field: K) =>
    (value: OnboardingData[K]) => setData(prev => ({ ...prev, [field]: value }))

  const TOTAL_STEPS = 7
  const preferred = data.seniorPreferredName || data.seniorFullName.split(' ')[0] || 'your parent'

  const canAdvance = (): boolean => {
    if (step === 0) return data.fullName.trim().length > 0
    if (step === 1) return data.seniorFullName.trim().length > 0 && data.seniorPhone.trim().length > 0
    return true
  }

  const handleNext = () => {
    if (!canAdvance()) return
    setError('')
    setStep(s => s + 1)
  }

  const handleBack = () => {
    setError('')
    setStep(s => s - 1)
  }

  const addInvite = () => {
    const email = inviteInput.trim()
    if (email && !data.inviteEmails.includes(email)) {
      set('inviteEmails')([...data.inviteEmails, email])
      setInviteInput('')
    }
  }

  const removeInvite = (email: string) =>
    set('inviteEmails')(data.inviteEmails.filter(e => e !== email))

  const toggleCustomDay = (day: string) => {
    const days = data.customDays.includes(day)
      ? data.customDays.filter(d => d !== day)
      : [...data.customDays, day]
    set('customDays')(days)
  }

  const handleComplete = async () => {
    setSubmitting(true)
    setError('')
    try {
      await api.patch('/api/onboarding/family', {
        full_name: data.fullName,
        phone:     data.phone || undefined,
        timezone:  data.timezone,
      })
      await api.post('/api/onboarding/senior', {
        full_name:        data.seniorFullName,
        preferred_name:   data.seniorPreferredName || undefined,
        phone:            data.seniorPhone,
        age:              data.seniorAge ? Number(data.seniorAge) : undefined,
        relationship:     data.relationship,
        hobbies:          data.hobbies || undefined,
        personality:      data.personality || undefined,
        health_context:   data.healthContext || undefined,
        cultural_notes:   data.culturalNotes || undefined,
        call_time:        data.callTime,
        timezone:         data.seniorTimezone,
        call_frequency:   data.callFrequency,
        custom_days:      data.callFrequency === 'custom' ? data.customDays : undefined,
        companion_name:   data.companionName,
        delivery_channel: data.deliveryChannel,
      })
      if (data.inviteEmails.length > 0) {
        await Promise.all(
          data.inviteEmails.map(email =>
            api.post('/api/family/invite', { email }).catch(() => {})
          )
        )
      }
      await api.post('/api/onboarding/complete', {})
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  // ── Step renders ────────────────────────────────────────────────────────────

  const renderStep = () => {
    switch (step) {

      // STEP 0 — About you
      case 0:
        return (
          <div className="bg-dew-surface rounded-card shadow-card p-6 space-y-4">
            <div>
              <FieldLabel htmlFor="fullName">Your full name</FieldLabel>
              <input id="fullName" type="text" autoComplete="name" value={data.fullName}
                onChange={e => set('fullName')(e.target.value)}
                className={inputCls} placeholder="Sarah Wilson" />
            </div>
            <div>
              <FieldLabel htmlFor="phone">Your phone number</FieldLabel>
              <input id="phone" type="tel" autoComplete="tel" value={data.phone}
                onChange={e => set('phone')(e.target.value)}
                className={inputCls} placeholder="+1 555 000 0000" />
            </div>
            <div>
              <FieldLabel htmlFor="timezone">Your timezone</FieldLabel>
              <select id="timezone" value={data.timezone}
                onChange={e => set('timezone')(e.target.value)} className={selectCls}>
                {TIMEZONES.map(tz => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </div>
          </div>
        )

      // STEP 1 — About your parent
      case 1:
        return (
          <div className="bg-dew-surface rounded-card shadow-card p-6 space-y-4">
            <div>
              <FieldLabel htmlFor="seniorFullName">Their full name</FieldLabel>
              <input id="seniorFullName" type="text" value={data.seniorFullName}
                onChange={e => set('seniorFullName')(e.target.value)}
                className={inputCls} placeholder="Margaret Wilson" />
            </div>
            <div>
              <FieldLabel htmlFor="seniorPreferredName">What they like to be called</FieldLabel>
              <input id="seniorPreferredName" type="text" value={data.seniorPreferredName}
                onChange={e => set('seniorPreferredName')(e.target.value)}
                className={inputCls} placeholder="Maggie" />
            </div>
            <div>
              <FieldLabel htmlFor="seniorPhone">Their phone number</FieldLabel>
              <input id="seniorPhone" type="tel" autoComplete="off" value={data.seniorPhone}
                onChange={e => set('seniorPhone')(e.target.value)}
                className={inputCls} placeholder="+1 555 000 0000" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel htmlFor="seniorAge">Their age (optional)</FieldLabel>
                <input id="seniorAge" type="number" min="50" max="120" value={data.seniorAge}
                  onChange={e => set('seniorAge')(e.target.value)}
                  className={inputCls} placeholder="78" />
              </div>
              <div>
                <FieldLabel htmlFor="relationship">Your relationship</FieldLabel>
                <select id="relationship" value={data.relationship}
                  onChange={e => set('relationship')(e.target.value)} className={selectCls}>
                  <option>Son</option>
                  <option>Daughter</option>
                  <option>Other family member</option>
                </select>
              </div>
            </div>
          </div>
        )

      // STEP 2 — Get to know them
      case 2:
        return (
          <div className="bg-dew-surface rounded-card shadow-card p-6 space-y-4">
            <div>
              <FieldLabel htmlFor="hobbies">Hobbies and interests</FieldLabel>
              <textarea id="hobbies" rows={2} value={data.hobbies}
                onChange={e => set('hobbies')(e.target.value)}
                className={textareaCls}
                placeholder="Bridge club on Tuesdays, loves gardening, mystery novels..." />
            </div>
            <div>
              <FieldLabel htmlFor="personality">Personality</FieldLabel>
              <textarea id="personality" rows={2} value={data.personality}
                onChange={e => set('personality')(e.target.value)}
                className={textareaCls}
                placeholder="Is she chatty? Quiet in the mornings? Loves a good laugh?" />
            </div>
            <div>
              <FieldLabel htmlFor="healthContext">Anything Clara should be gentle about</FieldLabel>
              <textarea id="healthContext" rows={2} value={data.healthContext}
                onChange={e => set('healthContext')(e.target.value)}
                className={textareaCls}
                placeholder="Avoid asking about the hospital visit. She tires easily in the mornings." />
            </div>
            <div>
              <FieldLabel htmlFor="culturalNotes">Cultural notes (optional)</FieldLabel>
              <textarea id="culturalNotes" rows={2} value={data.culturalNotes}
                onChange={e => set('culturalNotes')(e.target.value)}
                className={textareaCls}
                placeholder="Any topics to avoid or embrace? Special days to acknowledge?" />
            </div>
          </div>
        )

      // STEP 3 — Call setup
      case 3:
        return (
          <div className="bg-dew-surface rounded-card shadow-card p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel htmlFor="callTime">Call time</FieldLabel>
                <input id="callTime" type="time" value={data.callTime}
                  onChange={e => set('callTime')(e.target.value)} className={inputCls} />
              </div>
              <div>
                <FieldLabel htmlFor="seniorTimezone">Their timezone</FieldLabel>
                <select id="seniorTimezone" value={data.seniorTimezone}
                  onChange={e => set('seniorTimezone')(e.target.value)} className={selectCls}>
                  {TIMEZONES.map(tz => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium font-body text-dew-text mb-2">Call frequency</p>
              <div className="space-y-2">
                {([
                  ['daily',       'Every day'],
                  ['weekdays',    'Weekdays only (Mon–Fri)'],
                  ['every_other', 'Every other day'],
                  ['custom',      'Custom days'],
                ] as [CallFrequency, string][]).map(([val, label]) => (
                  <label key={val} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="callFrequency"
                      value={val}
                      checked={data.callFrequency === val}
                      onChange={() => set('callFrequency')(val)}
                      className="w-4 h-4 accent-dew-primary"
                    />
                    <span className="font-body text-sm text-dew-text">{label}</span>
                  </label>
                ))}
              </div>

              {data.callFrequency === 'custom' && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  {DAYS.map(day => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleCustomDay(day)}
                      className={`w-11 h-11 rounded-full text-sm font-body font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-dew-primary ${
                        data.customDays.includes(day)
                          ? 'bg-dew-primary text-white'
                          : 'bg-dew-border text-dew-text hover:bg-dew-chip-bg'
                      }`}
                      aria-pressed={data.customDays.includes(day)}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <FieldLabel htmlFor="companionName">Companion name</FieldLabel>
              <input id="companionName" type="text" value={data.companionName}
                onChange={e => set('companionName')(e.target.value)}
                className={inputCls} placeholder="Clara" />
              <p className="mt-1.5 text-xs font-body text-dew-muted">
                This is the name {preferred} will hear on the call.
              </p>
            </div>
          </div>
        )

      // STEP 4 — Delivery channel
      case 4:
        return (
          <div className="bg-dew-surface rounded-card shadow-card p-6">
            <DeliveryChannelPicker
              value={data.deliveryChannel}
              onChange={val => set('deliveryChannel')(val)}
            />
          </div>
        )

      // STEP 5 — Invite family
      case 5:
        return (
          <div className="bg-dew-surface rounded-card shadow-card p-6 space-y-4">
            <div>
              <FieldLabel htmlFor="inviteEmail">Email address</FieldLabel>
              <div className="flex gap-2">
                <input
                  id="inviteEmail"
                  type="email"
                  value={inviteInput}
                  onChange={e => setInviteInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addInvite())}
                  className={inputCls}
                  placeholder="sibling@example.com"
                />
                <button
                  type="button"
                  onClick={addInvite}
                  className="px-4 py-2.5 rounded-button bg-dew-primary text-white font-body font-medium text-sm hover:bg-dew-primary-dk focus:outline-none focus-visible:ring-2 focus-visible:ring-dew-primary focus-visible:ring-offset-2 transition-colors shrink-0"
                >
                  Add
                </button>
              </div>
            </div>

            {data.inviteEmails.length > 0 && (
              <ul className="space-y-2">
                {data.inviteEmails.map(email => (
                  <li key={email} className="flex items-center justify-between text-sm font-body">
                    <span className="text-dew-text">{email}</span>
                    <button
                      type="button"
                      onClick={() => removeInvite(email)}
                      className="text-dew-muted hover:text-dew-flag-text transition-colors text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-dew-primary rounded"
                      aria-label={`Remove ${email}`}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )

      // STEP 6 — All set
      case 6:
        return (
          <div className="text-center space-y-6">
            <div className="text-6xl" role="img" aria-label="Sunrise">🌅</div>

            <div className="bg-dew-surface rounded-card shadow-card p-5 text-left">
              <p className="font-body text-sm text-dew-muted mb-3">Here's what we've set up</p>
              <dl className="space-y-2.5">
                <div className="flex justify-between text-sm font-body">
                  <dt className="text-dew-muted">Calling</dt>
                  <dd className="text-dew-text font-medium">{preferred}</dd>
                </div>
                <div className="flex justify-between text-sm font-body">
                  <dt className="text-dew-muted">Call time</dt>
                  <dd className="text-dew-text font-medium">
                    {formatTimePretty(data.callTime)}, {FREQUENCY_LABEL[data.callFrequency]}
                  </dd>
                </div>
                <div className="flex justify-between text-sm font-body">
                  <dt className="text-dew-muted">Brief sent via</dt>
                  <dd className="text-dew-text font-medium">{CHANNEL_LABEL[data.deliveryChannel]}</dd>
                </div>
                <div className="flex justify-between text-sm font-body">
                  <dt className="text-dew-muted">Companion</dt>
                  <dd className="text-dew-text font-medium">{data.companionName}</dd>
                </div>
              </dl>
            </div>

            <p className="font-body text-sm text-dew-muted">
              {preferred}'s first call is scheduled for tomorrow at{' '}
              <strong className="text-dew-text">{formatTimePretty(data.callTime)}</strong>.
              You'll receive the brief shortly after.
            </p>

            <button
              onClick={handleComplete}
              disabled={submitting}
              className="w-full py-3 rounded-button bg-dew-primary text-white font-body font-medium text-base hover:bg-dew-primary-dk focus:outline-none focus-visible:ring-2 focus-visible:ring-dew-primary focus-visible:ring-offset-2 disabled:opacity-60 transition-colors"
            >
              {submitting ? 'Setting up…' : 'Go to your dashboard →'}
            </button>
          </div>
        )

      default:
        return null
    }
  }

  const STEP_HEADLINES: [string, string][] = [
    ['First, a little about you',          'So we know who to send the brief to.'],
    ['Now, tell us about your parent',      'This helps us make the calls feel personal and warm.'],
    [`Help us get to know ${preferred}`,   'The more Clara knows, the better the conversations. All optional.'],
    [`When should Clara call?`,            `We'll call ${preferred} at this time every morning.`],
    ['Where should we send the brief?',    "We'll send you a warm summary after every call."],
    ['Anyone else should know?',           'Siblings or other family can receive the same brief. Add them now or later.'],
    [`You're all set, ${data.fullName.split(' ')[0] || 'there'} 🌅`, ''],
  ]

  const [headline, subtext] = STEP_HEADLINES[step] ?? ['', '']

  return (
    <div className="min-h-[100dvh] bg-dew-bg flex flex-col items-center justify-center px-4 py-8 overflow-y-auto">
      <div className="w-full max-w-[560px]">

        {/* Progress dots */}
        <div className="flex gap-2 justify-center mb-10" role="progressbar" aria-label="Setup progress" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={TOTAL_STEPS} aria-valuetext={`Step ${step + 1} of ${TOTAL_STEPS}`}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === step ? 'bg-dew-primary' : i < step ? 'bg-dew-primary/40' : 'bg-dew-border'
              }`}
            />
          ))}
        </div>

        {/* Heading */}
        <div className="mb-6 text-center">
          <h1 className="font-display text-[1.75rem] font-semibold text-dew-text leading-snug">
            {headline}
          </h1>
          {subtext && (
            <p className="mt-2 font-body text-base text-dew-muted">{subtext}</p>
          )}
        </div>

        {/* Step content */}
        {renderStep()}

        {/* Step 5 skip link */}
        {step === 5 && (
          <p className="text-center mt-4">
            <button
              type="button"
              onClick={handleNext}
              className="text-sm font-body text-dew-muted hover:text-dew-text transition-colors"
            >
              Skip for now
            </button>
          </p>
        )}

        {/* Error */}
        {error && (
          <div role="alert" className="mt-4 text-sm text-dew-flag-text bg-dew-flag-bg rounded-lg p-3 font-body">
            {error}
          </div>
        )}

        {/* Navigation — hidden on final step (button is inside step content) */}
        {step < TOTAL_STEPS - 1 && (
          <div className="flex justify-between items-center mt-8">
            {step > 0 ? (
              <button
                type="button"
                onClick={handleBack}
                className="text-sm font-body text-dew-muted hover:text-dew-text focus:outline-none focus-visible:underline transition-colors"
              >
                ← Back
              </button>
            ) : <div />}

            <button
              type="button"
              onClick={handleNext}
              disabled={!canAdvance()}
              className="px-6 py-2.5 rounded-button bg-dew-primary text-white font-body font-medium text-sm hover:bg-dew-primary-dk focus:outline-none focus-visible:ring-2 focus-visible:ring-dew-primary focus-visible:ring-offset-2 disabled:opacity-40 transition-colors"
            >
              Continue →
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
