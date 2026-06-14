import { useState, useEffect, useRef } from 'react'
import { Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useSenior } from '../lib/senior'
import { useToast } from '../components/Toast'
import DeliveryChannelPicker from '../components/DeliveryChannelPicker'
import { type DeliveryChannel } from '../lib/constants'

// ── Types ────────────────────────────────────────────────────────────────────

interface FamilyLink {
  id:               string  // link ID (use this for DELETE)
  relationship:     string
  is_primary:       boolean
  family_member_id: string
  family_members: {
    id:                      string
    full_name:               string
    email:                   string
    preferred_brief_channel: string
  }
}

interface SettingsData {
  full_name:               string
  email:                   string
  phone:                   string | null
  preferred_brief_channel: DeliveryChannel
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
  const { user }          = useAuth()
  const { seniorId }      = useSenior()
  const { showToast }     = useToast()
  const channelSaveRef    = useRef<ReturnType<typeof setTimeout>>()

  const [loading,      setLoading]     = useState(true)
  const [saving,       setSaving]      = useState(false)

  // Account fields
  const [displayName,  setDisplayName] = useState('')
  const [phone,        setPhone]       = useState('')
  const [email,        setEmail]       = useState('')

  // Brief delivery
  const [channel,      setChannel]     = useState<DeliveryChannel>('sms')

  // Family members
  const [family,       setFamily]      = useState<FamilyLink[]>([])
  const [inviteEmail,  setInviteEmail] = useState('')
  const [inviteRel,    setInviteRel]   = useState('sibling')
  const [showInvite,   setShowInvite]  = useState(false)
  const [inviting,     setInviting]    = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [settingsRes, familyRes] = await Promise.all([
          api.get<{ settings: SettingsData }>('/api/settings').catch(() => null),
          seniorId
            ? api.get<{ members: FamilyLink[] }>(`/api/family/${seniorId}`).catch(() => null)
            : Promise.resolve(null),
        ])

        if (cancelled) return

        if (settingsRes?.settings) {
          const s = settingsRes.settings
          setDisplayName(s.full_name)
          setEmail(s.email)
          setPhone(s.phone ?? '')
          setChannel(s.preferred_brief_channel ?? 'sms')
        } else {
          setDisplayName((user?.user_metadata?.full_name as string | undefined) ?? '')
          setEmail(user?.email ?? '')
        }

        if (familyRes?.members) setFamily(familyRes.members)
      } catch {
        // silent — show empty state
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [user, seniorId])

  // Auto-save channel after 400ms debounce
  const handleChannelChange = (newChannel: DeliveryChannel) => {
    setChannel(newChannel)
    clearTimeout(channelSaveRef.current)
    channelSaveRef.current = setTimeout(async () => {
      try {
        await api.put('/api/settings', { preferred_brief_channel: newChannel })
        showToast('Brief preference saved')
      } catch {
        showToast('Could not save preference', 'error')
      }
    }, 400)
  }

  const handleSaveAccount = async () => {
    setSaving(true)
    try {
      await api.put('/api/settings', {
        full_name:               displayName,
        phone:                   phone || undefined,
        preferred_brief_channel: channel,
      })
      showToast('Settings saved')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save. Please try again.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleInvite = async () => {
    if (!seniorId || !inviteEmail.trim()) return
    setInviting(true)
    try {
      const link = await api.post<FamilyLink>('/api/family/invite', {
        email:        inviteEmail.trim(),
        seniorId,
        relationship: inviteRel,
      })
      setFamily(prev => [...prev, link])
      setInviteEmail('')
      setInviteRel('sibling')
      setShowInvite(false)
      showToast('Invite sent')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not send invite.', 'error')
    } finally {
      setInviting(false)
    }
  }

  const handleRemoveMember = async (linkId: string) => {
    try {
      await api.del(`/api/family/${linkId}`)
      setFamily(prev => prev.filter(m => m.id !== linkId))
      showToast('Removed from this brief')
    } catch {
      showToast('Could not remove — please try again.', 'error')
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
      <DeliveryChannelPicker value={channel} onChange={handleChannelChange} />

      <SectionDivider />

      {/* ── Section 2: Family members ─────────────────────────────── */}
      <SectionHead title="Family members" />

      {family.length > 0 ? (
        <ul className="space-y-2 mb-4">
          {family.map(link => {
            const member = link.family_members
            return (
              <li
                key={link.id}
                className="flex items-center justify-between bg-dew-surface rounded-card shadow-card px-4 py-3"
              >
                <div>
                  <p className="font-body text-sm font-medium text-dew-text">
                    {member.full_name || member.email}
                    {link.is_primary && (
                      <span className="ml-2 text-xs text-dew-muted font-normal">(you)</span>
                    )}
                  </p>
                  {member.full_name && (
                    <p className="font-body text-xs text-dew-muted">{member.email}</p>
                  )}
                  {link.relationship && (
                    <p className="font-body text-xs text-dew-muted capitalize">{link.relationship}</p>
                  )}
                </div>
                {!link.is_primary && (
                  <button
                    onClick={() => handleRemoveMember(link.id)}
                    className="text-dew-muted hover:text-dew-flag-text transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-dew-primary rounded p-1"
                    aria-label={`Remove ${member.full_name || member.email}`}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="font-body text-sm text-dew-muted mb-4">
          Just you for now. Siblings or other family members can receive the same brief.
        </p>
      )}

      {showInvite ? (
        <div className="space-y-3 mt-2">
          <div className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleInvite()}
              className={inputCls}
              placeholder="sibling@example.com"
              autoFocus
            />
            <select
              value={inviteRel}
              onChange={e => setInviteRel(e.target.value)}
              className={`${inputCls} w-auto`}
            >
              <option value="daughter">Daughter</option>
              <option value="son">Son</option>
              <option value="sibling">Sibling</option>
              <option value="spouse">Spouse</option>
              <option value="grandchild">Grandchild</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleInvite}
              disabled={inviting || !inviteEmail.trim()}
              className="px-4 py-2.5 rounded-button bg-dew-primary text-white font-body font-medium text-sm hover:bg-dew-primary-dk focus:outline-none focus-visible:ring-2 focus-visible:ring-dew-primary focus-visible:ring-offset-2 disabled:opacity-60 transition-colors"
            >
              {inviting ? 'Sending…' : 'Send invite'}
            </button>
            <button
              onClick={() => { setShowInvite(false); setInviteEmail('') }}
              className="px-3 py-2.5 rounded-button border border-dew-border text-sm font-body text-dew-muted hover:text-dew-text transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-dew-primary"
            >
              Cancel
            </button>
          </div>
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
