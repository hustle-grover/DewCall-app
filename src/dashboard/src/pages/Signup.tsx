import { useState, useEffect, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

export default function Signup() {
  const navigate      = useNavigate()
  const [params]      = useSearchParams()
  const token         = params.get('token')

  const [fullName,  setFullName]  = useState('')
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)

  // Whether the email came from a paid-subscriber welcome link
  const [tokenEmail, setTokenEmail] = useState<string | null>(null)
  const [tokenError, setTokenError] = useState('')

  // Validate the ?token= and pre-fill email if present
  useEffect(() => {
    if (!token) return

    fetch(`${BASE_URL}/api/auth/onboarding-token?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then((data: { email?: string; error?: string }) => {
        if (data.email) {
          setTokenEmail(data.email)
          setEmail(data.email)
        } else {
          setTokenError(data.error ?? 'This link is invalid or has expired.')
        }
      })
      .catch(() => setTokenError('Could not validate your link. Please try again or contact hello@dewcall.app.'))
  }, [token])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      })
      if (error) throw error
      navigate('/onboarding')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] bg-dew-bg flex items-center justify-center px-4 py-8 overflow-y-auto">
      <div className="w-full max-w-sm">

        <div className="mb-8 text-center">
          <p className="font-display text-xl font-semibold text-dew-primary mb-4 tracking-tight">
            Dewcall
          </p>
          <h1 className="font-display text-[2rem] font-semibold text-dew-text leading-snug">
            {tokenEmail ? 'Create your account' : 'Let\'s get started'}
          </h1>
          <p className="mt-2 font-body text-base text-dew-muted">
            {tokenEmail
              ? 'Choose a password to finish setting up your account.'
              : 'Set up your parent\'s morning calls in minutes.'}
          </p>
        </div>

        {tokenError && (
          <div
            role="alert"
            className="mb-4 text-sm font-body text-dew-flag-text bg-dew-flag-bg rounded-lg p-3"
          >
            {tokenError}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="bg-dew-surface rounded-card shadow-card p-6 space-y-4"
          noValidate
        >
          {error && (
            <div
              role="alert"
              className="text-sm font-body text-dew-flag-text bg-dew-flag-bg rounded-lg p-3"
            >
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium font-body text-dew-text mb-1.5" htmlFor="fullName">
              Your full name
            </label>
            <input
              id="fullName"
              type="text"
              required
              autoComplete="name"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-button border border-dew-border bg-dew-bg text-dew-text placeholder:text-dew-muted text-base focus:outline-none focus:border-dew-primary focus-visible:ring-2 focus-visible:ring-dew-primary focus-visible:ring-offset-1 transition-colors"
              placeholder="Sarah Wilson"
            />
          </div>

          <div>
            <label className="block text-sm font-medium font-body text-dew-text mb-1.5" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={e => !tokenEmail && setEmail(e.target.value)}
              readOnly={!!tokenEmail}
              className={`w-full px-4 py-2.5 rounded-button border border-dew-border text-dew-text text-base focus:outline-none transition-colors ${
                tokenEmail
                  ? 'bg-dew-chip-bg text-dew-muted cursor-default'
                  : 'bg-dew-bg placeholder:text-dew-muted focus:border-dew-primary focus-visible:ring-2 focus-visible:ring-dew-primary focus-visible:ring-offset-1'
              }`}
              placeholder="you@example.com"
            />
            {tokenEmail && (
              <p className="mt-1 text-xs font-body text-dew-muted">
                This is the email address tied to your subscription.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium font-body text-dew-text mb-1.5" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-button border border-dew-border bg-dew-bg text-dew-text placeholder:text-dew-muted text-base focus:outline-none focus:border-dew-primary focus-visible:ring-2 focus-visible:ring-dew-primary focus-visible:ring-offset-1 transition-colors"
              placeholder="8+ characters"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-button bg-dew-primary text-white font-body font-medium text-base hover:bg-dew-primary-dk focus:outline-none focus-visible:ring-2 focus-visible:ring-dew-primary focus-visible:ring-offset-2 disabled:opacity-60 transition-colors"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm font-body text-dew-muted">
          Already have an account?{' '}
          <Link to="/login" className="text-dew-primary font-medium hover:underline focus-visible:outline-none focus-visible:underline">
            Sign in
          </Link>
        </p>

      </div>
    </div>
  )
}
