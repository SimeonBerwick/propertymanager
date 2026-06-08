import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Simeonware: Maintenance Manager',
    short_name: 'Maintenance Manager',
    description: 'Maintenance coordination for property managers, tenants, and vendors.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#1a56db',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  }
}
