import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// The date tests read local time. Set here, in the process that loads this config, rather than only
// through test.env: Stryker's runner reuses its own workers and never applies that env to them.
process.env.TZ = 'UTC'

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify('0.0.0-test'),
  },
  test: {
    environment: 'jsdom',
    env: { TZ: 'UTC' },
    unstubEnvs: true,
    unstubGlobals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      // Both are entry points that only wire real browser globals together (createRoot, the
      // service worker's `self`); everything they call lives in tested modules.
      exclude: ['src/main.tsx', 'src/sw.ts', 'src/**/*.d.ts'],
      thresholds: {
        100: true,
      },
    },
  },
})
