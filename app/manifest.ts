import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'union finances',
    short_name: 'finances',
    description: 'Yihan + Sun — money together',
    start_url: '/',
    display: 'standalone',
    background_color: '#F7F6F3',
    theme_color: '#F7F6F3',
    orientation: 'portrait',
    icons: [
      {
        src: '/bitcoinicon.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/bitcoinicon.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
