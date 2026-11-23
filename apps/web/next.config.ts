import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const nextConfig: NextConfig = { typedRoutes: true, agentRules: false }
export default createNextIntlPlugin()(nextConfig)
