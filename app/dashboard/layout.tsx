'use client'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/lib/context'
import TreeBackground from '@/components/TreeBackground'

const TABS = [
  { href: '/dashboard/overview',   label: 'overview',   Icon: OverviewIcon   },
  { href: '/dashboard/expenses',   label: 'expenses',   Icon: ExpensesIcon   },
  { href: '/dashboard/income',     label: 'income',     Icon: IncomeIcon     },
  { href: '/dashboard/budget',     label: 'budget',     Icon: BudgetIcon     },
  { href: '/dashboard/assistant',  label: 'assistant',  Icon: AssistantIcon  },
]

function OverviewIcon({ active, color }: { active: boolean; color: string }) {
  const c = active ? color : 'rgba(0,0,0,0.28)'
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>
      <path d="M22 12A10 10 0 0 0 12 2v10z"/>
    </svg>
  )
}

function ExpensesIcon({ active, color }: { active: boolean; color: string }) {
  const c = active ? color : 'rgba(0,0,0,0.28)'
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  )
}

function IncomeIcon({ active, color }: { active: boolean; color: string }) {
  const c = active ? color : 'rgba(0,0,0,0.28)'
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
      <polyline points="17 6 23 6 23 12"/>
    </svg>
  )
}

function BudgetIcon({ active, color }: { active: boolean; color: string }) {
  const c = active ? color : 'rgba(0,0,0,0.28)'
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="21" x2="4" y2="14"/>
      <line x1="4" y1="10" x2="4" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12" y2="3"/>
      <line x1="20" y1="21" x2="20" y2="16"/>
      <line x1="20" y1="12" x2="20" y2="3"/>
      <line x1="1" y1="14" x2="7" y2="14"/>
      <line x1="9" y1="8" x2="15" y2="8"/>
      <line x1="17" y1="16" x2="23" y2="16"/>
    </svg>
  )
}

function AssistantIcon({ active, color }: { active: boolean; color: string }) {
  const c = active ? color : 'rgba(0,0,0,0.28)'
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a4 4 0 0 1 4 4v1h1a3 3 0 0 1 0 6h-1v1a4 4 0 0 1-8 0v-1H7a3 3 0 0 1 0-6h1V6a4 4 0 0 1 4-4z"/>
      <path d="M9 10h.01M15 10h.01M9.5 15a3.5 3.5 0 0 0 5 0"/>
    </svg>
  )
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
          <div className="flex items-center gap-2.5">
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
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-5 pb-8" style={{ zIndex: 50 }}>
        <div
          className="flex items-center rounded-2xl p-1.5"
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid rgba(0,0,0,0.07)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          }}
        >
          {TABS.map(({ href, label, Icon }) => {
            const isActive = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl transition-all duration-200"
                style={isActive ? { backgroundColor: 'rgba(0,0,0,0.04)' } : {}}
              >
                <Icon active={isActive} color={user.color} />
                <span className="text-[9px] font-medium tracking-wide" style={{ color: isActive ? user.color : 'rgba(0,0,0,0.28)' }}>
                  {label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
