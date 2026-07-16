import { describe, it, expect } from 'vitest';
import { ScraperService } from '@/services/scraper.js';

describe('ScraperService', () => {
  it('extracts title, author, and chapters from metadata HTML', async () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="Test Novel" />
          <meta property="og:description" content="A test description." />
          <title>Test Novel - Novel Site</title>
        </head>
        <body>
          <h1>Test Novel</h1>
          <div class="author">Author: Test Author</div>
          <div class="description">A test description.</div>
          <ul class="chapter-list">
            <li><a href="/novel/test/chapter-1">Chapter 1: The Beginning</a></li>
            <li><a href="/novel/test/chapter-2">Chapter 2: The Journey</a></li>
            <li><a href="/novel/test/chapter-3">Chapter 3: The End</a></li>
          </ul>
        </body>
      </html>
    `;
    const result = await ScraperService.scrapeMetadataFromHtml(html, 'https://example.com/novel/test');
    expect(result.title).toBe('Test Novel');
    expect(result.author).toBe('Test Author');
    expect(result.description).toBe('A test description.');
    expect(result.chapters.length).toBeGreaterThanOrEqual(3);
    expect(result.chapters[0].number).toBe(1);
    expect(result.chapters[0].title).toBe('Chapter 1: The Beginning');
  });

  it('extracts chapter title and content from chapter HTML', async () => {
    const html = `
      <html>
        <head><title>Chapter 5</title></head>
        <body>
          <h1 class="chapter-title">The Climax</h1>
          <div class="chapter-content"><p>It was a dark and stormy night.</p><p>The end.</p></div>
        </body>
      </html>
    `;
    const result = await ScraperService.scrapeChapterFromHtml(html);
    expect(result.title).toBe('The Climax');
    expect(result.content).toContain('It was a dark and stormy night.');
  });
});
