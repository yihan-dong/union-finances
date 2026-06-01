'use client'
import { useEffect } from 'react'

// Adds class="android" to <html> on Android devices so CSS can
// disable expensive backdrop-filter blurs without affecting iOS.
export function AndroidClass() {
  useEffect(() => {
    if (/Android/i.test(navigator.userAgent)) {
      document.documentElement.classList.add('android')
    }
  }, [])
  return null
}
