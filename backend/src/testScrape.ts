import { ScraperService, setHtmlFetcherForTesting } from './services/scraper.js';

// Mock the rendered HTML fetcher to avoid making real network requests
setHtmlFetcherForTesting(mockFetchHtml);

async function runTest() {
  console.log('--- STARTING SCRAPER HEURISTICS INTEGRATION TEST ---');
  
  const novelUrl = 'https://benign-novel-site.local/novels/test-story';
  console.log(`Testing metadata scraper for: ${novelUrl}`);
  
  try {
    const meta = await ScraperService.scrapeMetadata(novelUrl);
    console.log('\n[Scraped Metadata Result]:');
    console.log(`- Title:  "${meta.title}"`);
    console.log(`- Author: "${meta.author}"`);
    console.log(`- Desc:   "${meta.description.substring(0, 100)}..."`);
    console.log(`- Cover:  "${meta.coverUrl}"`);
    console.log(`- Genres: "${meta.genres.join(', ')}"`);
    console.log(`- Status: "${meta.publicationStatus}"`);
    console.log(`- Units found: ${meta.units.length}`);
    if (meta.units.length > 0) {
      console.log('  First Unit Link:', meta.units[0]);
    }

    // Verify assertions
    if (meta.title !== 'Mighty Ascendant God') throw new Error('Metadata title matching failed!');
    if (meta.author !== 'Master Ink') throw new Error('Metadata author matching failed!');
    if (meta.authorPenName !== 'Master Ink') throw new Error('Metadata pen name matching failed!');
    if (meta.authorRealName !== 'Ink Masterson') throw new Error('Metadata real name matching failed!');
    if (meta.alternativeNames.length !== 2 || meta.alternativeNames[0] !== 'MAG') throw new Error('Metadata alternative names parsing failed!');
    if (meta.genres.length !== 2 || meta.genres[0] !== 'Fantasy') throw new Error('Metadata genres parsing failed!');
    if (meta.originalSource !== 'Gravity Tales') throw new Error('Metadata source parsing failed!');
    if (meta.publicationStatus !== 'Completed') throw new Error('Metadata publication status parsing failed!');
    if (meta.units.length !== 11) throw new Error('Metadata paginated units parsing failed!');
    if (meta.units[5]?.title !== 'Interlude: The Quiet Room' || meta.units[5]?.number !== 6) {
      throw new Error('Numberless unit ordering failed!');
    }
    if (!meta.units[10]?.title.includes('第十章') || meta.units[10]?.number !== 11) {
      throw new Error('Ordered multilingual unit parsing failed!');
    }
    console.log('✅ Metadata extraction test passed.');

    const catalogOnlyUrl = 'https://benign-novel-site.local/book/azure-sky';
    console.log(`\nTesting full catalogue discovery for: ${catalogOnlyUrl}`);
    const catalogMeta = await ScraperService.scrapeMetadata(catalogOnlyUrl);
    console.log(`- Catalogue units found: ${catalogMeta.units.length}`);
    if (catalogMeta.units.length !== 7) throw new Error('Full catalogue discovery failed!');
    if (catalogMeta.units[0]?.number !== 1 || !catalogMeta.units[0]?.title.includes('第1章')) {
      throw new Error('Chinese catalogue first unit parsing failed!');
    }
    if (catalogMeta.units[5]?.number !== 6 || catalogMeta.units[5]?.title !== '今晚请个假') {
      throw new Error('Numberless catalogue entry inference failed!');
    }
    if (catalogMeta.units[6]?.number !== 7 || !catalogMeta.units[6]?.title.includes('第7章')) {
      throw new Error('Known unit numbers were not preserved around numberless entries!');
    }
    console.log('✅ Full catalogue discovery test passed.');

    const jsCatalogUrl = 'https://benign-novel-site.local/book/js-catalog/9000.html';
    console.log(`\nTesting JavaScript catalogue button discovery for: ${jsCatalogUrl}`);
    const jsCatalogMeta = await ScraperService.scrapeMetadata(jsCatalogUrl);
    console.log(`- JS catalogue units found: ${jsCatalogMeta.units.length}`);
    if (jsCatalogMeta.units.length !== 4) throw new Error('JavaScript catalogue button discovery failed!');
    if (jsCatalogMeta.units[3]?.number !== 4 || !jsCatalogMeta.units[3]?.title.includes('第4章')) {
      throw new Error('JavaScript catalogue unit order failed!');
    }
    console.log('✅ JavaScript catalogue discovery test passed.');

    const unitUrl = 'https://benign-novel-site.local/novels/test-story/chapters/1';
    console.log(`\nTesting unit content scraper for: ${unitUrl}`);
    const unit = await ScraperService.scrapeUnit(unitUrl);
    console.log('\n[Scraped Unit Result]:');
    console.log(`- Unit Title: "${unit.title}"`);
    console.log(`- Content sample (first 150 chars):\n  ${unit.content.substring(0, 150)}...`);

    // Verify assertions
    if (unit.title !== 'Chapter 1: The Awakening') throw new Error('Unit title parsing failed!');
    if (!unit.content.includes('First paragraph of text.')) throw new Error('Unit content extraction failed!');
    console.log('✅ Unit parsing test passed.');
    
    console.log('\n🎉 ALL SCRAPER TESTS COMPLETED SUCCESSFULLY!');
  } catch (err: any) {
    console.error('❌ TEST FAILED:', err.message);
    process.exit(1);
  }
}

function mockFetchHtml(url: string) {
    if (url.includes('/txt/9000') || url.includes('/book/js-catalog/9000/catalog')) {
      return Promise.resolve(`
          <!DOCTYPE html>
          <html>
            <head><title>JS目录</title></head>
            <body>
              <div class="catalog-body">
                <a href="/txt/9000/1.html">第1章 第一刀</a>
                <a href="/txt/9000/2.html">第2章 第二刀</a>
                <a href="/txt/9000/3.html">第3章 第三刀</a>
                <a href="/txt/9000/4.html">第4章 第四刀</a>
              </div>
            </body>
          </html>
        `);
    } else if (url.includes('/book/js-catalog/9000')) {
      return Promise.resolve(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta property="og:title" content="JS Catalogue Novel" />
              <title>JS Catalogue Novel</title>
            </head>
            <body>
              <h1>JS Catalogue Novel</h1>
              <button onclick="window.location.href='/book/js-catalog/9000/catalog.html'">完整目录</button>
            </body>
          </html>
        `);
    } else if (url.includes('/book/azure-sky/catalog')) {
      return Promise.resolve(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>碧落天刀 完整目录</title>
            </head>
            <body>
              <main class="book-catalog">
                <a href="/book/azure-sky/1.html">第1章 初临天刀</a>
                <a href="/book/azure-sky/2.html">第2章 风起</a>
                <a href="/book/azure-sky/3.html">第3章 云涌</a>
                <a href="/book/azure-sky/4.html">第4章 试炼</a>
                <a href="/book/azure-sky/5.html">第5章 归来</a>
                <a href="/book/azure-sky/leave.html">今晚请个假</a>
                <a href="/book/azure-sky/7.html">第7章 再启程</a>
              </main>
            </body>
          </html>
        `);
    } else if (url.includes('/book/azure-sky')) {
      return Promise.resolve(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta property="og:title" content="Azure Sky Heavenly Blade" />
              <title>碧落天刀 - 69书吧</title>
            </head>
            <body>
              <h1>碧落天刀</h1>
              <div>作者：风凌天下</div>
              <div>分类：玄幻魔法</div>
              <section>
                <a href="/book/azure-sky/catalog.html" class="btn">完整目录</a>
              </section>
            </body>
          </html>
        `);
    } else if (url.includes('chapters/1')) {
      return Promise.resolve(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Chapter 1: The Awakening - Mighty Ascendant God</title>
            </head>
            <body>
              <div class="chapter-content">
                <h1 class="chapter-title">Chapter 1: The Awakening</h1>
                <p>First paragraph of text.</p>
                <p>Second paragraph of the story.</p>
                <div class="ads">Sponsored Advertisement Link</div>
                <p>Third paragraph after the ads.</p>
                <a href="../2">Next Chapter</a>
              </div>
            </body>
          </html>
        `);
    } else if (url.includes('page=2')) {
      return Promise.resolve(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Mighty Ascendant God - Web Novels</title>
            </head>
            <body>
              <div class="volumes-list">
                <a href="/novels/test-story/chapters/3">Chapter 3: Apotheosis</a>
                <a href="/novels/test-story/chapters/4">Chapter 4: The Second Page</a>
                <a href="/novels/test-story/chapters/5">Chapter 5: Complete Archive</a>
                <a href="/novels/test-story/interlude-quiet-room">Interlude: The Quiet Room</a>
                <a href="/novels/test-story/capitulo-6">Capítulo 6: El despertar</a>
                <a href="/novels/test-story/chapitre-7">Chapitre 7: L'épreuve</a>
                <a href="/novels/test-story/episode-8">제8화: 시작</a>
                <a href="/novels/test-story/arabic-9">الفصل ٩: البداية</a>
                <a href="/novels/test-story/cn-10">第十章：试炼</a>
              </div>
              <ul class="pagination">
                <li><a href="/novels/test-story?page=1">1</a></li>
                <li><a href="/novels/test-story?page=2">2</a></li>
              </ul>
              <p>This fixture is intentionally long enough for the scraper's fast-path HTML validation.</p>
              <p>Additional story index text keeps the mocked page above the minimum response length.</p>
            </body>
          </html>
        `);
    } else {
      return Promise.resolve(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta property="og:title" content="Mighty Ascendant God" />
              <meta property="og:description" content="A powerful story about an immortal ascension." />
              <meta property="og:image" content="/covers/ascendant.jpg" />
              <title>Mighty Ascendant God - Web Novels</title>
            </head>
            <body>
              <div class="author">作者：Master Ink</div>
              <div>Real name: Ink Masterson</div>
              <div>Pen name: Master Ink</div>
              <div>Alternative names: MAG, Ascendant God</div>
              <div>Genre: Fantasy, Action</div>
              <div>Source: Gravity Tales</div>
              <div>Status: Completed</div>
              <div class="volumes-list">
                <a href="javascript:void(0)">Chapter 999: Placeholder</a>
                <a href="#chapter-list">Chapter 998: Anchor Placeholder</a>
                <a href="mailto:test@example.com">Chapter 997: Mail Placeholder</a>
                <a href="/novels/test-story/chapters/1">Chapter 1: The Awakening</a>
                <a href="/novels/test-story/chapters/2">Chapter 2: Training Arc</a>
                <a href="/novels/test-story/chapters/3?utm_source=latest">Chapter 3: Apotheosis</a>
              </div>
              <ul class="pagination">
                <li><a href="/novels/test-story?page=1">1</a></li>
                <li><a href="/novels/test-story?page=2">2</a></li>
                <li><a href="/novels/test-story?page=2">Last »</a></li>
              </ul>
            </body>
          </html>
        `);
    }
}

runTest();
