import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: '.env.test' });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: process.env.FRONTEND_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npx tsx start-backend.ts',
      cwd: __dirname,
      url: process.env.API_HEALTH_URL || 'http://localhost:5050/health',
      timeout: 120000,
      reuseExistingServer: true,
    },
    {
      command: 'npm run build && npm run start',
      cwd: path.resolve(__dirname, '../frontend'),
      url: process.env.FRONTEND_BASE_URL || 'http://localhost:3000',
      timeout: 120000,
      reuseExistingServer: true,
    },
  ],
});
