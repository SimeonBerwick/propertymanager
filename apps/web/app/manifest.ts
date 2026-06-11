import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Simeonware Property Maintenance',
    short_name: 'Simeonware',
    description: 'Coordinate property maintenance requests, tenants, vendors, approvals, and billing.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f6f9fc',
    theme_color: '#1877e8',
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
