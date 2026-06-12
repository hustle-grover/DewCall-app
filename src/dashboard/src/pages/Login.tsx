import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export default function Login() {
  const { signIn } = useAuth()
  const navigate   = useNavigate()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/')
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
            Good to see you again
          </h1>
          <p className="mt-2 font-body text-base text-dew-muted">
            Your parent's morning brief is waiting.
          </p>
        </div>

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
            <label className="block text-sm font-medium font-body text-dew-text mb-1.5" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-button border border-dew-border bg-dew-bg text-dew-text placeholder:text-dew-muted text-base focus:outline-none focus:border-dew-primary focus-visible:ring-2 focus-visible:ring-dew-primary focus-visible:ring-offset-1 transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium font-body text-dew-text mb-1.5" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-button border border-dew-border bg-dew-bg text-dew-text placeholder:text-dew-muted text-base focus:outline-none focus:border-dew-primary focus-visible:ring-2 focus-visible:ring-dew-primary focus-visible:ring-offset-1 transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-button bg-dew-primary text-white font-body font-medium text-base hover:bg-dew-primary-dk focus:outline-none focus-visible:ring-2 focus-visible:ring-dew-primary focus-visible:ring-offset-2 disabled:opacity-60 transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm font-body text-dew-muted">
          New to Dewcall?{' '}
          <Link to="/signup" className="text-dew-primary font-medium hover:underline focus-visible:outline-none focus-visible:underline">
            Create an account
          </Link>
        </p>

      </div>
    </div>
  )
}
