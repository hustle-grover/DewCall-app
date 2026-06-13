import { DELIVERY_CHANNELS, type DeliveryChannel } from '../lib/constants'

interface DeliveryChannelPickerProps {
  value: DeliveryChannel
  onChange: (channel: DeliveryChannel) => void
}

export default function DeliveryChannelPicker({ value, onChange }: DeliveryChannelPickerProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {DELIVERY_CHANNELS.map(ch => (
        <button
          key={ch.id}
          type="button"
          onClick={() => onChange(ch.id)}
          className={`flex items-start gap-3 p-4 rounded-card border-[1.5px] text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-dew-primary focus-visible:ring-offset-1 ${
            value === ch.id
              ? 'border-dew-primary bg-dew-chip-bg'
              : 'border-dew-border bg-dew-surface hover:border-dew-primary/40'
          }`}
          aria-pressed={value === ch.id}
        >
          <span className="text-xl leading-none shrink-0 mt-0.5" aria-hidden="true">{ch.icon}</span>
          <div>
            <p className="font-body text-sm font-semibold text-dew-text">{ch.title}</p>
            <p className="font-body text-xs text-dew-muted mt-0.5">{ch.desc}</p>
          </div>
        </button>
      ))}
    </div>
  )
}
