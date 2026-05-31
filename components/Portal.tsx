'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Renders children into document.body, escaping any parent stacking
 * context (e.g. the dashboard's z-index:1 content wrapper). This lets
 * fixed overlays/sheets sit above the bottom nav reliably.
 */
export default function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(children, document.body)
}
