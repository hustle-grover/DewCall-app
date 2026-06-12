export default function ParentProfile() {
  return (
    <div>
      <h1 className="font-display text-[1.75rem] font-semibold text-dew-text mb-6">
        About Mum
      </h1>
      <div className="bg-dew-surface rounded-card shadow-card p-10 text-center">
        <div className="text-5xl mb-4" role="img" aria-label="Person">👩‍🦳</div>
        <h2 className="font-display text-xl font-semibold text-dew-text mb-2">
          Mum's profile lives here
        </h2>
        <p className="font-body text-base text-dew-muted leading-relaxed max-w-xs mx-auto">
          Her name, call time, interests, and anything the AI should know. Setting this up well makes every morning call feel more personal.
        </p>
      </div>
    </div>
  )
}
