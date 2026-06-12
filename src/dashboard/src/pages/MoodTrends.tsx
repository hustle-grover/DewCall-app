export default function MoodTrends() {
  return (
    <div>
      <h1 className="font-display text-[1.75rem] font-semibold text-dew-text mb-6">
        How things have been
      </h1>
      <div className="bg-dew-surface rounded-card shadow-card p-10 text-center">
        <div className="text-5xl mb-4" role="img" aria-label="Growing plant">🌱</div>
        <h2 className="font-display text-xl font-semibold text-dew-text mb-2">
          Patterns take a little time
        </h2>
        <p className="font-body text-base text-dew-muted leading-relaxed max-w-xs mx-auto">
          Over the coming weeks, you'll be able to see how Mum has been feeling week by week. A few calls in, it starts to tell a story.
        </p>
      </div>
    </div>
  )
}
