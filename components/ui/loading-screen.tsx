'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const PHRASES: Record<string, string[]> = {
  'your finances': ['clarity over anxiety', 'awareness is the first step', 'numbers, calmly'],
  'your overview': ['seeing the full picture', 'one month at a time', 'clarity over anxiety'],
  'your expenses': ['seeing where it went', 'every number tells a story', 'awareness is the first step'],
  'your income':   ['counting what came in', 'gratitude for what flows', 'clarity over anxiety'],
  'your budget':   ['seeing where you stand', 'intention over impulse', 'your plan, your peace'],
  'your day':      ['let today find you', 'one moment at a time', 'presence before productivity'],
  'your notes':    ['your words have been waiting', 'thought by thought', 'gather slowly'],
  'your schedule': ['time is already yours', 'no rush, just rhythm', 'the day is taking shape'],
  fallback:        ['just a moment', 'breathe', 'arriving'],
}

interface LoadingScreenProps {
  context?: string
  accentColor?: string
}

export function LoadingScreen({ context = 'your finances', accentColor = '#534AB7' }: LoadingScreenProps) {
  const [phraseIndex, setPhraseIndex] = useState(0)
  const [elapsed, setElapsed]         = useState(0)
  const [progress, setProgress]       = useState(0)
  const phrases = PHRASES[context] || PHRASES.fallback

  useEffect(() => {
    const id = setInterval(() => setPhraseIndex(i => (i + 1) % phrases.length), 2500)
    return () => clearInterval(id)
  }, [phrases.length])

  useEffect(() => {
    const id = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const id = setInterval(() => setProgress(p => p >= 100 ? 100 : p + 0.5), 50)
    return () => clearInterval(id)
  }, [])

  function hexToRgba(hex: string, alpha: number) {
    const clean = hex.replace('#', '')
    const full = clean.length === 3
      ? clean.split('').map(c => c + c).join('')
      : clean
    const r = parseInt(full.slice(0, 2), 16)
    const g = parseInt(full.slice(2, 4), 16)
    const b = parseInt(full.slice(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 flex items-center justify-center"
      style={{ backgroundColor: '#F7F6F3', zIndex: 40 }}
    >
      <div className="flex flex-col items-center justify-center gap-12">
        <div className="text-center space-y-3">
          <div className="h-16 flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.p
                key={phraseIndex}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: 'easeInOut' }}
                className="text-2xl tracking-wide"
                style={{ fontFamily: 'var(--font-serif)', color: 'rgba(0,0,0,0.55)', fontStyle: 'italic' }}
              >
                {phrases[phraseIndex]}
              </motion.p>
            </AnimatePresence>
          </div>
          <p className="text-sm tracking-wider" style={{ color: 'rgba(0,0,0,0.22)' }}>
            loading {context}…
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="relative overflow-hidden rounded-full"
            style={{ width: 180, height: 2, backgroundColor: 'rgba(0,0,0,0.08)' }}
          >
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ backgroundColor: hexToRgba(accentColor, 0.4) }}
              initial={{ width: '0%' }}
              animate={{ width: `${progress}%` }}
              transition={{ ease: 'easeInOut' }}
            />
          </div>
          <span className="text-xs tabular-nums" style={{ color: 'rgba(0,0,0,0.22)', minWidth: 24 }}>
            {elapsed}s
          </span>
        </div>
      </div>
    </motion.div>
  )
}
