import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  typedRoutes: true,
  outputFileTracingRoot: process.cwd(),
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb',
    },
  },
}

export default nextConfig
