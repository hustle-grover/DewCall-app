import { useState, useEffect } from 'react'
import { Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import DeliveryChannelPicker from '../components/DeliveryChannelPicker'
import { type DeliveryChannel } from '../lib/constants'

// ── Types ────────────────────────────────────────────────────────────────────

interface FamilyMember {
  id:       string
  name:     string
  email:    string
}

interface SettingsData {
  full_name:        string
  email:            string
  phone:            string
  delivery_channel: DeliveryChannel
}

// ── Section heading ───────────────────────────────────────────────────────────

function SectionHead({ title }: { title: string }) {
  return <h2 className="font-display text-lg font-semibold text-dew-text mb-5">{title}</h2>
}

function SectionDivider() {
  return <hr className="border-dew-border my-8" />
}

const inputCls =
  'w-full px-4 py-2.5 rounded-button border border-dew-border bg-dew-bg text-dew-text ' +
  'placeholder:text-dew-muted text-base focus:outline-none focus:border-dew-primary ' +
  'focus-visible:ring-2 focus-visible:ring-dew-primary focus-visible:ring-offset-1 transition-colors'

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Settings() {
  const { user } = useAuth()

  const [senior,         setSenior]        = useState<{ id: string; name: string } | null>(null)
  const [loading,        setLoading]       = useState(true)
  const [saving,         setSaving]        = useState(false)
  const [saved,          setSaved]         = useState(false)
  const [error,          setError]         = useState('')

  // Account fields
  const [displayName,    setDisplayName]   = useState('')
  const [phone,          setPhone]         = useState('')
  const [email,          setEmail]         = useState('')

  // Brief delivery
  const [channel,        setChannel]       = useState<DeliveryChannel>('sms')

  // Family members
  const [family,         setFamily]        = useState<FamilyMember[]>([])
  const [inviteEmail,    setInviteEmail]   = useState('')
  const [showInvite,     setShowInvite]    = useState(false)
  const [inviting,       setInviting]      = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [settings, seniors] = await Promise.all([
          api.get<SettingsData>('/api/settings').catch(() => null),
          api.get<{ id: string; name: string }[]>('/api/seniors').catch(() => []),
        ])

        if (cancelled) return

        const s = seniors[0] ?? null
        setSenior(s)

        if (settings) {
          setDisplayName(settings.full_name)
          setEmail(settings.email)
          setPhone(settings.phone ?? '')
          setChannel(settings.delivery_channel ?? 'sms')
        } else {
          // Fall back to auth user metadata
          const metaName = (user?.user_metadata?.full_name as string | undefined) ?? ''
          const metaEmail = user?.email ?? ''
          setDisplayName(metaName)
          setEmail(metaEmail)
        }

        if (s) {
          const members = await api.get<FamilyMember[]>(`/api/family/${s.id}`).catch(() => [])
          if (!cancelled) setFamily(members)
        }
      } catch {
        // silent — empty state
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [user])

  const handleSaveAccount = async () => {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      await api.put('/api/settings', {
        full_name:        displayName,
        phone:            phone || undefined,
        delivery_channel: channel,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleInvite = async () => {
    if (!senior || !inviteEmail.trim()) return
    setInviting(true)
    try {
      const member = await api.post<FamilyMember>(`/api/family/${senior.id}`, { email: inviteEmail.trim() })
      setFamily(prev => [...prev, member])
      setInviteEmail('')
      setShowInvite(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send invite.')
    } finally {
      setInviting(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!senior) return
    try {
      await api.del(`/api/family/${senior.id}/${memberId}`)
      setFamily(prev => prev.filter(m => m.id !== memberId))
    } catch {
      // silent — UI stays as-is
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse" aria-hidden="true">
        <div className="h-8 w-32 bg-dew-border rounded" />
        <div className="h-32 bg-dew-border rounded-card" />
        <div className="h-20 bg-dew-border rounded-card" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-[1.75rem] font-semibold text-dew-text">Settings</h1>
      </div>

      {/* ── Section 1: Your brief ─────────────────────────────────── */}
      <SectionHead title="Your brief" />
      <DeliveryChannelPicker value={channel} onChange={setChannel} />

      <SectionDivider />

      {/* ── Section 2: Family members ─────────────────────────────── */}
      <SectionHead title="Family members" />

      {family.length > 0 ? (
        <ul className="space-y-2 mb-4">
          {family.map(member => (
            <li
              key={member.id}
              className="flex items-center justify-between bg-dew-surface rounded-card shadow-card px-4 py-3"
            >
              <div>
                <p className="font-body text-sm font-medium text-dew-text">{member.name || member.email}</p>
                {member.name && (
                  <p className="font-body text-xs text-dew-muted">{member.email}</p>
                )}
              </div>
              <button
                onClick={() => handleRemoveMember(member.id)}
                className="text-dew-muted hover:text-dew-flag-text transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-dew-primary rounded p-1"
                aria-label={`Remove ${member.name || member.email}`}
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-body text-sm text-dew-muted mb-4">
          Just you for now. Siblings or other family members can receive the same brief.
        </p>
      )}

      {showInvite ? (
        <div className="flex gap-2 mt-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleInvite()}
            className={inputCls}
            placeholder="sibling@example.com"
            autoFocus
          />
          <button
            onClick={handleInvite}
            disabled={inviting || !inviteEmail.trim()}
            className="px-4 py-2.5 rounded-button bg-dew-primary text-white font-body font-medium text-sm hover:bg-dew-primary-dk focus:outline-none focus-visible:ring-2 focus-visible:ring-dew-primary focus-visible:ring-offset-2 disabled:opacity-60 transition-colors shrink-0"
          >
            {inviting ? 'Sending…' : 'Send invite'}
          </button>
          <button
            onClick={() => { setShowInvite(false); setInviteEmail('') }}
            className="px-3 py-2.5 rounded-button border border-dew-border text-sm font-body text-dew-muted hover:text-dew-text transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-dew-primary shrink-0"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowInvite(true)}
          className="px-5 py-2 rounded-button border-[1.5px] border-dew-primary text-sm font-body font-medium text-dew-primary hover:bg-dew-chip-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-dew-primary focus-visible:ring-offset-1 transition-colors"
        >
          Invite someone
        </button>
      )}

      <SectionDivider />

      {/* ── Section 3: Your account ───────────────────────────────── */}
      <SectionHead title="Your account" />

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium font-body text-dew-text mb-1.5" htmlFor="displayName">
            Display name
          </label>
          <input
            id="displayName"
            type="text"
            autoComplete="name"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-sm font-medium font-body text-dew-text mb-1.5" htmlFor="accountEmail">
            Email
          </label>
          <input
            id="accountEmail"
            type="email"
            value={email}
            readOnly
            className={`${inputCls} opacity-60 cursor-not-allowed`}
          />
        </div>
        <div>
          <label className="block text-sm font-medium font-body text-dew-text mb-1.5" htmlFor="accountPhone">
            Phone
          </label>
          <input
            id="accountPhone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className={inputCls}
            placeholder="+1 555 000 0000"
          />
        </div>
      </div>

      {error && (
        <div role="alert" className="mt-4 text-sm text-dew-flag-text bg-dew-flag-bg rounded-lg p-3 font-body">
          {error}
        </div>
      )}
      {saved && (
        <div role="status" aria-live="polite" className="mt-4 text-sm text-dew-primary bg-dew-chip-bg rounded-lg p-3 font-body">
          Settings saved.
        </div>
      )}

      <div className="mt-6">
        <button
          type="button"
          onClick={handleSaveAccount}
          disabled={saving}
          className="w-full md:w-auto md:px-8 py-3 rounded-button bg-dew-primary text-white font-body font-medium text-base hover:bg-dew-primary-dk focus:outline-none focus-visible:ring-2 focus-visible:ring-dew-primary focus-visible:ring-offset-2 disabled:opacity-60 transition-colors"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      <SectionDivider />

      {/* ── Section 4: Subscription (placeholder) ────────────────── */}
      <SectionHead title="Subscription" />

      <div className="bg-dew-surface rounded-card shadow-card p-5 flex items-center justify-between gap-4">
        <div>
          <p className="font-body text-base font-medium text-dew-text">Active — $25/month</p>
          <p className="font-body text-xs text-dew-muted mt-0.5">Cancel anytime</p>
        </div>
        <button
          disabled
          className="px-4 py-2 rounded-button border border-dew-border text-sm font-body text-dew-muted opacity-50 cursor-not-allowed"
        >
          Manage billing
        </button>
      </div>
      <p className="mt-2 text-xs font-body text-dew-muted">
        Billing management coming soon.
      </p>
    </div>
  )
}
