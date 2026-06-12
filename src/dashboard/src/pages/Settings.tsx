export default function Settings() {
  return (
    <div>
      <h1 className="font-display text-[1.75rem] font-semibold text-dew-text mb-6">
        Settings
      </h1>
      <div className="bg-dew-surface rounded-card shadow-card p-10 text-center">
        <div className="text-5xl mb-4" role="img" aria-label="Settings cog">⚙️</div>
        <h2 className="font-display text-xl font-semibold text-dew-text mb-2">
          Your preferences
        </h2>
        <p className="font-body text-base text-dew-muted leading-relaxed max-w-xs mx-auto">
          Call times, delivery preferences, and account settings. Coming in the next session.
        </p>
      </div>
    </div>
  )
}
