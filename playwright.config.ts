import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}-{projectName}{ext}',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        permissions: ['clipboard-read', 'clipboard-write'],
      },
    },
    {
      name: 'webkit',
      testIgnore: '**/today-visual.e2e.ts',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-webkit',
      testMatch: ['**/daily-entry.e2e.ts', '**/first-use-recovery.e2e.ts', '**/storage-protection.e2e.ts'],
      use: { ...devices['iPhone 13'] },
    },
  ],
});
