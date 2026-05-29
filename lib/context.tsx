'use client'
import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { UserIdentity } from '@/lib/types'

export type { UserIdentity }

export interface AuthUser {
  id: string
  email: string
  identity: UserIdentity
  name: string
  initials: string
  color: string
  avatar_url?: string | null
}

export interface ProfileOverride {
  identity: UserIdentity
  name?: string
  initials?: string
  color?: string
  avatar_url?: string | null
}

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  overrides: Record<UserIdentity, ProfileOverride>
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  updateProfile: (identity: UserIdentity, updates: Partial<Omit<ProfileOverride, 'identity'>>) => Promise<{ error: Error | null }>
  resolveProfile: (identity: UserIdentity) => { identity: UserIdentity; name: string; initials: string; color: string; avatar_url: string | null | undefined }
}

const BASE_PROFILES: Record<UserIdentity, { identity: UserIdentity; name: string; initials: string; color: string }> = {
  yihan: { identity: 'yihan', name: 'Yihan', initials: 'YD', color: '#534AB7' },
  sun:   { identity: 'sun',   name: 'Sun',   initials: 'SR', color: '#1D9E75' },
}

function applyOverride(
  base: { identity: UserIdentity; name: string; initials: string; color: string },
  ov: ProfileOverride | undefined,
) {
  if (!ov) return { ...base, avatar_url: null as string | null | undefined }
  return {
    identity:   base.identity,
    name:       ov.name       ?? base.name,
    initials:   ov.initials   ?? base.initials,
    color:      ov.color      ?? base.color,
    avatar_url: ov.avatar_url ?? null,
  }
}

function profileFromEmail(email: string, overrides: Record<UserIdentity, ProfileOverride>) {
  const lower = email.toLowerCase()
  for (const id of Object.keys(BASE_PROFILES) as UserIdentity[]) {
    if (lower.includes(id)) return applyOverride(BASE_PROFILES[id], overrides[id])
  }
  return null
}

const AuthContext = createContext<AuthContextType | null>(null)
const DEV_USER = process.env.NEXT_PUBLIC_DEV_USER as UserIdentity | undefined

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [overrides, setOverrides] = useState<Record<UserIdentity, ProfileOverride>>({
    yihan: { identity: 'yihan' },
    sun:   { identity: 'sun' },
  })

  const loadOverrides = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('profile_overrides').select('*')
      if (error) return
      if (data) {
        const next: Record<UserIdentity, ProfileOverride> = {
          yihan: { identity: 'yihan' },
          sun:   { identity: 'sun' },
        }
        for (const row of data as ProfileOverride[]) {
          if (row.identity === 'yihan' || row.identity === 'sun') next[row.identity] = row
        }
        setOverrides(next)
      }
    } catch {}
  }, [])

  useEffect(() => { loadOverrides() }, [loadOverrides])

  // Re-apply override onto current user whenever overrides change
  useEffect(() => {
    setUser(prev => {
      if (!prev) return prev
      const merged = applyOverride(BASE_PROFILES[prev.identity], overrides[prev.identity])
      return { ...prev, ...merged }
    })
  }, [overrides])

  useEffect(() => {
    if (DEV_USER && BASE_PROFILES[DEV_USER]) {
      const merged = applyOverride(BASE_PROFILES[DEV_USER], overrides[DEV_USER])
      setUser({ id: 'dev', email: `${DEV_USER}@union.app`, ...merged })
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        const profile = profileFromEmail(session.user.email, overrides)
        if (profile) setUser({ id: session.user.id, email: session.user.email, ...profile })
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        const profile = profileFromEmail(session.user.email, overrides)
        if (profile) setUser({ id: session.user.id, email: session.user.email, ...profile })
        else setUser(null)
      } else {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error as Error | null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  const updateProfile = async (
    identity: UserIdentity,
    updates: Partial<Omit<ProfileOverride, 'identity'>>,
  ): Promise<{ error: Error | null }> => {
    setOverrides(prev => ({
      ...prev,
      [identity]: { ...prev[identity], ...updates, identity },
    }))
    try {
      const { error } = await supabase
        .from('profile_overrides')
        .upsert({ identity, ...updates }, { onConflict: 'identity' })
      if (error) return { error: error as unknown as Error }
      await loadOverrides()
      return { error: null }
    } catch (e) {
      return { error: e as Error }
    }
  }

  const resolveProfile = (identity: UserIdentity) =>
    applyOverride(BASE_PROFILES[identity], overrides[identity])

  return (
    <AuthContext.Provider value={{ user, loading, overrides, signIn, signOut, updateProfile, resolveProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
