'use client'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

type LoadingContext = 'scan' | 'import' | 'price-check' | 'save' | 'generic'

interface Props {
  visible: boolean
  context?: LoadingContext
  label?: string // optional override for the action label
}

const TIPS: Record<LoadingContext, string[]> = {
  scan: [
    '📸 Pro tip: flat receipts scan better — smooth out those wrinkles!',
    '💡 Track every coffee. Small purchases add up faster than you think.',
    '🧾 Save receipts for warranty claims — they come in handy later.',
    '🎯 The act of tracking spending is often enough to reduce it.',
    '🔍 AI reads totals, items & date — check before saving!',
    '💸 Discretionary spending is the easiest place to find savings.',
    '🌱 Even $5/day saved compounds into something real over a year.',
  ],
  import: [
    '📄 Reading your full bank statement…',
    '🏦 ABA statements usually have USD & KHR columns — AI handles both.',
    '🗂️ Large statements can take a moment — every transaction is being parsed.',
    '✅ You\'ll review each transaction before it gets imported.',
    '📊 Importing beats manual entry — especially for a full month.',
    '🔎 Debits (money out) are pre-selected; credits (money in) go to income.',
    '💡 Review imported categories — AI makes its best guess but you can edit.',
    '🧠 After a few imports, you\'ll see clear patterns in your spending.',
  ],
  'price-check': [
    '🔎 Searching for prices in Cambodia…',
    '🛒 Phnom Penh prices can vary a lot between markets and malls.',
    '💡 Russian Market (Toul Tom Poung) is often the cheapest for goods.',
    '📦 Online (Shopee, AliExpress) can beat local prices for electronics.',
    '🏷️ Always check the unit price, not just the sticker price.',
    '🌐 AI searches live web results — results may vary by stock & timing.',
    '💬 Bargaining is expected at local markets — start at 60% of asking.',
  ],
  save: [
    '💾 Saving your expense…',
    '📝 Consistency is the key to a useful expense tracker.',
    '🏆 Adding expenses right away means you never forget the details.',
    '🎯 Every entry is a data point that makes your budget smarter.',
    '🌟 You\'re building a habit — that\'s the hard part. Keep going!',
  ],
  generic: [
    '⚡ Working on it…',
    '💡 Good financial habits compound just like interest.',
    '🎯 What gets measured gets managed.',
    '🌱 Small consistent actions create big results.',
    '🧘 Good things take a moment — almost there.',
    '📈 Every time you track, you\'re investing in your future self.',
    '🏆 Financial clarity is a superpower. You\'re building it.',
  ],
}

const CONTEXT_LABELS: Record<LoadingContext, string> = {
  scan:          'scanning receipt',
  import:        'reading bank statement',
  'price-check': 'checking prices',
  save:          'saving',
  generic:       'loading',
}

function ProgressDots() {
  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2].map(i => (
        <motion.div key={i} className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.22, ease: 'easeInOut' }} />
      ))}
    </div>
  )
}

function Spinner({ color = 'rgba(0,0,0,0.5)' }: { color?: string }) {
  return (
    <motion.svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="2" strokeLinecap="round"
      animate={{ rotate: 360 }}
      transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </motion.svg>
  )
}

export default function LoadingOverlay({ visible, context = 'generic', label }: Props) {
  const tips = TIPS[context]
  const [tipIndex, setTipIndex] = useState(0)
  const [show, setShow] = useState(false)

  // Rotate tips every 2.5 seconds
  useEffect(() => {
    if (!visible) return
    // Pick a random starting tip
    setTipIndex(Math.floor(Math.random() * tips.length))
    const interval = setInterval(() => {
      setTipIndex(i => (i + 1) % tips.length)
    }, 2500)
    return () => clearInterval(interval)
  }, [visible, tips.length])

  // Small delay before showing (avoids flash for very fast operations)
  useEffect(() => {
    if (visible) {
      const t = setTimeout(() => setShow(true), 120)
      return () => clearTimeout(t)
    } else {
      setShow(false)
    }
  }, [visible])

  const actionLabel = label || CONTEXT_LABELS[context]

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[500] flex items-center justify-center"
          style={{ backgroundColor: 'rgba(255,255,255,0.5)', backdropFilter: 'blur(8px)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}>

          <motion.div
            className="mx-6 w-full max-w-[320px] rounded-3xl overflow-hidden"
            style={{
              backgroundColor: 'rgba(255,255,255,0.92)',
              border: '1px solid rgba(255,255,255,0.9)',
              boxShadow: '0 8px 40px rgba(0,0,0,0.12), 0 2px 12px rgba(0,0,0,0.06)',
            }}
            initial={{ opacity: 0, scale: 0.88, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 8 }}
            transition={{ type: 'tween', duration: 0.26, ease: [0.22, 1, 0.36, 1] }}>

            {/* Top accent bar — brand gradient */}
            <div className="relative h-1 w-full overflow-hidden">
              <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, #534AB7, #1D9E75)' }} />
              <motion.div className="absolute inset-y-0 w-[60%] rounded-full"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)' }}
                animate={{ x: ['-60%', '200%'] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.4 }} />
            </div>

            <div className="px-6 py-5">
              {/* Header row */}
              <div className="flex items-center gap-3 mb-5">
                <Spinner color="rgba(0,0,0,0.45)" />
                <div>
                  <p className="text-xs uppercase tracking-widest font-medium" style={{ color: 'rgba(0,0,0,0.35)', letterSpacing: '0.12em' }}>
                    {actionLabel}
                  </p>
                  <ProgressDots />
                </div>
              </div>

              {/* Tip card */}
              <div className="rounded-2xl px-4 py-3.5 relative overflow-hidden"
                style={{ backgroundColor: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.07)' }}>
                {/* subtle shimmer */}
                <motion.div className="absolute inset-0 opacity-30"
                  style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.8) 50%, transparent 60%)' }}
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', repeatDelay: 0.8 }} />

                <AnimatePresence mode="wait">
                  <motion.p key={tipIndex}
                    className="text-[13px] leading-relaxed relative z-10"
                    style={{ color: 'rgba(0,0,0,0.62)' }}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}>
                    {tips[tipIndex]}
                  </motion.p>
                </AnimatePresence>
              </div>

              {/* Tip counter dots */}
              <div className="flex items-center justify-center gap-1 mt-4">
                {tips.map((_, i) => (
                  <div key={i} className="rounded-full transition-all duration-300"
                    style={{
                      width: i === tipIndex ? 16 : 4,
                      height: 4,
                      backgroundColor: i === tipIndex ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.1)',
                    }} />
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
