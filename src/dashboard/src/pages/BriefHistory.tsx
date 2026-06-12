export default function BriefHistory() {
  return (
    <div>
      <h1 className="font-display text-[1.75rem] font-semibold text-dew-text mb-6">
        Recent mornings
      </h1>
      <div className="bg-dew-surface rounded-card shadow-card p-10 text-center">
        <div className="text-5xl mb-4" role="img" aria-label="Sunrise">🌅</div>
        <h2 className="font-display text-xl font-semibold text-dew-text mb-2">
          Your call history will live here
        </h2>
        <p className="font-body text-base text-dew-muted leading-relaxed max-w-xs mx-auto">
          After the first few mornings, you'll be able to look back through previous briefs — like a journal of good conversations.
        </p>
      </div>
    </div>
  )
}
