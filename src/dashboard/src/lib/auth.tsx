import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { api } from './api'

interface AuthContextType {
  user:        User | null
  session:     Session | null
  loading:     boolean
  profileName: string | null
  signIn:      (email: string, password: string) => Promise<void>
  signOut:     () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,        setUser]        = useState<User | null>(null)
  const [session,     setSession]     = useState<Session | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [profileName, setProfileName] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Resolve first name once user is known: metadata → /api/auth/me → null
  useEffect(() => {
    if (!user) { setProfileName(null); return }

    const metaName = user.user_metadata?.full_name as string | undefined
    if (metaName) { setProfileName(metaName.split(' ')[0]); return }

    api.get<{ familyMember: { full_name: string } | null }>('/api/auth/me')
      .then(({ familyMember }) => {
        setProfileName(familyMember?.full_name?.split(' ')[0] ?? null)
      })
      .catch(() => {})
  }, [user])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, profileName, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
