'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/context'
import { motion, AnimatePresence } from 'framer-motion'
import type { UserIdentity } from '@/lib/types'
import { FluidSwirl } from '@/components/ui/fluid-swirl-shader'
import { LoadingScreen } from '@/components/ui/loading-screen'

const IDENTITIES: { identity: UserIdentity; email: string }[] = [
  { identity: 'yihan',   email: 'yihan@union.app'   },
  { identity: 'sun',     email: 'sun@union.app'     },
  { identity: 'sokim',   email: 'sokim@union.app'   },
  { identity: 'sambath', email: 'sambath@union.app' },
]

const PAD = ['1','2','3','4','5','6','7','8','9','','0','⌫']

type Screen = 'password' | 'profile' | 'pin'

function useTypewriter(text: string, speed = 55, delay = 300) {
  const [displayed, setDisplayed] = useState('')
  useEffect(() => {
    setDisplayed('')
    let i = 0
    const timeout = setTimeout(() => {
      const interval = setInterval(() => {
        i++
        setDisplayed(text.slice(0, i))
        if (i >= text.length) clearInterval(interval)
      }, speed)
      return () => clearInterval(interval)
    }, delay)
    return () => clearTimeout(timeout)
  }, [text, speed, delay])
  return displayed
}

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -40 : 40, opacity: 0 }),
}

export default function LoginPage() {
  const { user, loading, signIn, resolveProfile } = useAuth()
  const router = useRouter()

  const [screen, setScreen] = useState<Screen>('password')
  const [direction, setDirection] = useState(1)
  const [sharedPassword, setSharedPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [selectedIdentity, setSelectedIdentity] = useState<UserIdentity | null>(null)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState(false)
  const [pinErrorMsg, setPinErrorMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const heroText = useTypewriter('money together', 55, 200)

  const selectedProfile = selectedIdentity ? resolveProfile(selectedIdentity) : null
  const selectedEmail = IDENTITIES.find(i => i.identity === selectedIdentity)?.email ?? ''

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard/overview')
  }, [user, loading, router])

  useEffect(() => {
    if (pin.length === 4 && screen === 'pin' && selectedIdentity) {
      handlePinSubmit()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin])

  function goTo(next: Screen, dir: number) {
    setDirection(dir)
    setScreen(next)
  }

  function pressKey(key: string) {
    if (submitting) return
    if (key === '⌫') setPin(p => p.slice(0, -1))
    else if (pin.length < 4) setPin(p => p + key)
  }

  async function handlePinSubmit() {
    if (!selectedIdentity || !selectedEmail || submitting) return
    setSubmitting(true)
    setPinErrorMsg('')
    const { error } = await signIn(selectedEmail, sharedPassword.trim() + pin)
    if (error) {
      // Surface a readable reason — helps diagnose "account not created yet" vs wrong credentials
      const msg = (error as Error).message || ''
      const friendlyMsg = msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('credentials')
        ? 'wrong password or pin'
        : msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('no user')
          ? 'account not set up yet — ask Yihan'
          : 'sign-in failed — try again'
      setPinErrorMsg(friendlyMsg)
      setPinError(true)
      setTimeout(() => { setPinError(false); setPin(''); setSubmitting(false) }, 1200)
    } else {
      setSubmitting(false)
    }
  }

  if (loading) return <LoadingScreen message="just a breath" />

  return (
    <div className="min-h-screen overflow-hidden relative" style={{ backgroundColor: '#F7F6F3' }}>

      {/* ── Fluid swirl — password screen only ────────────── */}
      <AnimatePresence>
        {screen === 'password' && (
          <motion.div
            aria-hidden
            className="fixed inset-0 pointer-events-none"
            style={{ zIndex: 0 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            <FluidSwirl />
            {/* Frosted overlay — keeps text readable */}
            <div className="absolute inset-0" style={{
              background: 'linear-gradient(180deg, rgba(247,246,243,0.45) 0%, rgba(247,246,243,0.62) 60%, rgba(247,246,243,0.80) 100%)',
            }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Solid background for profile + pin screens */}
      {screen !== 'password' && (
        <div aria-hidden className="fixed inset-0 pointer-events-none" style={{ zIndex: 0, backgroundColor: '#F7F6F3' }} />
      )}

      <div className="relative" style={{ zIndex: 1 }}>
        <AnimatePresence mode="wait" custom={direction}>

          {/* ── Screen 3: PIN ── */}
          {screen === 'pin' && selectedProfile && (
            <motion.div
              key="pin"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: [0.32, 0, 0.67, 0] }}
              className="min-h-screen flex flex-col items-center justify-center px-8"
            >
              <div className="w-full max-w-xs">
                <motion.div
                  className="flex flex-col items-center mb-10"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.4 }}
                >
                  <motion.div
                    className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center text-white text-lg font-semibold mb-4"
                    style={{ backgroundColor: selectedProfile.color }}
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.05 }}
                  >
                    {selectedProfile.avatar_url ? (
                      <img src={selectedProfile.avatar_url} alt={selectedProfile.name} className="w-full h-full object-cover" />
                    ) : (
                      selectedProfile.initials
                    )}
                  </motion.div>
                  <p className="text-xl mb-1" style={{ fontFamily: 'var(--font-serif)', color: '#1A1A1A' }}>
                    {selectedProfile.name}
                  </p>
                  <p className="text-xs" style={{ color: 'rgba(0,0,0,0.35)' }}>enter your pin</p>
                </motion.div>

                {/* PIN dots */}
                <div className="flex justify-center gap-4 mb-3">
                  {[0,1,2,3].map(i => (
                    <motion.div
                      key={i}
                      className="w-3.5 h-3.5 rounded-full"
                      animate={{
                        backgroundColor: pinError
                          ? 'rgba(220,38,38,0.45)'
                          : i < pin.length ? selectedProfile.color : 'rgba(0,0,0,0.12)',
                        scale: pinError ? [1, 1.4, 1] : i < pin.length ? 1.15 : 1,
                        x: pinError ? [-4, 4, -4, 4, 0] : 0,
                      }}
                      transition={
                        pinError
                          ? { duration: 0.4, type: 'tween', ease: 'easeInOut' }
                          : { type: 'spring', stiffness: 400, damping: 15 }
                      }
                    />
                  ))}
                </div>

                {/* Error message */}
                <div className="h-7 flex items-center justify-center mb-7">
                  <AnimatePresence>
                    {pinErrorMsg && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="text-xs text-center"
                        style={{ color: 'rgba(220,38,38,0.75)' }}>
                        {pinErrorMsg}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                {/* Numpad */}
                <motion.div
                  className="grid grid-cols-3 gap-3"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15, duration: 0.35 }}
                >
                  {PAD.map((key, i) => (
                    <motion.button
                      key={i}
                      onClick={() => key && pressKey(key)}
                      whileTap={key ? { scale: 0.92 } : {}}
                      className="h-16 rounded-2xl text-xl font-medium"
                      style={key
                        ? {
                            backgroundColor: '#FFFFFF',
                            color: '#1A1A1A',
                            border: '1px solid rgba(0,0,0,0.07)',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                          }
                        : { pointerEvents: 'none' }
                      }
                    >
                      {key === '⌫' ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="mx-auto">
                          <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/>
                          <line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/>
                        </svg>
                      ) : key}
                    </motion.button>
                  ))}
                </motion.div>

                <motion.button
                  onClick={() => { goTo('profile', -1); setPin(''); setPinError(false) }}
                  className="mt-10 w-full text-xs text-center"
                  style={{ color: 'rgba(0,0,0,0.28)' }}
                  whileTap={{ opacity: 0.5 }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  ← back
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── Screen 2: Profile selection ── */}
          {screen === 'profile' && (
            <motion.div
              key="profile"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: [0.32, 0, 0.67, 0] }}
              className="min-h-screen flex flex-col items-center justify-center px-8"
            >
              <div className="w-full max-w-sm">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                >
                  <p className="text-sm text-center mb-2" style={{ color: 'rgba(0,0,0,0.35)' }}>now,</p>
                  <h1 className="text-4xl text-center mb-12" style={{ fontFamily: 'var(--font-serif)', color: '#1A1A1A' }}>
                    who are you?
                  </h1>
                </motion.div>

                {/* Avatar pill row */}
                <div className="flex gap-3 justify-center">
                  {IDENTITIES.map(({ identity }, i) => {
                    const profile = resolveProfile(identity)
                    const isActive = selectedIdentity === identity
                    return (
                      <motion.button
                        key={identity}
                        onClick={() => {
                          if (isActive) { setPin(''); goTo('pin', 1) }
                          else setSelectedIdentity(identity)
                        }}
                        className="flex items-center rounded-full"
                        style={{
                          padding: '5px',
                          paddingRight: isActive ? '16px' : '5px',
                          backgroundColor: isActive ? profile.color : 'rgba(0,0,0,0.07)',
                          transition: 'background-color 0.28s ease, padding-right 0.28s ease',
                        }}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.08 + i * 0.07, duration: 0.4, type: 'spring', stiffness: 280, damping: 22 }}
                        whileTap={{ scale: 0.93 }}
                      >
                        {/* Avatar */}
                        <div
                          className="w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center text-white text-sm font-semibold overflow-hidden"
                          style={{
                            backgroundColor: isActive ? 'rgba(255,255,255,0.22)' : profile.color,
                            transition: 'background-color 0.28s ease',
                          }}
                        >
                          {profile.avatar_url
                            ? <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover" />
                            : profile.initials}
                        </div>
                        {/* Expandable name */}
                        <div
                          className="grid"
                          style={{
                            gridTemplateColumns: isActive ? '1fr' : '0fr',
                            transition: 'grid-template-columns 0.28s ease',
                          }}
                        >
                          <div className="overflow-hidden">
                            <span
                              className="whitespace-nowrap text-sm font-medium text-white"
                              style={{ paddingLeft: 10 }}
                            >
                              {profile.name}
                            </span>
                          </div>
                        </div>
                      </motion.button>
                    )
                  })}
                </div>

                {/* Tap-again hint */}
                <div className="h-8 flex items-center justify-center mt-5">
                  <AnimatePresence>
                    {selectedIdentity && (
                      <motion.p
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.25 }}
                        className="text-xs"
                        style={{ color: 'rgba(0,0,0,0.3)' }}
                      >
                        tap again to continue →
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                <motion.button
                  onClick={() => { goTo('password', -1); setSharedPassword(''); setSelectedIdentity(null) }}
                  className="mt-10 w-full text-xs text-center"
                  style={{ color: 'rgba(0,0,0,0.28)' }}
                  whileTap={{ opacity: 0.5 }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  ← back
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── Screen 1: Shared password ── */}
          {screen === 'password' && (
            <motion.div
              key="password"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: [0.32, 0, 0.67, 0] }}
              className="min-h-screen flex flex-col px-6"
            >
              <div className="flex-1 flex flex-col justify-center pt-24 pb-12 max-w-sm mx-auto w-full">
                <motion.p
                  className="text-2xl mb-1"
                  style={{ fontFamily: 'var(--font-serif)', color: 'rgba(0,0,0,0.2)' }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6 }}
                >
                  union finances
                </motion.p>

                <h1
                  className="text-4xl leading-[1.2] mb-12 whitespace-pre-line"
                  style={{
                    fontFamily: 'var(--font-serif)',
                    color: '#1A1A1A',
                    minHeight: '3rem',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {heroText}
                  <motion.span
                    animate={{ opacity: [1, 0] }}
                    transition={{
                      duration: 0.6,
                      repeat: heroText.length < 'money together'.length ? Infinity : 3,
                      repeatType: 'reverse',
                    }}
                    style={{ color: 'rgba(0,0,0,0.25)', marginLeft: 2 }}
                  >
                    |
                  </motion.span>
                </h1>

                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.0, duration: 0.5 }}
                >
                  <label className="text-[10px] uppercase tracking-widest mb-3 block" style={{ color: 'rgba(0,0,0,0.3)' }}>
                    shared password
                  </label>

                  <div
                    className="flex items-center gap-3 px-4 py-4 rounded-2xl mb-3"
                    style={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid rgba(0,0,0,0.08)',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    }}
                  >
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={sharedPassword}
                      onChange={e => setSharedPassword(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && sharedPassword.trim() && goTo('profile', 1)}
                      placeholder="enter your shared password"
                      autoFocus
                      autoComplete="current-password"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      className="flex-1 text-sm bg-transparent outline-none"
                      style={{ color: '#1A1A1A' }}
                    />
                    <button
                      onClick={() => setShowPassword(v => !v)}
                      className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl transition-colors"
                      style={{ color: showPassword ? '#1A1A1A' : 'rgba(0,0,0,0.38)', backgroundColor: showPassword ? 'rgba(0,0,0,0.05)' : 'transparent' }}>
                      {showPassword ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                          <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      )}
                    </button>
                  </div>

                  <motion.button
                    onClick={() => sharedPassword.trim() && goTo('profile', 1)}
                    disabled={!sharedPassword.trim()}
                    className="w-full py-4 rounded-2xl text-sm font-medium text-white disabled:opacity-40"
                    style={{ backgroundColor: '#1A1A1A' }}
                    whileTap={{ scale: 0.98 }}
                    whileHover={{ opacity: 0.88 }}
                  >
                    continue
                  </motion.button>
                </motion.div>
              </div>

              <motion.p
                className="pb-12 text-center text-xs"
                style={{ color: 'rgba(0,0,0,0.18)' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.4 }}
              >
                union · phnom penh
              </motion.p>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}
