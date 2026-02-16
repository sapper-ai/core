import path from 'node:path'

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@sapper-ai/core', '@sapper-ai/types'],
  experimental: {
    outputFileTracingRoot: path.join(process.cwd(), '../..'),
  },
}

export default nextConfig
