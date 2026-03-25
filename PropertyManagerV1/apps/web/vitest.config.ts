import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    globals: true,
    // Run test files sequentially to avoid SQLite write conflicts
    fileParallelism: false,
    env: {
      DATABASE_URL: 'file:./test.db',
      NODE_ENV: 'test',
    },
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/setup.ts'],
    testTimeout: 20000,
  },
})
