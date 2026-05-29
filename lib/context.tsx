'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from './supabase'

export type UserIdentity = 'yihan' | 'sun'

export interface AuthUser {
  id: string
  email: string
  identity: UserIdentity
  name: string
  initials: string
  color: string
}

const BASE_PROFILES: Record<UserIdentity, Omit<AuthUser, 'id' | 'email'>> = {
  yihan: { identity: 'yihan', name: 'Yihan', initials: 'YD', color: '#534AB7' },
  sun:   { identity: 'sun',   name: 'Sun',   initials: 'SR', color: '#1D9E75' },
}

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)
const DEV_USER = process.env.NEXT_PUBLIC_DEV_USER as UserIdentity | undefined

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  function profileFromEmail(email: string): AuthUser | null {
    const lower = email.toLowerCase()
    for (const [id, profile] of Object.entries(BASE_PROFILES)) {
      if (lower.includes(id)) return { id: '', email, ...profile }
    }
    return null
  }

  useEffect(() => {
    if (DEV_USER && BASE_PROFILES[DEV_USER]) {
      setUser({ id: 'dev', email: `${DEV_USER}@union.app`, ...BASE_PROFILES[DEV_USER] })
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        const p = profileFromEmail(session.user.email)
        if (p) setUser({ ...p, id: session.user.id })
      }
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user?.email) {
        const p = profileFromEmail(session.user.email)
        if (p) setUser({ ...p, id: session.user.id })
        else setUser(null)
      } else setUser(null)
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{
      user, loading,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return { error: error as Error | null }
      },
      signOut: async () => { await supabase.auth.signOut(); setUser(null) },
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
