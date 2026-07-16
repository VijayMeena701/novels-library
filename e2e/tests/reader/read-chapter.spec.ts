import { test, expect, request } from '@playwright/test';

const API_URL = process.env.API_BASE_URL || 'http://localhost:5050';
const ADMIN_EMAIL = 'admin@example.com';
const USER_EMAIL = 'reader@example.com';
const PASSWORD = 'password123';

let bookId: string;
let bookTitle: string;

async function getAuthToken(email: string, apiContext: any) {
  const res = await apiContext.post('/api/auth/login', { data: { email, password: PASSWORD } });
  expect(res.ok(), `login failed for ${email}: ${res.status()} ${await res.text()}`).toBeTruthy();
  const data = await res.json();
  return data.token as string;
}

test.beforeAll(async () => {
  bookTitle = `E2E Test Book ${Math.random().toString(36).slice(2)}`;

  const apiContext = await request.newContext({ baseURL: API_URL });

  const registerAdmin = await apiContext.post('/api/auth/register', {
    data: { username: 'admin', email: ADMIN_EMAIL, password: PASSWORD },
  });
  if (registerAdmin.status() !== 201) {
    expect(registerAdmin.status(), `register admin failed: ${registerAdmin.status()} ${await registerAdmin.text()}`).toBe(400);
  }

  const registerReader = await apiContext.post('/api/auth/register', {
    data: { username: 'reader', email: USER_EMAIL, password: PASSWORD },
  });
  if (registerReader.status() !== 201) {
    expect(registerReader.status(), `register reader failed: ${registerReader.status()} ${await registerReader.text()}`).toBe(400);
  }

  const adminToken = await getAuthToken(ADMIN_EMAIL, apiContext);

  const book = await apiContext.post('/api/books', {
    data: { title: bookTitle, author: 'E2E Author', description: 'A test book.' },
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  expect(book.ok()).toBeTruthy();
  const bookData = await book.json();
  bookId = bookData._id as string;

  const chapter = await apiContext.post(`/api/jobs/book/${bookId}/import-chapter-html`, {
    data: {
      chapterNumber: 1,
      pageUrl: 'https://example.com/novel/test/chapter-1',
      html: `<html><body><h1 class="chapter-title">E2E Chapter 1</h1><div class="chapter-content"><p>This is the first chapter of the E2E test book.</p><p>Extra padding to make the html string longer than the one hundred character minimum required by the import handler.</p></div></body></html>`,
    },
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  expect(chapter.ok()).toBeTruthy();

  const userToken = await getAuthToken(USER_EMAIL, apiContext);
  const addLibrary = await apiContext.post(`/api/books/${bookId}/library`, {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  expect(addLibrary.ok(), `addLibrary failed: ${addLibrary.status()} ${await addLibrary.text()}`).toBeTruthy();

  await apiContext.dispose();
});

test('navigates from the catalog to a book detail page', async ({ page }) => {
  await page.goto('/books');
  await page.getByRole('link', { name: bookTitle }).click();
  await page.waitForURL(/\/books\/[a-f0-9]+/);
  await expect(page.getByRole('heading', { name: bookTitle })).toBeVisible();
});

test('opens the chapter reader and displays the chapter content', async ({ page }) => {
  await page.goto(`/books/${bookId}/reader/1`);
  await expect(page.getByText('This is the first chapter of the E2E test book.')).toBeVisible();
});

test('records a chapter visit and updates continue reading', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[type="email"]', USER_EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('/profile', { timeout: 10000 });

  await page.goto(`/books/${bookId}/reader/1`);
  await page.getByText('This is the first chapter of the E2E test book.').waitFor();

  await page.goto('/');
  await expect(page.getByText(bookTitle).first()).toBeVisible();
});
