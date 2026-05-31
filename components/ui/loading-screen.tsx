'use client'
import { motion } from 'framer-motion'
import { FluidSwirl } from './fluid-swirl-shader'

interface LoadingScreenProps {
  /** Short present-tense message shown under the shader */
  message?: string
  /**
   * true  → full-screen (auth gates, pre-layout)
   * false → inline within the dashboard (layout + shader already running)
   */
  fullScreen?: boolean
}

export function LoadingScreen({
  message = 'just a moment',
  fullScreen = true,
}: LoadingScreenProps) {
  if (fullScreen) {
    return (
      <div className="min-h-screen relative overflow-hidden" style={{ backgroundColor: '#F7F6F3' }}>
        {/* Shader fills the screen */}
        <div aria-hidden className="fixed inset-0" style={{ zIndex: 0 }}>
          <FluidSwirl />
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(180deg, rgba(247,246,243,0.42) 0%, rgba(247,246,243,0.62) 55%, rgba(247,246,243,0.82) 100%)',
          }} />
        </div>

        {/* Centered message */}
        <div className="relative flex flex-col items-center justify-center min-h-screen gap-3" style={{ zIndex: 1 }}>
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            style={{ fontFamily: 'var(--font-serif)', color: 'rgba(0,0,0,0.38)', fontSize: '1.25rem' }}
          >
            {message}
          </motion.p>
        </div>
      </div>
    )
  }

  // Inline — dashboard layout already runs the shader in the background
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="flex items-center justify-center"
      style={{ paddingTop: '8rem' }}
    >
      <p style={{ fontFamily: 'var(--font-serif)', color: 'rgba(0,0,0,0.3)', fontSize: '1.1rem' }}>
        {message}
      </p>
    </motion.div>
  )
}
