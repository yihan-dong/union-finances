'use client'
import { useEffect, useState } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { supabase } from '@/lib/supabase'

const BG_STORAGE_KEY = 'union:finances-bg'
const BG_BUCKET = 'app-assets'

export default function TreeBackground() {
  const [bg, setBg] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function resolve() {
      let resolved = false

      let cached: string | null = null
      try { cached = localStorage.getItem(BG_STORAGE_KEY) } catch {}

      const userReset = cached === 'DEFAULT'

      if (!userReset && cached) {
        if (!cancelled) setBg(cached)
        resolved = true
      }

      if (!userReset) {
        try {
          const { data: files } = await supabase.storage.from(BG_BUCKET).list('shared', {
            limit: 50,
            sortBy: { column: 'created_at', order: 'desc' },
          })
          const latest = files?.find(f => f.name.startsWith('background'))
          if (latest) {
            const { data } = supabase.storage.from(BG_BUCKET).getPublicUrl(`shared/${latest.name}`)
            const url = `${data.publicUrl}?v=${latest.updated_at ?? latest.created_at ?? Date.now()}`
            if (!cancelled) {
              setBg(url)
              resolved = true
              try { localStorage.setItem(BG_STORAGE_KEY, url) } catch {}
            }
            return
          }
          if (resolved) {
            resolved = false
            try { localStorage.removeItem(BG_STORAGE_KEY) } catch {}
            if (!cancelled) setBg(null)
          }
        } catch {
          // bucket may not exist yet — fall through
        }
      }

      // no local fallback — FluidSwirl handles the default background
    }

    resolve()

    function onStorage(e: StorageEvent) {
      if (e.key === BG_STORAGE_KEY) resolve()
    }
    function onBgChanged() { resolve() }
    window.addEventListener('storage', onStorage)
    window.addEventListener('union:bg-changed', onBgChanged)
    return () => {
      cancelled = true
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('union:bg-changed', onBgChanged)
    }
  }, [])

  const { scrollY } = useScroll()
  const y     = useTransform(scrollY, v => -v * 0.35)
  const scale = useTransform(scrollY, [0, 800], [1.05, 1.10])

  if (!bg) return null

  return (
    <div
      aria-hidden
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0, overflow: 'hidden' }}
    >
      <motion.div
        style={{
          position: 'absolute',
          inset: '-8% -4% -8% -4%',
          backgroundImage: `url("${bg}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          y,
          scale,
          filter: 'blur(5px) saturate(1)',
          opacity: 0.7,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, rgba(247,246,243,0.35) 0%, rgba(247,246,243,0.55) 60%, rgba(247,246,243,0.75) 100%)',
        }}
      />
    </div>
  )
}
