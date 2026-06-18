import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    globals: true,
    include: ['lib/daily-csv-export.test.ts', 'lib/billing-plans.test.ts', 'lib/workflow-rules.test.ts', 'lib/request-guidance.test.ts', 'lib/onboarding.test.ts', 'lib/portal-auth-delivery.test.ts', 'lib/today-overview.test.ts', 'lib/tenant-request-language.test.ts', 'lib/vendor-request-state.test.ts'],
  },
})
