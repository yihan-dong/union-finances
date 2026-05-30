import type { Metadata, Viewport } from 'next'
import { Geist, Instrument_Serif } from 'next/font/google'
import { AuthProvider } from '@/lib/context'
import './globals.css'

const geistSans = Geist({ variable: '--font-sans', subsets: ['latin'] })
const instrumentSerif = Instrument_Serif({ variable: '--font-serif', subsets: ['latin'], weight: '400' })

export const metadata: Metadata = {
  title: 'union finances',
  description: 'Yihan + Sun — money together',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'union finances',
    startupImage: '/apple-touch-icon.png',
  },
  icons: {
    apple: '/apple-touch-icon.png',
  },
}
export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, maximumScale: 1, userScalable: false, themeColor: '#F7F6F3',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${instrumentSerif.variable}`}>
      <body className="min-h-screen bg-[#F7F6F3]">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
