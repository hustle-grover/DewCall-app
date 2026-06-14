import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
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
  senior:         Senior | null
  seniorId:       string | null
  loading:        boolean
  noSenior:       boolean
  refreshSenior:  () => Promise<void>
}

const SeniorContext = createContext<SeniorContextType | null>(null)

export function SeniorProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [senior,   setSenior]   = useState<Senior | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [noSenior, setNoSenior] = useState(false)

  const fetchSeniors = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const { seniors } = await api.get<{ seniors: Senior[] }>('/api/seniors')
      if (seniors.length) {
        setSenior(seniors[0])
        setNoSenior(false)
      } else {
        setNoSenior(true)
      }
    } catch {
      // Network error — don't redirect, just leave senior as null
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!user) {
      setSenior(null)
      setNoSenior(false)
      return
    }
    fetchSeniors()
  }, [user, fetchSeniors])

  return (
    <SeniorContext.Provider value={{
      senior,
      seniorId: senior?.id ?? null,
      loading,
      noSenior,
      refreshSenior: fetchSeniors,
    }}>
      {children}
    </SeniorContext.Provider>
  )
}

export function useSenior() {
  const ctx = useContext(SeniorContext)
  if (!ctx) throw new Error('useSenior must be used within SeniorProvider')
  return ctx
}
