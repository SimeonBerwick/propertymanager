import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  typedRoutes: true,
  async redirects() {
    // The August campaign page was retired November 21, 2026. Old ad and shared links land on the product page.
    return [{ source: '/august', destination: '/property-maintenance', permanent: false }]
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb',
    },
  },
}

export default nextConfig
