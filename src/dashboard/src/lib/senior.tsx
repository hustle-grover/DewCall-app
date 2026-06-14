import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { api } from './api'
import { useAuth } from './auth'

export interface Senior {
  id:                string
  full_name:         string
  preferred_name:    string | null
  phone:             string
  age:               number | null
  timezone:          string
  call_time:         string
  call_frequency:    string
  companion_name:    string
  memory_flag:       string | null
  hobbies:           string | null
  personality_notes: string | null
  health_notes:      string | null
  cultural_notes:    string | null
}

interface SeniorContextType {
  senior:   Senior | null
  seniorId: string | null
  loading:  boolean
  noSenior: boolean
}

const SeniorContext = createContext<SeniorContextType | null>(null)

export function SeniorProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [senior,   setSenior]   = useState<Senior | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [noSenior, setNoSenior] = useState(false)

  useEffect(() => {
    if (!user) {
      setSenior(null)
      setNoSenior(false)
      return
    }

    setLoading(true)
    let cancelled = false

    api.get<{ seniors: Senior[] }>('/api/seniors')
      .then(({ seniors }) => {
        if (cancelled) return
        if (seniors.length) {
          setSenior(seniors[0])
          setNoSenior(false)
        } else {
          setNoSenior(true)
        }
      })
      .catch(() => {
        if (!cancelled) setSenior(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [user])

  return (
    <SeniorContext.Provider value={{ senior, seniorId: senior?.id ?? null, loading, noSenior }}>
      {children}
    </SeniorContext.Provider>
  )
}

export function useSenior() {
  const ctx = useContext(SeniorContext)
  if (!ctx) throw new Error('useSenior must be used within SeniorProvider')
  return ctx
}
