import { test, expect, request } from '@playwright/test';

const API_URL = process.env.API_BASE_URL || 'http://localhost:5050';
const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'playwright@example.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'password123';

test.beforeAll(async () => {
  const api = await request.newContext({ baseURL: API_URL });
  const register = await api.post('/api/auth/register', {
    data: {
      username: 'playwright',
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    },
  });
  if (register.status() !== 201) {
    const login = await api.post('/api/auth/login', {
      data: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });
    expect(login.ok(), `login failed: ${login.status()} ${await login.text()}`).toBeTruthy();
  }
  await api.dispose();
});

test('logs in and navigates to the profile page', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('/profile', { timeout: 10000 });
  await expect(page).toHaveURL('/profile');
});

test('shows the public catalog on the home page', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('Read, track, and archive web books in one place.');
});
