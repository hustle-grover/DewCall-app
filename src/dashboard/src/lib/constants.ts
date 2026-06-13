export const TIMEZONES = [
  { value: 'America/New_York',    label: 'Eastern Time (ET)' },
  { value: 'America/Chicago',     label: 'Central Time (CT)' },
  { value: 'America/Denver',      label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Phoenix',     label: 'Arizona (MST, no DST)' },
  { value: 'America/Anchorage',   label: 'Alaska (AKT)' },
  { value: 'Pacific/Honolulu',    label: 'Hawaii (HST)' },
  { value: 'America/Toronto',     label: 'Toronto (ET)' },
  { value: 'America/Vancouver',   label: 'Vancouver (PT)' },
  { value: 'Europe/London',       label: 'London (GMT/BST)' },
  { value: 'Europe/Dublin',       label: 'Dublin (GMT/IST)' },
  { value: 'Europe/Paris',        label: 'Paris / Berlin (CET)' },
  { value: 'Australia/Sydney',    label: 'Sydney (AEST)' },
  { value: 'Australia/Melbourne', label: 'Melbourne (AEST)' },
  { value: 'Australia/Perth',     label: 'Perth (AWST)' },
  { value: 'Asia/Singapore',      label: 'Singapore (SGT)' },
  { value: 'Asia/Kolkata',        label: 'India (IST)' },
] as const

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

export type DeliveryChannel = 'sms' | 'whatsapp' | 'email' | 'all'

export const DELIVERY_CHANNELS: {
  id: DeliveryChannel
  icon: string
  title: string
  desc: string
}[] = [
  { id: 'sms',      icon: '📱', title: 'SMS',       desc: 'Quick text to your phone' },
  { id: 'whatsapp', icon: '💬', title: 'WhatsApp',  desc: 'Same number, richer format' },
  { id: 'email',    icon: '📧', title: 'Email',     desc: 'Full brief with more detail' },
  { id: 'all',      icon: '🔔', title: 'All three', desc: "Don't miss a thing" },
]

export const CHANNEL_LABEL: Record<DeliveryChannel, string> = {
  sms:      'SMS',
  whatsapp: 'WhatsApp',
  email:    'Email',
  all:      'SMS, WhatsApp & Email',
}

export const FREQUENCY_LABEL: Record<string, string> = {
  daily:       'every day',
  weekdays:    'every weekday',
  every_other: 'every other day',
  custom:      'on selected days',
}
