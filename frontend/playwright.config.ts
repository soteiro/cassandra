import { defineConfig, devices } from '@playwright/test';
import { BACKEND_PORT, BASE_URL, FRONTEND_PORT, e2eDatabaseUrl } from './e2e/support/env.mjs';

const STORAGE_STATE = 'e2e/.auth/user.json';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 2 : undefined,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: STORAGE_STATE },
      dependencies: ['setup'],
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], storageState: STORAGE_STATE },
      dependencies: ['setup'],
    },
  ],
  webServer: [
    {
      // Backend real contra la base de datos e2e (recreada por e2e/scripts/reset-db.mjs).
      command: 'go run .',
      cwd: '../backend',
      url: `http://localhost:${BACKEND_PORT}/api/health`,
      env: {
        DATABASE_URL_LOCAL: e2eDatabaseUrl(),
        PORT: String(BACKEND_PORT),
        // Solo para e2e; el backend exige al menos 32 caracteres.
        JWT_SECRET: 'e2e-jwt-secret-solo-para-tests-0123456789',
        RATE_LIMIT_PER_MIN: '100000',
      },
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: `pnpm exec ng serve --port ${FRONTEND_PORT} --proxy-config proxy.e2e.conf.json`,
      url: BASE_URL,
      reuseExistingServer: !process.env['CI'],
      timeout: 180_000,
    },
  ],
});
