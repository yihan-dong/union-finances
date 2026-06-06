'use client'
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const MONTHS  = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
const HEADERS = ['su','mo','tu','we','th','fr','sa']

interface DatePickerProps {
  value: string                        // YYYY-MM-DD or ''
  onChange: (val: string) => void
  placeholder?: string
  accentColor?: string
  className?: string
  fullWidth?: boolean                  // stretches trigger to fill container
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'pick a date',
  accentColor = '#534AB7',
  className = '',
  fullWidth = false,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const ref             = useRef<HTMLDivElement>(null)

  const now    = new Date()
  const parsed = value ? new Date(value + 'T00:00:00') : null

  const [viewYear,  setViewYear]  = useState(parsed?.getFullYear()  ?? now.getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth()      ?? now.getMonth())

  // Sync view when value changes externally
  useEffect(() => {
    if (parsed) { setViewYear(parsed.getFullYear()); setViewMonth(parsed.getMonth()) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  // Close on outside click / escape
  useEffect(() => {
    if (!open) return
    function onMouse(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onMouse)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onMouse); document.removeEventListener('keydown', onKey) }
  }, [open])

  const todayStr = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')

  const displayValue = parsed
    ? `${MONTHS[parsed.getMonth()]} ${parsed.getDate()}`
    : ''

  function selectDay(day: number) {
    const m = String(viewMonth + 1).padStart(2, '0')
    const d = String(day).padStart(2, '0')
    onChange(`${viewYear}-${m}-${d}`)
    setOpen(false)
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const firstDay    = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div ref={ref} className={`relative ${fullWidth ? 'w-full' : 'inline-block'}`}>
      {/* ── Trigger ── */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 rounded-2xl transition-colors ${fullWidth ? 'w-full' : ''} ${className}`}
        style={{
          padding: fullWidth ? '12px 16px' : '8px 14px',
          backgroundColor: value ? `${accentColor}0D` : 'rgba(0,0,0,0.04)',
          border: `1px solid ${value ? accentColor + '30' : 'rgba(0,0,0,0.08)'}`,
          color: value ? '#1A1A1A' : 'rgba(0,0,0,0.35)',
        }}
      >
        {/* Calendar icon */}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke={value ? accentColor : 'rgba(0,0,0,0.3)'}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0 }}
        >
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8"  y1="2" x2="8"  y2="6"/>
          <line x1="3"  y1="10" x2="21" y2="10"/>
        </svg>

        <span className="text-sm flex-1 text-left">
          {displayValue || placeholder}
        </span>

        {/* Clear */}
        {value && (
          <span
            role="button"
            onClick={e => { e.stopPropagation(); onChange('') }}
            className="text-sm leading-none"
            style={{ color: 'rgba(0,0,0,0.25)' }}
          >
            ×
          </span>
        )}
      </button>

      {/* ── Calendar popup ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="absolute z-50 mt-2"
            style={{
              top: '100%',
              left: 0,
              backgroundColor: '#FFFFFF',
              border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: 20,
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              width: 264,
              padding: 16,
            }}
          >
            {/* Month nav */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={prevMonth}
                className="w-7 h-7 flex items-center justify-center rounded-full"
                style={{ backgroundColor: 'rgba(0,0,0,0.04)' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="rgba(0,0,0,0.45)" strokeWidth="2" strokeLinecap="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>

              <span className="text-xs font-medium" style={{ color: '#1A1A1A' }}>
                {MONTHS[viewMonth]} {viewYear}
              </span>

              <button
                onClick={nextMonth}
                className="w-7 h-7 flex items-center justify-center rounded-full"
                style={{ backgroundColor: 'rgba(0,0,0,0.04)' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="rgba(0,0,0,0.45)" strokeWidth="2" strokeLinecap="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {HEADERS.map(h => (
                <div key={h} className="text-center text-[9px] uppercase tracking-widest py-1"
                  style={{ color: 'rgba(0,0,0,0.25)' }}>
                  {h}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-y-0.5">
              {cells.map((day, i) => {
                if (!day) return <div key={i} />
                const m       = String(viewMonth + 1).padStart(2, '0')
                const d       = String(day).padStart(2, '0')
                const dateStr = `${viewYear}-${m}-${d}`
                const isSel   = dateStr === value
                const isToday = dateStr === todayStr
                return (
                  <button
                    key={i}
                    onClick={() => selectDay(day)}
                    className="flex items-center justify-center rounded-full mx-auto"
                    style={{
                      width: 32, height: 32,
                      backgroundColor: isSel ? accentColor : isToday ? `${accentColor}14` : 'transparent',
                      color: isSel ? '#FFFFFF' : isToday ? accentColor : 'rgba(0,0,0,0.72)',
                      fontSize: 12,
                      fontWeight: isSel || isToday ? 600 : 400,
                    }}
                  >
                    {day}
                  </button>
                )
              })}
            </div>

            {/* Today shortcut */}
            <div className="mt-3 pt-3 border-t" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
              <button
                onClick={() => { onChange(todayStr); setOpen(false) }}
                className="w-full text-xs py-1.5 rounded-xl"
                style={{ color: accentColor, backgroundColor: `${accentColor}0D` }}
              >
                today
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
