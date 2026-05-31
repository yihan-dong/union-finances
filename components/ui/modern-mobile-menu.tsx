'use client'
import React, { useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// ── Union SVG icons ────────────────────────────────────────
function OverviewIcon({ active, color }: { active: boolean; color: string }) {
  const c = active ? color : 'rgba(0,0,0,0.28)'
  return (
    <svg className="menu-icon-svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>
      <path d="M22 12A10 10 0 0 0 12 2v10z"/>
    </svg>
  )
}

function ExpensesIcon({ active, color }: { active: boolean; color: string }) {
  const c = active ? color : 'rgba(0,0,0,0.28)'
  return (
    <svg className="menu-icon-svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
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
    <svg className="menu-icon-svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
      <polyline points="17 6 23 6 23 12"/>
    </svg>
  )
}

function BudgetIcon({ active, color }: { active: boolean; color: string }) {
  const c = active ? color : 'rgba(0,0,0,0.28)'
  return (
    <svg className="menu-icon-svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
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
    <svg className="menu-icon-svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="3" width="17" height="3" rx="1.5"/>
      <path d="M5.5 6h13v14a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5.5 20V6z"/>
      <rect x="7" y="9" width="10" height="7" rx="1.5"/>
      <path d="M8.5 12.5Q10.5 11 12.5 12.5Q14.5 14 16.5 12.5"/>
    </svg>
  )
}

// ── Tab definitions ────────────────────────────────────────
const TABS = [
  { href: '/dashboard/overview',  label: 'overview',  Icon: OverviewIcon  },
  { href: '/dashboard/expenses',  label: 'expenses',  Icon: ExpensesIcon  },
  { href: '/dashboard/income',    label: 'income',    Icon: IncomeIcon    },
  { href: '/dashboard/budget',    label: 'budget',    Icon: BudgetIcon    },
  { href: '/dashboard/assistant', label: 'assistant', Icon: AssistantIcon },
]

// ── Component ──────────────────────────────────────────────
interface ModernNavProps {
  accentColor?: string
}

export function ModernNav({ accentColor = '#534AB7' }: ModernNavProps) {
  const pathname   = usePathname()
  const textRefs   = useRef<(HTMLElement | null)[]>([])
  const itemRefs   = useRef<(HTMLAnchorElement | null)[]>([])
  const activeIndex = TABS.findIndex(t => pathname.startsWith(t.href))

  // Measure text width and set --lineWidth on each item
  useEffect(() => {
    function measure() {
      TABS.forEach((_, i) => {
        const item = itemRefs.current[i]
        const text = textRefs.current[i]
        if (item && text) {
          const w = i === activeIndex ? text.offsetWidth : 0
          item.style.setProperty('--lineWidth', `${w}px`)
        }
      })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [activeIndex])

  return (
    <nav
      className="menu"
      role="navigation"
      style={{ '--component-active-color': accentColor } as React.CSSProperties}
    >
      {TABS.map(({ href, label, Icon }, index) => {
        const isActive = index === activeIndex
        return (
          <Link
            key={href}
            href={href}
            className={`menu__item${isActive ? ' active' : ''}`}
            ref={el => { itemRefs.current[index] = el }}
            style={{ '--lineWidth': '0px' } as React.CSSProperties}
          >
            <div className="menu__icon">
              <Icon active={isActive} color={accentColor} />
            </div>
            <strong
              className={`menu__text${isActive ? ' active' : ''}`}
              ref={el => { textRefs.current[index] = el as HTMLElement | null }}
            >
              {label}
            </strong>
          </Link>
        )
      })}
    </nav>
  )
}
