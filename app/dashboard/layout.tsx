'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/lib/context'
import TreeBackground from '@/components/TreeBackground'
import { ModernNav } from '@/components/ui/modern-mobile-menu'

const BG_STORAGE_KEY = 'union:finances-bg'

async function compressBg(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const MAX = 1600
      const scale = img.width > MAX ? MAX / img.width : 1
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('failed')) }
    img.src = url
  })
}


const PAGE_TITLES: Record<string, string> = {
  '/dashboard/overview':  'overview',
  '/dashboard/expenses':  'expenses',
  '/dashboard/income':    'income',
  '/dashboard/budget':    'budget',
  '/dashboard/assistant': 'assistant',
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const pageTitle = PAGE_TITLES[pathname] ?? 'union finances'
  const bgInputRef = useRef<HTMLInputElement>(null)
  const [hasBg, setHasBg] = useState(false)
  const [bgUploading, setBgUploading] = useState(false)

  useEffect(() => {
    try {
      const v = localStorage.getItem(BG_STORAGE_KEY)
      setHasBg(!!v && v !== 'DEFAULT')
    } catch {}
  }, [])

  async function handleBgFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setBgUploading(true)
    try {
      const dataUrl = await compressBg(file)
      localStorage.setItem(BG_STORAGE_KEY, dataUrl)
      setHasBg(true)
      window.dispatchEvent(new CustomEvent('union:bg-changed'))
    } catch { /* silent */ }
    finally { setBgUploading(false) }
    e.target.value = ''
  }

  function resetBg() {
    localStorage.setItem(BG_STORAGE_KEY, 'DEFAULT')
    setHasBg(false)
    window.dispatchEvent(new CustomEvent('union:bg-changed'))
  }

  useEffect(() => {
    if (!loading && !user) router.replace('/')
  }, [user, loading, router])

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F7F6F3' }}>
        <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'rgba(0,0,0,0.15)' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ backgroundColor: '#F7F6F3', maxWidth: '100vw' }}>
      <TreeBackground />
      <div className="max-w-md mx-auto relative overflow-x-hidden" style={{ zIndex: 1 }}>
        {/* Header — flows naturally with content */}
        <header className="flex items-center justify-between px-6 pt-12 pb-3">
          <span className="text-2xl" style={{ fontFamily: 'var(--font-serif)', color: '#1A1A1A' }}>
            {pageTitle}
          </span>
          <div className="flex items-center gap-2">
            {/* Background picker */}
            <input ref={bgInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgFile} />
            {hasBg ? (
              <button onClick={resetBg} className="w-7 h-7 flex items-center justify-center rounded-full transition-colors"
                style={{ color: 'rgba(0,0,0,0.3)' }} title="remove background">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            ) : (
              <button onClick={() => !bgUploading && bgInputRef.current?.click()}
                className="w-7 h-7 flex items-center justify-center rounded-full transition-colors"
                style={{ color: bgUploading ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.3)' }} title="set background photo">
                {bgUploading ? (
                  <motion.svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
                    animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </motion.svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2.5"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                )}
              </button>
            )}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0 overflow-hidden"
              style={{ backgroundColor: user.color }}
            >
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                user.initials
              )}
            </div>
            <button onClick={signOut} className="text-[11px] transition-colors" style={{ color: 'rgba(0,0,0,0.22)' }}>
              out
            </button>
          </div>
        </header>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>

        {/* Spacer for fixed nav */}
        <div className="h-32" />
      </div>

      {/* Fixed bottom nav */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-5 pb-8" style={{ zIndex: 50 }}>
        <ModernNav accentColor={user.color} />
      </div>
    </div>
  )
}
