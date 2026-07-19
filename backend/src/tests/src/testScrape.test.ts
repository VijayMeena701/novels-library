import { describe, it, expect, afterEach } from 'vitest';
import { runTest, mockFetchHtml } from '@/testScrape.js';
import { setHtmlFetcherForTesting } from '@/services/scraper.js';

describe('testScrape.ts', () => {
  afterEach(() => {
    setHtmlFetcherForTesting(null);
  });

  it('runs the scraper heuristics test without throwing', async () => {
    await expect(runTest()).resolves.toBeUndefined();
  });

  it('exports the mock HTML fetcher', () => {
    expect(typeof mockFetchHtml).toBe('function');
    expect(mockFetchHtml('https://benign-novel-site.local/novels/test-story/chapters/1')).toBeInstanceOf(Promise);
  });
});
