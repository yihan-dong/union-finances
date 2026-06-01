'use client'

// Minimal loading screen — just the background colour so fast loads are seamless.
// No animation, no text; avoids the flash-of-loading-UI on quick data fetches.
export function LoadingScreen() {
  return (
    <div className="fixed inset-0" style={{ backgroundColor: '#F7F6F3' }} />
  )
}
