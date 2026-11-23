import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:3000' },
  webServer: {
    command: process.env.CI ? 'pnpm build && pnpm start' : 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
