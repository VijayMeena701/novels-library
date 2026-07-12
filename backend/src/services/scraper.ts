import * as cheerio from 'cheerio';
import { URL } from 'url';
import puppeteer, { Browser } from 'puppeteer';

export interface ScrapedMetadata {
  title: string;
  author: string;
  authorPenName: string;
  authorRealName: string;
  alternativeNames: string[];
  genres: string[];
  originalSource: string;
  publicationStatus: string;
  description: string;
  coverUrl: string;
  units: { title: string; url: string; number: number }[];
}

export interface ScrapedUnit {
  title: string;
  content: string;
}

export class ManualInterventionRequiredError extends Error {
  code = 'MANUAL_INTERVENTION_REQUIRED';

  constructor(message: string, public url: string) {
    super(message);
    this.name = 'ManualInterventionRequiredError';
  }
}

type UnitIndex = ScrapedMetadata['units'][number];
type UnitCandidate = Omit<UnitIndex, 'number'> & {
  number: number | null;
  sourceOrder: number;
};
type HtmlFetcher = (url: string) => Promise<string>;

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const PUPPETEER_NAVIGATION_TIMEOUT_MS = getNumberFromEnv('SCRAPER_NAVIGATION_TIMEOUT_MS', 30000, 5000, 120000);
const PUPPETEER_RENDER_WAIT_MS = getNumberFromEnv('SCRAPER_RENDER_WAIT_MS', 750, 0, 30000);
const PUPPETEER_CHALLENGE_WAIT_MS = getNumberFromEnv('SCRAPER_CHALLENGE_WAIT_MS', 15000, 1000, 120000);
const PUPPETEER_HEADLESS = process.env.SCRAPER_HEADLESS !== 'false';
const PUPPETEER_USER_DATA_DIR = process.env.SCRAPER_USER_DATA_DIR || '.scraper-profile';
const CHAPTER_LIST_PAGE_CONCURRENCY = getNumberFromEnv('SCRAPER_LIST_PAGE_CONCURRENCY', 3, 1, 10);
const MAX_CHAPTER_LIST_PAGES = 500;
const MAX_CATALOGUE_GUESS_URLS = 12;
const CHAPTER_LIST_CONTAINER_SELECTORS = [
  '.chapter-list',
  '#chapter-list',
  '.chapters-list',
  '#chapters-list',
  '.chapter-listing',
  '.list-chapter',
  '#list-chapter',
  '.volumes-list',
  '.volume-list',
  '.episode-list',
  '.episodes-list',
  '.toc',
  '#toc',
];
const CHAPTER_LIST_ANCHOR_SELECTOR = CHAPTER_LIST_CONTAINER_SELECTORS
  .map((selector) => `${selector} a`)
  .join(', ');
const PAGINATION_PARAM_NAMES = ['page', 'p', 'pg', 'pagina', 'seite', 'halaman'];
const PAGINATION_PATH_SEGMENTS = ['page', 'pagina', 'página', 'seite', 'halaman', 'sayfa', 'pagina', '페이지', '页', '頁'];
const TRACKING_PARAM_PATTERN = /^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$)/i;
const NUMBER_CHAR_CLASS = '0-9０-９٠-٩۰-۹०-९০-৯๐-๙';
const CJK_NUMBER_CHAR_CLASS = '零〇一二三四五六七八九十百千万萬两兩壹贰貳叁參肆伍陆陸柒捌玖拾佰仟';
const CHAPTER_NUMBER_TOKEN = `[${NUMBER_CHAR_CLASS}]+(?:[.,][${NUMBER_CHAR_CLASS}]+)?|[${CJK_NUMBER_CHAR_CLASS}]+`;
const CHAPTER_KEYWORDS = [
  'chapter',
  'chapters',
  'ch\\.?',
  'episode',
  'episodes',
  'ep\\.?',
  'cap[ií]tulo',
  'cap[ií]tulos',
  'cap\\.?',
  'chapitre',
  'chapitres',
  'kapitel',
  'capitolo',
  'capitoli',
  'hoofdstuk',
  'rozdzia[lł]',
  'glava',
  'b[oö]l[uü]m',
  'bab',
  'chương',
  'chuong',
  'epis[oó]dio',
  'episodio',
  'épisode',
  'folge',
  'глава',
  'главы',
  'гл\\.?',
  'فصل',
  'الفصل',
  'حلقة',
  'الحلقة',
  'باب',
  'الباب',
  'פרק',
  'अध्याय',
  'অধ্যায়',
  '章',
  '話',
  '话',
  '回',
  '节',
  '節',
  '화',
  '장',
  '회',
];
const CHAPTER_KEYWORD_PATTERN = CHAPTER_KEYWORDS.join('|');
const CHAPTER_NUMBER_PATTERNS = [
  new RegExp(`(?:^|[\\s:/_.\\-#])(?:${CHAPTER_KEYWORD_PATTERN})(?:\\s*|[.:#№/_.\\-]+)(${CHAPTER_NUMBER_TOKEN})`, 'iu'),
  new RegExp(`(?:^|[\\s:/_.\\-#])(?:第|제)\\s*(${CHAPTER_NUMBER_TOKEN})\\s*(?:章|話|话|回|节|節|화|장|회)`, 'iu'),
  new RegExp(`(?:^|[\\s:/_.\\-#])(${CHAPTER_NUMBER_TOKEN})\\s*(?:章|話|话|回|节|節|화|장|회)(?:$|[\\s:/_.\\-#])`, 'iu'),
];
const LOCALIZED_DIGITS: Record<string, string> = {
  '０': '0',
  '１': '1',
  '２': '2',
  '３': '3',
  '４': '4',
  '５': '5',
  '６': '6',
  '７': '7',
  '８': '8',
  '９': '9',
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
  '०': '0',
  '१': '1',
  '२': '2',
  '३': '3',
  '४': '4',
  '५': '5',
  '६': '6',
  '७': '7',
  '८': '8',
  '९': '9',
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
  '๐': '0',
  '๑': '1',
  '๒': '2',
  '๓': '3',
  '๔': '4',
  '๕': '5',
  '๖': '6',
  '๗': '7',
  '๘': '8',
  '๙': '9',
};
const CJK_DIGITS: Record<string, number> = {
  '零': 0,
  '〇': 0,
  '一': 1,
  '二': 2,
  '两': 2,
  '兩': 2,
  '三': 3,
  '四': 4,
  '五': 5,
  '六': 6,
  '七': 7,
  '八': 8,
  '九': 9,
  '壹': 1,
  '贰': 2,
  '貳': 2,
  '叁': 3,
  '參': 3,
  '肆': 4,
  '伍': 5,
  '陆': 6,
  '陸': 6,
  '柒': 7,
  '捌': 8,
  '玖': 9,
};
const CJK_UNITS: Record<string, number> = {
  '十': 10,
  '拾': 10,
  '百': 100,
  '佰': 100,
  '千': 1000,
  '仟': 1000,
  '万': 10000,
  '萬': 10000,
};
const PAGINATION_TEXT_PATTERN = /^(first|last|next|previous|prev|siguiente|anterior|suivant|pr[ée]c[ée]dent|n[äa]chste|weiter|zur[üu]ck|vorige|volgende|prossima|precedente|pr[óo]xima|anterior|далее|назад|следующая|предыдущая|التالي|السابق|下一页|上一页|首页|末页|次へ|前へ|다음|이전|[<>]+|«|»)/iu;
const CATALOG_LINK_TEXT_PATTERN = /(?:完整目录|全部目录|章节目录|章节列表|小说目录|书籍目录|作品目录|目录|全部章节|所有章节|查看全部|展开全部|more\s+chapters?|all\s+chapters?|full\s+(?:catalog(?:ue)?|contents?|list)|catalog(?:ue)?|table\s+of\s+contents?|contents?|chapter\s+list|episode\s+list|toc)/iu;
const CATALOG_LINK_HREF_PATTERN = /(?:^|[/_.-])(?:catalog(?:ue)?|toc|contents?|chapters?|chapter-list|episode-list|list|index|all)(?:$|[/_.-])/iu;
const NON_CATALOG_LINK_TEXT_PATTERN = /(?:首页|排行|排行榜|分类|书架|阅读记录|登录|注册|搜索|作者专区|热门标签|home|ranking|rank|category|login|register|search|library|bookshelf|history|profile)/iu;
const CHAPTER_CONTENT_SELECTORS = [
  '.chapter-content',
  '#chapter-content',
  '.chapter-body',
  '#chapter-body',
  '.chaptertext',
  '#chaptertext',
  '.chaptercontent',
  '#chaptercontent',
  '.article-content',
  '#article-content',
  '.articlecontent',
  '#articlecontent',
  '.entry-content',
  '.post-content',
  '.read-content',
  '#read-content',
  '.readcontent',
  '#readcontent',
  '.book-content',
  '#book-content',
  '.bookreadercontent',
  '#bookreadercontent',
  '.novel-content',
  '#novel-content',
  '.txtnav',
  '#txtnav',
  '.txt',
  '#txt',
  '.content',
  '#content',
  'article',
  'main',
  'body',
];
const CHAPTER_CONTENT_NOISE_SELECTOR = [
  'script',
  'style',
  'noscript',
  'iframe',
  'svg',
  'canvas',
  'form',
  'input',
  'button',
  'select',
  'option',
  'textarea',
  'nav',
  'header',
  'footer',
  'aside',
  '.ads',
  '.ad',
  '.ad-container',
  '.advertisement',
  '.banner',
  '.sponsor',
  '.sponsored',
  '.taboola',
  '.trc_related_container',
  '.trc_rbox_container',
  '.tbl-feed-card',
  '.share',
  '.social',
  '.comment',
  '.comments',
  '.recommend',
  '.recommendation',
  '.related',
  '.breadcrumb',
  '.breadcrumbs',
  '.navigation',
  '.pagination',
  '.chapter-nav',
  '.readpage',
  '.toolbar',
  '.settings',
].join(', ');
const CHAPTER_CONTENT_NOISE_ATTR_PATTERN = /(?:^|[-_\s])(ad|ads|advert|advertisement|banner|sponsor|sponsored|taboola|trc|tbl|share|social|comment|comments|recommend|related|footer|header|breadcrumb|pagination|nav|navigation|readpage|toolbar|setting|settings)(?:$|[-_\s])/iu;
const CHAPTER_LINE_NOISE_PATTERN = /(?:loadAdv\s*\(|adsbygoogle|google_ad_|taboola|sponsored|copyright|版权所有|版權所有|www\.\w+|上一章|下一章|返回目录|章节目录|加入书架|投推荐票|报错|本章未完|点击下一页|请收藏|最新网址)/iu;

type MetadataFieldKey =
  | 'author'
  | 'authorRealName'
  | 'authorPenName'
  | 'alternativeNames'
  | 'genres'
  | 'originalSource'
  | 'publicationStatus';

const METADATA_LABELS: { key: MetadataFieldKey; pattern: string }[] = [
  { key: 'authorRealName', pattern: 'real\\s*name|birth\\s*name|legal\\s*name|nombre\\s+real|nom\\s+r[ée]el|nome\\s+real|echter\\s+name|t[êe]n\\s+thật|ten\\s+that|本名|真实姓名|真實姓名|실명|본명|настоящее\\s+имя|الاسم\\s+الحقيقي' },
  { key: 'authorPenName', pattern: 'pen\\s*name|pseudonym|nom\\s+de\\s+plume|b[úu]t\\s+danh|but\\s+danh|笔名|筆名|필명|псевдоним|اسم\\s+مستعار' },
  { key: 'alternativeNames', pattern: 'alternative\\s*names?|alternate\\s*names?|other\\s*names?|also\\s+known\\s+as|aliases?|synonyms?|native\\s+title|original\\s+title|t[êe]n\\s+kh[áa]c|ten\\s+khac|其他名称|其他名稱|别名|別名|異名|原名|원제|다른\\s+이름|альтернативные\\s+названия|другие\\s+названия|أسماء\\s+أخرى|الاسم\\s+البديل' },
  { key: 'genres', pattern: 'genres?|tags?|categories|category|t[hc]ể\\s*loại|the\\s+loai|thể\\s*loại|体裁|類型|类型|ジャンル|장르|жанры?|تصنيف|التصنيف|النوع' },
  { key: 'originalSource', pattern: 'original\\s*source|translation\\s*source|source|publisher|nguồn|nguon|来源|來源|出处|出處|출처|источник|مصدر|المصدر|fuente|quelle|fonte' },
  { key: 'publicationStatus', pattern: 'publication\\s*status|publishing\\s*status|release\\s*status|novel\\s*status|status|estado|statut|estado\\s+de\\s+publicaci[oó]n|trạng\\s+thái|trang\\s+thai|状态|狀態|連載状況|连载状态|상태|статус|الحالة' },
  { key: 'author', pattern: 'authors?|writers?|creator|autor|autores|auteur|escritor|penulis|yazar|t[áa]c\\s+giả|tac\\s+gia|作者|著者|作家|작가|автор|مؤلف|المؤلف|كاتب' },
];
const METADATA_LABEL_PATTERN_SOURCE = METADATA_LABELS.map((label) => label.pattern).join('|');
const METADATA_FIELD_PATTERN = new RegExp(
  `(?:^|[\\s|•·])(${METADATA_LABEL_PATTERN_SOURCE})\\s*[:：-]\\s*(.*?)(?=\\s+(?:${METADATA_LABEL_PATTERN_SOURCE})\\s*[:：-]|$)`,
  'giu'
);
const BROWSER_CHALLENGE_PATTERNS = [
  /Just a moment\.\.\./iu,
  /cf-browser-verification/iu,
  /Checking if the site connection is secure/iu,
  /Verify you are human/iu,
  /Enable JavaScript and cookies to continue/iu,
  /Attention Required!\s*\|\s*Cloudflare/iu,
];

// Singleton browser instance for Puppeteer (reused across scrape calls)
let browserInstance: Browser | null = null;
let manualBrowserInstance: Browser | null = null;
let htmlFetcherOverride: HtmlFetcher | null = null;

function getNumberFromEnv(name: string, defaultValue: number, min: number, max: number): number {
  const parsed = Number.parseInt(process.env[name] || '', 10);
  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }

  return Math.min(max, Math.max(min, parsed));
}

export function setHtmlFetcherForTesting(fetcher: HtmlFetcher | null) {
  htmlFetcherOverride = fetcher;
}

function normalizeUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Unsupported URL protocol: ${parsed.protocol}`);
  }

  parsed.hash = '';

  for (const key of Array.from(parsed.searchParams.keys())) {
    if (TRACKING_PARAM_PATTERN.test(key)) {
      parsed.searchParams.delete(key);
    }
  }

  parsed.searchParams.sort();

  if (parsed.pathname.length > 1) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  }

  return parsed.toString();
}

function isBrowserChallengePage(html: string): boolean {
  return BROWSER_CHALLENGE_PATTERNS.some((pattern) => pattern.test(html));
}

function toAbsoluteNormalizedUrl(href: string, baseUrl: string): string | null {
  const trimmedHref = href.trim();
  if (!trimmedHref || trimmedHref.startsWith('#')) {
    return null;
  }

  try {
    return normalizeUrl(new URL(trimmedHref, baseUrl).toString());
  } catch {
    return null;
  }
}

function collectPotentialUrlsFromElement($: cheerio.CheerioAPI, el: any): string[] {
  const urls: string[] = [];
  const attrNames = [
    'href',
    'data-href',
    'data-url',
    'data-link',
    'data-src',
    'data-target',
    'data-catalog',
    'data-catalogue',
    'data-toc',
    'value',
  ];

  for (const attrName of attrNames) {
    const value = $(el).attr(attrName);
    if (value) {
      urls.push(value);
    }
  }

  const onclick = $(el).attr('onclick') || '';
  if (onclick) {
    const quotedUrlPattern = /['"]((?:https?:\/\/|\/|\.\/|\.\.\/)[^'"]+)['"]/giu;
    for (const match of onclick.matchAll(quotedUrlPattern)) {
      if (match[1]) {
        urls.push(match[1]);
      }
    }
  }

  return urls;
}

function pushNormalizedUrl(urls: Set<string>, rawUrl: string, baseUrl: string) {
  const normalizedUrl = toAbsoluteNormalizedUrl(rawUrl, baseUrl);
  if (normalizedUrl) {
    urls.add(normalizedUrl);
  }
}

function parsePositiveInt(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = parseLocalizedNumber(value);
  return parsed !== null && Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function countCjkCharacters(value: string): number {
  return (value.match(/[\u3400-\u9FFF\uF900-\uFAFF]/gu) || []).length;
}

function extractBookInfoValue(html: string, key: string): string {
  const match = html.match(new RegExp(`${escapeRegExp(key)}\\s*:\\s*['"]([^'"]+)['"]`, 'iu'));
  return normalizeWhitespace(match?.[1] || '');
}

function extractChapterTitleFromHtml($: cheerio.CheerioAPI, html: string): string {
  const structuredTitle = extractBookInfoValue(html, 'chaptername');
  if (structuredTitle) {
    return structuredTitle;
  }

  const headingTitle = $('.chapter-title, .chapter-name, .chapter-heading, .entry-title, article h1, article h2, h1, h2')
    .map((_, el) => normalizeWhitespace($(el).text()))
    .get()
    .find(Boolean);
  if (headingTitle) {
    return headingTitle;
  }

  const documentTitle = normalizeWhitespace($('title').text());
  if (documentTitle) {
    const titleParts = documentTitle
      .split(/\s*[-_|]\s*/u)
      .map((part) => normalizeWhitespace(part))
      .filter(Boolean);
    const chapterPart = titleParts.find((part) => hasChapterKeyword(part) || extractChapterNumber(part, '') !== null);
    return chapterPart || titleParts[0] || documentTitle;
  }

  return 'Untitled Chapter';
}

function removeChapterContentNoise($: cheerio.CheerioAPI, $element: cheerio.Cheerio<any>) {
  $element.find(CHAPTER_CONTENT_NOISE_SELECTOR).remove();
  $element.find('*').each((_, child) => {
    const childElement = $(child);
    const attrValue = normalizeWhitespace(`${childElement.attr('id') || ''} ${childElement.attr('class') || ''}`);
    if (attrValue && CHAPTER_CONTENT_NOISE_ATTR_PATTERN.test(attrValue)) {
      childElement.remove();
    }
  });
}

function getElementTextWithBreaks($element: cheerio.Cheerio<any>): string {
  const html = $element.html() || '';
  const textHtml = html
    .replace(/<br\s*\/?>/giu, '\n')
    .replace(/<\/(?:p|div|section|article|li|h[1-6]|blockquote)>/giu, '\n');
  return cheerio.load(`<div>${textHtml}</div>`).text();
}

function isChapterLineNoise(line: string, title: string): boolean {
  const normalizedLine = normalizeWhitespace(line);
  if (!normalizedLine) {
    return true;
  }

  const normalizedTitle = normalizeWhitespace(title);
  if (normalizedTitle && normalizedLine === normalizedTitle) {
    return true;
  }

  if (normalizedLine.length <= 2 && !/^[（(]?\d+[）)]?$/u.test(normalizedLine)) {
    return true;
  }

  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:\s+作者[:：].*)?$/u.test(normalizedLine)) {
    return true;
  }

  if (/^(作者|来源|來源|书页|收藏|目录|設置|设置|白天|黑夜|夜间|报错|報錯|首页|排行|分类|书架|阅读记录)[:：\s]*.*$/u.test(normalizedLine)) {
    return true;
  }

  if (/^(next|previous|prev|index|contents?|table of contents|chapter list|next chapter|previous chapter|prev chapter|back to (?:catalogue|catalog|contents?))$/iu.test(normalizedLine)) {
    return true;
  }

  return CHAPTER_LINE_NOISE_PATTERN.test(normalizedLine);
}

function paragraphsFromElement($: cheerio.CheerioAPI, $element: cheerio.Cheerio<any>, title: string): string[] {
  const paragraphTexts: string[] = [];

  $element.find('p').each((_, paragraph) => {
    const paragraphText = normalizeWhitespace($(paragraph).text());
    if (!isChapterLineNoise(paragraphText, title)) {
      paragraphTexts.push(paragraphText);
    }
  });

  const textWithBreaks = getElementTextWithBreaks($element);
  const lineTexts = textWithBreaks
    .split(/\n+/u)
    .map((line) => normalizeWhitespace(line))
    .filter((line) => !isChapterLineNoise(line, title));

  if (lineTexts.length > paragraphTexts.length) {
    return lineTexts;
  }

  return paragraphTexts;
}

function isMeaningfulChapterContent(text: string, paragraphCount: number, linkTextLength: number): boolean {
  const normalizedText = normalizeWhitespace(text);
  if (!normalizedText) {
    return false;
  }

  if (/(?:copyright|版权所有|版權所有)/iu.test(normalizedText) && normalizedText.length < 200) {
    return false;
  }

  if (linkTextLength > 0 && linkTextLength / Math.max(normalizedText.length, 1) > 0.45) {
    return false;
  }

  if (normalizedText.length >= 120) {
    return true;
  }

  return paragraphCount >= 2 && normalizedText.length >= 35;
}

function extractChapterContentHtml($: cheerio.CheerioAPI, title: string): string {
  type ChapterContentExtraction = { html: string; score: number };
  let bestCandidate: ChapterContentExtraction | null = null;
  const seenElements = new Set<any>();

  CHAPTER_CONTENT_SELECTORS.forEach((selector, selectorIndex) => {
    $(selector).each((_, element) => {
      if (seenElements.has(element)) {
        return;
      }
      seenElements.add(element);

      const clone = $(element).clone();
      removeChapterContentNoise($, clone);

      const paragraphs = paragraphsFromElement($, clone, title);
      const text = normalizeWhitespace(paragraphs.join(' '));
      const linkTextLength = normalizeWhitespace(clone.find('a').text()).length;
      if (!isMeaningfulChapterContent(text, paragraphs.length, linkTextLength)) {
        return;
      }

      const brCount = clone.find('br').length;
      const selectorPriority = CHAPTER_CONTENT_SELECTORS.length - selectorIndex;
      const bodyPenalty = selector === 'body' ? 1200 : 0;
      const score =
        text.length +
        countCjkCharacters(text) * 2 +
        paragraphs.length * 30 +
        brCount * 8 +
        selectorPriority * 10 -
        linkTextLength * 2 -
        bodyPenalty;

      if (!bestCandidate || score > bestCandidate.score) {
        bestCandidate = {
          html: paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('\n'),
          score,
        };
      }
    });
  });

  const selectedCandidate = bestCandidate as ChapterContentExtraction | null;
  if (!selectedCandidate) {
    throw new Error('Could not extract meaningful chapter content. Target element not found or only footer/ad/navigation text was detected.');
  }

  return selectedCandidate.html;
}

function stripTrailingMetadataNoise(value: string): string {
  return normalizeWhitespace(value)
    .replace(/\s*(?:\||•|·)\s*$/u, '')
    .replace(/\s*(?:chapter\s+list|latest\s+chapters)\s*$/iu, '')
    .trim();
}

function splitMetadataList(value: string): string[] {
  const seen = new Set<string>();

  return stripTrailingMetadataNoise(value)
    .split(/[,;|\/、，；]+/u)
    .map((item) => normalizeWhitespace(item))
    .filter((item) => {
      const key = item.toLowerCase();
      if (!item || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function getMetadataFieldKey(label: string): MetadataFieldKey | null {
  const normalizedLabel = normalizeWhitespace(label);

  for (const metadataLabel of METADATA_LABELS) {
    if (new RegExp(`^(?:${metadataLabel.pattern})$`, 'iu').test(normalizedLabel)) {
      return metadataLabel.key;
    }
  }

  return null;
}

function addMetadataField(
  fields: Partial<Record<MetadataFieldKey, string>>,
  key: MetadataFieldKey,
  value: string
) {
  const cleanValue = stripTrailingMetadataNoise(value);
  if (!cleanValue || fields[key]) {
    return;
  }

  fields[key] = cleanValue;
}

function collectMetadataFromText(text: string, fields: Partial<Record<MetadataFieldKey, string>>) {
  const normalizedText = normalizeWhitespace(text);
  if (!normalizedText || normalizedText.length > 3000) {
    return;
  }

  for (const match of normalizedText.matchAll(METADATA_FIELD_PATTERN)) {
    const label = match[1];
    const value = match[2];
    if (!label || !value) {
      continue;
    }

    const key = getMetadataFieldKey(label);
    if (key) {
      addMetadataField(fields, key, value);
    }
  }
}

function collectLabeledMetadata($: cheerio.CheerioAPI): Partial<Record<MetadataFieldKey, string>> {
  const fields: Partial<Record<MetadataFieldKey, string>> = {};

  $('tr').each((_, row) => {
    const cells = $(row).children('th, td');
    if (cells.length < 2) {
      return;
    }

    const label = normalizeWhitespace($(cells[0]).text()).replace(/[:：-]\s*$/u, '');
    const value = normalizeWhitespace($(cells[1]).text());
    const key = getMetadataFieldKey(label);
    if (key) {
      addMetadataField(fields, key, value);
    }
  });

  $('dt').each((_, dt) => {
    const label = normalizeWhitespace($(dt).text()).replace(/[:：-]\s*$/u, '');
    const value = normalizeWhitespace($(dt).next('dd').text());
    const key = getMetadataFieldKey(label);
    if (key) {
      addMetadataField(fields, key, value);
    }
  });

  $('li, p, div, span').each((_, el) => {
    collectMetadataFromText($(el).text(), fields);
  });

  return fields;
}

function normalizeNumberToken(value: string): string {
  return Array.from(value.trim())
    .map((char) => LOCALIZED_DIGITS[char] ?? char)
    .join('')
    .replace(/\s+/g, '');
}

function parseCjkNumber(value: string): number | null {
  const chars = Array.from(value.trim());
  if (chars.length === 0 || !chars.every((char) => CJK_DIGITS[char] !== undefined || CJK_UNITS[char] !== undefined)) {
    return null;
  }

  if (chars.every((char) => CJK_DIGITS[char] !== undefined)) {
    return Number.parseInt(chars.map((char) => CJK_DIGITS[char]).join(''), 10);
  }

  let total = 0;
  let section = 0;
  let number = 0;

  for (const char of chars) {
    const digit = CJK_DIGITS[char];
    if (digit !== undefined) {
      number = digit;
      continue;
    }

    const unit = CJK_UNITS[char];
    if (unit === 10000) {
      section += number;
      total += (section || 1) * unit;
      section = 0;
      number = 0;
      continue;
    }

    section += (number || 1) * unit;
    number = 0;
  }

  return total + section + number;
}

function parseLocalizedNumber(value: string): number | null {
  const normalized = normalizeNumberToken(value);

  if (/^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(normalized)) {
    const parsed = Number.parseFloat(normalized.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (/^\d+(?:\.\d+)?$/.test(normalized)) {
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (/^\d+,\d+$/.test(normalized)) {
    const parsed = Number.parseFloat(normalized.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return parseCjkNumber(normalized);
}

function extractChapterNumber(text: string, chapterUrl: string): number | null {
  const decodedUrl = safeDecodeURIComponent(chapterUrl);
  const candidates = [text, decodedUrl];

  for (const candidate of candidates) {
    for (const pattern of CHAPTER_NUMBER_PATTERNS) {
      const match = candidate.match(pattern);
      if (!match?.[1]) {
        continue;
      }

      const parsed = parseLocalizedNumber(match[1]);
      if (parsed !== null && parsed > 0) {
        return parsed;
      }
    }
  }

  return null;
}

function hasChapterKeyword(value: string): boolean {
  return new RegExp(`(?:${CHAPTER_KEYWORD_PATTERN})`, 'iu').test(safeDecodeURIComponent(value));
}

function getChapterDenseAnchors($: cheerio.CheerioAPI): cheerio.Cheerio<any> | null {
  let bestElement: any = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  $('main, article, section, div, ul, ol, table, tbody').each((_, el) => {
    const links = $(el).find('a[href]');
    const linkCount = links.length;
    if (linkCount < 5) {
      return;
    }

    let chapterLikeCount = 0;
    links.each((__, link) => {
      const href = $(link).attr('href') || '';
      const text = $(link).text().replace(/\s+/g, ' ').trim();
      if (!href || !text) {
        return;
      }

      if (extractChapterNumber(text, href) !== null || hasChapterKeyword(text) || hasChapterKeyword(href)) {
        chapterLikeCount++;
      }
    });

    const ratio = chapterLikeCount / linkCount;
    if (chapterLikeCount < 3 || ratio < 0.3) {
      return;
    }

    const score = chapterLikeCount * 100 + ratio * 20 - linkCount * 0.05;
    if (score > bestScore) {
      bestElement = el;
      bestScore = score;
    }
  });

  return bestElement ? $(bestElement).find('a[href]') : null;
}

function getChapterAnchors($: cheerio.CheerioAPI): { anchors: cheerio.Cheerio<any>; isScopedToChapterList: boolean } {
  const chapterListAnchors = $(CHAPTER_LIST_ANCHOR_SELECTOR);
  if (chapterListAnchors.length > 0) {
    return { anchors: chapterListAnchors, isScopedToChapterList: true };
  }

  const denseChapterAnchors = getChapterDenseAnchors($);
  if (denseChapterAnchors && denseChapterAnchors.length > 0) {
    return { anchors: denseChapterAnchors, isScopedToChapterList: true };
  }

  return { anchors: $('a'), isScopedToChapterList: false };
}

function isLikelyNumberlessChapterLink(
  href: string,
  absoluteUrl: string,
  text: string,
  isScopedToChapterList: boolean
): boolean {
  if (!text || hasPaginationSignal(href, new URL(absoluteUrl), text)) {
    return false;
  }

  return isScopedToChapterList || hasChapterKeyword(text) || hasChapterKeyword(absoluteUrl);
}

function getMeaningfulPathSegments(pathname: string): string[] {
  return pathname
    .split('/')
    .map((segment) => safeDecodeURIComponent(segment).toLowerCase().replace(/\.html?$/i, ''))
    .filter((segment) => segment && !/^(?:index|catalog(?:ue)?|toc|contents?|chapters?|list|all|page|read)\.?(?:html?)?$/iu.test(segment));
}

function sharesNovelPathSignal(candidateUrl: URL, sourceUrl: URL): boolean {
  const sourceSegments = getMeaningfulPathSegments(sourceUrl.pathname);
  const candidateSegments = getMeaningfulPathSegments(candidateUrl.pathname);
  if (sourceSegments.length === 0 || candidateSegments.length === 0) {
    return false;
  }

  return sourceSegments.some((segment) => candidateSegments.includes(segment));
}

function isLikelyCataloguePageUrl(
  candidateUrl: URL,
  sourceUrl: URL,
  rawHref: string,
  text: string
): boolean {
  if (candidateUrl.origin !== sourceUrl.origin) {
    return false;
  }

  if (normalizeUrl(candidateUrl.toString()) === normalizeUrl(sourceUrl.toString())) {
    return false;
  }

  if (extractChapterNumber(text, candidateUrl.toString()) !== null) {
    return false;
  }

  const cleanText = normalizeWhitespace(text);
  const decodedHref = safeDecodeURIComponent(rawHref);
  const hasTextSignal = CATALOG_LINK_TEXT_PATTERN.test(cleanText);
  const hasHrefSignal = CATALOG_LINK_HREF_PATTERN.test(decodedHref) || CATALOG_LINK_HREF_PATTERN.test(candidateUrl.pathname);
  if (!hasTextSignal && !hasHrefSignal) {
    return false;
  }

  if (NON_CATALOG_LINK_TEXT_PATTERN.test(cleanText) && !hasTextSignal) {
    return false;
  }

  return hasTextSignal || sharesNovelPathSignal(candidateUrl, sourceUrl);
}

function collectChapterLinks(
  $: cheerio.CheerioAPI,
  pageUrl: string,
  sourceUrl: string,
  chaptersByUrl: Map<string, UnitCandidate>,
  orderState: { next: number }
) {
  const { anchors, isScopedToChapterList } = getChapterAnchors($);
  const parsedSourceUrl = new URL(sourceUrl);

  anchors.each((_, el) => {
    const href = $(el).attr('href');
    const text = $(el).text().replace(/\s+/g, ' ').trim();

    if (!href) {
      return;
    }

    const absoluteUrl = toAbsoluteNormalizedUrl(href, pageUrl);
    if (!absoluteUrl || chaptersByUrl.has(absoluteUrl)) {
      return;
    }

    const parsedChapterUrl = new URL(absoluteUrl);
    if (
      parsedChapterUrl.origin === parsedSourceUrl.origin &&
      !sharesNovelPathSignal(parsedChapterUrl, parsedSourceUrl)
    ) {
      return;
    }

    const chNumber = extractChapterNumber(text, absoluteUrl);
    if (chNumber === null && !isLikelyNumberlessChapterLink(href, absoluteUrl, text, isScopedToChapterList)) {
      return;
    }

    chaptersByUrl.set(absoluteUrl, {
      title: text || (chNumber !== null ? `Chapter ${chNumber}` : `Chapter ${orderState.next + 1}`),
      url: absoluteUrl,
      number: chNumber,
      sourceOrder: orderState.next++,
    });
  });
}

function orderUnitCandidates(candidates: UnitCandidate[]): UnitCandidate[] {
  const sourceOrdered = candidates.slice().sort((a, b) => a.sourceOrder - b.sourceOrder);
  const numbered = sourceOrdered.filter((chapter) => chapter.number !== null);

  if (numbered.length >= 2) {
    let ascendingPairs = 0;
    let descendingPairs = 0;

    for (let i = 1; i < numbered.length; i++) {
      const previous = numbered[i - 1].number as number;
      const current = numbered[i].number as number;
      if (current > previous) {
        ascendingPairs++;
      } else if (current < previous) {
        descendingPairs++;
      }
    }

    if (descendingPairs > ascendingPairs) {
      return sourceOrdered.reverse();
    }
  }

  return sourceOrdered;
}

function finalizeChapters(chaptersByUrl: Map<string, UnitCandidate>): UnitIndex[] {
  const candidates = Array.from(chaptersByUrl.values());
  const hasMissingNumbers = candidates.some((chapter) => chapter.number === null);

  if (!hasMissingNumbers) {
    return candidates
      .map((chapter) => ({
        title: chapter.title,
        url: chapter.url,
        number: chapter.number as number,
      }))
      .sort((a, b) => a.number - b.number);
  }

  const ordered = orderUnitCandidates(candidates);
  const usedNumbers = new Set<number>();
  const finalized: UnitIndex[] = [];

  for (let index = 0; index < ordered.length; index++) {
    const chapter = ordered[index];
    let number = chapter.number;

    if (number === null || usedNumbers.has(number)) {
      const previousKnown = finalized.at(-1)?.number ?? 0;
      const nextKnown = ordered
        .slice(index + 1)
        .find((candidate) => candidate.number !== null && !usedNumbers.has(candidate.number as number))
        ?.number ?? null;

      if (nextKnown !== null && nextKnown > previousKnown + 1) {
        number = previousKnown + 1;
      } else {
        number = Math.max(previousKnown + 1, usedNumbers.size + 1);
      }
    }

    usedNumbers.add(number);
    finalized.push({
      title: chapter.title || `Chapter ${number}`,
      url: chapter.url,
      number,
    });
  }

  return finalized.sort((a, b) => a.number - b.number);
}

function getPaginationParamName(pageUrl: URL): string | null {
  return PAGINATION_PARAM_NAMES.find((name) => pageUrl.searchParams.has(name)) || null;
}

function extractPaginationPageNumber(pageUrl: URL, text: string): number | null {
  const paramName = getPaginationParamName(pageUrl);
  if (paramName) {
    const pageNumber = parsePositiveInt(pageUrl.searchParams.get(paramName));
    if (pageNumber !== null) {
      return pageNumber;
    }
  }

  const pathMatch = pageUrl.pathname.match(
    new RegExp(`(?:^|/)(?:${PAGINATION_PATH_SEGMENTS.map(escapeRegExp).join('|')})/(${CHAPTER_NUMBER_TOKEN})(?:/|$)`, 'iu')
  );
  if (pathMatch?.[1]) {
    return parsePositiveInt(pathMatch[1]);
  }

  return parsePositiveInt(text);
}

function hasPaginationSignal(rawHref: string, candidateUrl: URL, text: string): boolean {
  const lowerHref = rawHref.toLowerCase();
  const lowerText = text.toLowerCase();

  return (
    PAGINATION_PARAM_NAMES.some((name) => candidateUrl.searchParams.has(name)) ||
    new RegExp(`(?:^|/)(?:${PAGINATION_PATH_SEGMENTS.map(escapeRegExp).join('|')})/${CHAPTER_NUMBER_TOKEN}(?:/|$)`, 'iu').test(candidateUrl.pathname) ||
    /[?&](page|p|pg)=\d+/i.test(lowerHref) ||
    parsePositiveInt(text) !== null ||
    PAGINATION_TEXT_PATTERN.test(lowerText)
  );
}

function isLikelyChapterListPageUrl(
  candidateUrl: URL,
  sourceUrl: URL,
  rawHref: string,
  text: string
): boolean {
  if (candidateUrl.origin !== sourceUrl.origin) {
    return false;
  }

  if (extractChapterNumber(text, candidateUrl.toString()) !== null) {
    return false;
  }

  if (!hasPaginationSignal(rawHref, candidateUrl, text)) {
    return false;
  }

  const sourcePath = sourceUrl.pathname.replace(/\/+$/, '') || '/';
  const candidatePath = candidateUrl.pathname.replace(/\/+$/, '') || '/';

  if (candidatePath === sourcePath) {
    return true;
  }

  const sourceStem = sourcePath.replace(/\.html?$/i, '');
  return candidatePath.startsWith(`${sourceStem}/page/`);
}

function buildPaginationUrl(sampleUrl: URL, pageNumber: number): string | null {
  const generated = new URL(sampleUrl.toString());
  const paramName = getPaginationParamName(generated);

  if (paramName) {
    generated.searchParams.set(paramName, String(pageNumber));
    return normalizeUrl(generated.toString());
  }

  const replacedPath = generated.pathname.replace(/(\/page\/)\d+(?=\/|$)/i, `$1${pageNumber}`);
  if (replacedPath !== generated.pathname) {
    generated.pathname = replacedPath;
    return normalizeUrl(generated.toString());
  }

  return null;
}

function getPaginationSortNumber(url: string): number {
  return extractPaginationPageNumber(new URL(url), '') ?? Number.MAX_SAFE_INTEGER;
}

function findChapterListPaginationUrls(
  $: cheerio.CheerioAPI,
  pageUrl: string,
  sourceUrl: string
): string[] {
  const urls = new Set<string>();
  const generatedRanges = new Map<string, { sampleUrl: URL; maxPage: number }>();
  const source = new URL(sourceUrl);

  const paginationSelectors = [
    '.pagination a',
    '.pager a',
    '.page-numbers a',
    'nav a',
    'a[href*="?page="]',
    'a[href*="&page="]',
    'a[href*="/page/"]',
    'a[href*="/pagina/"]',
    'a[href*="/seite/"]',
    'a[href*="/halaman/"]',
    'a[href*="/sayfa/"]',
    'a[href*="/页/"]',
    'a[href*="/頁/"]',
  ].join(', ');

  $(paginationSelectors).each((_, el) => {
    const href = $(el).attr('href');
    const text = $(el).text().replace(/\s+/g, ' ').trim();

    if (!href) {
      return;
    }

    const normalizedUrl = toAbsoluteNormalizedUrl(href, pageUrl);
    if (!normalizedUrl) {
      return;
    }

    const candidate = new URL(normalizedUrl);
    if (!isLikelyChapterListPageUrl(candidate, source, href, text)) {
      return;
    }

    const pageNumber = extractPaginationPageNumber(candidate, text);
    if (pageNumber !== 1) {
      urls.add(normalizedUrl);
    }

    if (pageNumber === null) {
      return;
    }

    const rangeKey = `${candidate.origin}${candidate.pathname}:${getPaginationParamName(candidate) || 'path'}`;
    const existingRange = generatedRanges.get(rangeKey);
    if (!existingRange || pageNumber > existingRange.maxPage) {
      generatedRanges.set(rangeKey, { sampleUrl: candidate, maxPage: pageNumber });
    }
  });

  for (const { sampleUrl, maxPage } of generatedRanges.values()) {
    const boundedMaxPage = Math.min(maxPage, MAX_CHAPTER_LIST_PAGES);

    for (let pageNumber = 2; pageNumber <= boundedMaxPage; pageNumber++) {
      const generatedUrl = buildPaginationUrl(sampleUrl, pageNumber);
      if (generatedUrl) {
        urls.add(generatedUrl);
      }
    }
  }

  return Array.from(urls).sort((a, b) => {
    const pageDelta = getPaginationSortNumber(a) - getPaginationSortNumber(b);
    return pageDelta !== 0 ? pageDelta : a.localeCompare(b);
  });
}

function findCatalogueDiscoveryUrls(
  $: cheerio.CheerioAPI,
  pageUrl: string,
  sourceUrl: string
): string[] {
  const urls = new Set<string>();
  const source = new URL(sourceUrl);

  $('a[href], button, [role="button"], [onclick], [data-href], [data-url], [data-link], [data-catalog], [data-catalogue], [data-toc]').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    const rawUrls = collectPotentialUrlsFromElement($, el);

    for (const rawUrl of rawUrls) {
      const normalizedUrl = toAbsoluteNormalizedUrl(rawUrl, pageUrl);
      if (!normalizedUrl) {
        continue;
      }

      const candidate = new URL(normalizedUrl);
      if (isLikelyCataloguePageUrl(candidate, source, rawUrl, text)) {
        urls.add(normalizedUrl);
      }
    }
  });

  return Array.from(urls).sort((a, b) => a.localeCompare(b));
}

function buildCatalogueGuessUrls(sourceUrl: string): string[] {
  const urls = new Set<string>();
  const source = new URL(sourceUrl);
  const pathname = source.pathname.replace(/\/+$/, '');
  const pathWithoutExt = pathname.replace(/\.html?$/i, '');
  const lastSegment = safeDecodeURIComponent(pathWithoutExt.split('/').filter(Boolean).at(-1) || '');
  const numericId = pathname.match(/(?:^|\/)(\d+)(?:\.html?)?(?:\/)?$/i)?.[1] || '';
  const idOrSlug = numericId || lastSegment;

  if (!idOrSlug) {
    return [];
  }

  const baseDirectories = new Set<string>();
  const parentDir = pathWithoutExt.split('/').slice(0, -1).join('/') || '';
  if (parentDir) {
    baseDirectories.add(parentDir);
  }

  if (numericId) {
    baseDirectories.add('/book');
    baseDirectories.add('/txt');
    baseDirectories.add('/novel');
  }

  for (const baseDir of baseDirectories) {
    const basePath = `${baseDir}/${idOrSlug}`.replace(/\/+/g, '/');
    const candidates = [
      `${basePath}/`,
      `${basePath}/index.html`,
      `${basePath}/catalog.html`,
      `${basePath}/catalogue.html`,
      `${basePath}/toc.html`,
      `${basePath}/chapters.html`,
      `${basePath}/list.html`,
      `${basePath}/all.html`,
    ];

    for (const candidate of candidates) {
      pushNormalizedUrl(urls, candidate, sourceUrl);
    }
  }

  urls.delete(normalizeUrl(sourceUrl));
  return Array.from(urls).slice(0, MAX_CATALOGUE_GUESS_URLS);
}

async function getBrowser(): Promise<Browser> {
  if (manualBrowserInstance?.connected) {
    return manualBrowserInstance;
  }

  if (!browserInstance || !browserInstance.connected) {
    browserInstance = await puppeteer.launch({
      headless: PUPPETEER_HEADLESS,
      userDataDir: PUPPETEER_USER_DATA_DIR,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--disable-blink-features=AutomationControlled',
      ],
    });
  }
  return browserInstance;
}

export async function openManualBrowserSession(url: string): Promise<void> {
  if (browserInstance?.connected) {
    await closeBrowser();
  }

  if (!manualBrowserInstance || !manualBrowserInstance.connected) {
    manualBrowserInstance = await puppeteer.launch({
      headless: false,
      userDataDir: PUPPETEER_USER_DATA_DIR,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--window-size=1400,1000',
      ],
    });
  }

  const page = await manualBrowserInstance.newPage();
  await page.setUserAgent(DEFAULT_USER_AGENT);
  await page.setViewport({ width: 1400, height: 1000 });
  await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: PUPPETEER_NAVIGATION_TIMEOUT_MS,
  });
}

/**
 * Fetches rendered HTML content from a URL using Puppeteer.
 */
async function fetchHtml(url: string): Promise<string> {
  if (htmlFetcherOverride) {
    return htmlFetcherOverride(url);
  }

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setUserAgent(DEFAULT_USER_AGENT);
    await page.setViewport({ width: 1920, height: 1080 });
    page.setDefaultNavigationTimeout(PUPPETEER_NAVIGATION_TIMEOUT_MS);

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });

    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (resourceType === 'image' || resourceType === 'font' || resourceType === 'media') {
        void request.abort().catch(() => undefined);
        return;
      }

      void request.continue().catch(() => undefined);
    });

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: PUPPETEER_NAVIGATION_TIMEOUT_MS,
    });

    await page.waitForSelector('body', { timeout: Math.min(5000, PUPPETEER_NAVIGATION_TIMEOUT_MS) }).catch(() => undefined);
    if (PUPPETEER_RENDER_WAIT_MS > 0) {
      await new Promise(resolve => setTimeout(resolve, PUPPETEER_RENDER_WAIT_MS));
    }

    // Check if still on a challenge page and wait longer if needed.
    const pageContent = await page.content();
    if (isBrowserChallengePage(pageContent)) {
      console.log(`[Scraper] Browser challenge detected at ${url}, waiting for clearance...`);
      await page.waitForFunction(
        (patterns: string[]) => {
          const html = document.documentElement?.outerHTML || '';
          return !patterns.some((pattern) => new RegExp(pattern, 'iu').test(html));
        },
        { timeout: PUPPETEER_CHALLENGE_WAIT_MS },
        BROWSER_CHALLENGE_PATTERNS.map((pattern) => pattern.source)
      ).catch(() => undefined);
    }

    const html = await page.content();
    if (isBrowserChallengePage(html)) {
      throw new ManualInterventionRequiredError(
        `Browser challenge did not clear for ${url}. The site is returning an anti-bot/challenge page instead of readable novel HTML.`,
        url
      );
    }
    return html;
  } finally {
    await page.close();
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: NodeJS.Timeout;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
    timeout.unref();
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeout));
}

/**
 * Close the shared browser instance. If Chromium does not exit promptly, kill it.
 */
export async function closeBrowser(timeoutMs = 3000) {
  const browsers = [browserInstance, manualBrowserInstance].filter(Boolean) as Browser[];
  browserInstance = null;
  manualBrowserInstance = null;

  for (const browser of browsers) {
    try {
      await withTimeout(browser.close(), timeoutMs, 'Timed out closing Puppeteer browser.');
    } catch (err) {
      console.error('[Scraper] Error closing Puppeteer browser, killing process:', err);
      const browserProcess = (browser as any).process?.();
      if (browserProcess && !browserProcess.killed) {
        browserProcess.kill('SIGKILL');
      }
    }
  }
}

export class ScraperService {
  /**
   * Scrapes metadata and chapter index from the main novel URL
   */
  static async scrapeMetadata(url: string): Promise<ScrapedMetadata> {
    const data = await fetchHtml(url);
    return this.parseMetadataHtml(data, url, { discoverAdditionalPages: true });
  }

  static async scrapeMetadataFromHtml(html: string, url: string): Promise<ScrapedMetadata> {
    return this.parseMetadataHtml(html, url, { discoverAdditionalPages: false });
  }

  private static async parseMetadataHtml(
    data: string,
    url: string,
    options: { discoverAdditionalPages: boolean }
  ): Promise<ScrapedMetadata> {
    const $ = cheerio.load(data);
    const parsedUrl = new URL(url);
    const origin = parsedUrl.origin;
    const labeledMetadata = collectLabeledMetadata($);

    // 1. Extract Title
    let title = $('meta[property="og:title"]').attr('content') || 
                $('h1').first().text().trim() || 
                $('title').text().replace(/-.*/, '').trim() || 
                'Unknown Novel';

    // 2. Extract Author and source metadata fields
    const rawAuthor = $('meta[property="book:author"]').attr('content') ||
                      labeledMetadata.author ||
                      $('.author').first().text().replace(/^(?:author|作者|著者|作家|작가|автор|مؤلف|المؤلف)\s*[:：]\s*/iu, '').trim() ||
                      '';
    const authorNames = splitMetadataList(rawAuthor);
    const authorPenName = labeledMetadata.authorPenName || authorNames[0] || '';
    const authorRealName = labeledMetadata.authorRealName || '';
    const author = authorPenName || rawAuthor || 'Unknown Author';
    const alternativeNames = labeledMetadata.alternativeNames ? splitMetadataList(labeledMetadata.alternativeNames) : [];
    const genres = labeledMetadata.genres ? splitMetadataList(labeledMetadata.genres) : [];
    const originalSource = labeledMetadata.originalSource || '';
    const publicationStatus = labeledMetadata.publicationStatus || '';

    // 3. Extract Description
    let description = $('meta[property="og:description"]').attr('content') || 
                      $('.description').first().text().trim() || 
                      $('#description').text().trim() || 
                      $('.synopsis').first().text().trim() || 
                      '';

    // 4. Extract Cover URL
    let coverUrl = $('meta[property="og:image"]').attr('content') || '';
    if (coverUrl && !coverUrl.startsWith('http')) {
      coverUrl = new URL(coverUrl, origin).toString();
    }
    if (!coverUrl) {
      // Find largest image in article or main containers
      $('img').each((_, el) => {
        const src = $(el).attr('src');
        if (src && (src.includes('cover') || src.includes('novel') || src.includes('book'))) {
          coverUrl = new URL(src, origin).toString();
          return false;
        }
      });
    }

    // 5. Extract Chapters, including paginated chapter lists
    const chaptersByUrl = new Map<string, UnitCandidate>();
    const chapterOrderState = { next: 0 };
    const visitedListPages = new Set<string>();
    const normalizedSourceUrl = normalizeUrl(url);
    const pendingListPages = [normalizedSourceUrl];
    if (options.discoverAdditionalPages) {
      for (const guessedCatalogueUrl of buildCatalogueGuessUrls(normalizedSourceUrl)) {
        if (!pendingListPages.includes(guessedCatalogueUrl)) {
          pendingListPages.push(guessedCatalogueUrl);
        }
      }
    }
    const pageHtmlCache = new Map<string, string>([[normalizedSourceUrl, data]]);

    while (pendingListPages.length > 0 && visitedListPages.size < MAX_CHAPTER_LIST_PAGES) {
      const batchUrls: string[] = [];

      while (
        pendingListPages.length > 0 &&
        batchUrls.length < CHAPTER_LIST_PAGE_CONCURRENCY &&
        visitedListPages.size < MAX_CHAPTER_LIST_PAGES
      ) {
        const pageUrl = pendingListPages.shift();
        if (!pageUrl || visitedListPages.has(pageUrl)) {
          continue;
        }

        visitedListPages.add(pageUrl);
        batchUrls.push(pageUrl);
      }

      if (batchUrls.length === 0) {
        continue;
      }

      const loadedPages = await Promise.all(batchUrls.map(async (pageUrl) => {
        const pageData = pageHtmlCache.get(pageUrl) || await fetchHtml(pageUrl);
        return {
          pageUrl,
          page$: pageUrl === normalizedSourceUrl ? $ : cheerio.load(pageData),
        };
      }));

      for (const { pageUrl, page$ } of loadedPages) {
        collectChapterLinks(page$, pageUrl, url, chaptersByUrl, chapterOrderState);

        const discoveredListUrls = options.discoverAdditionalPages
          ? [
              ...findCatalogueDiscoveryUrls(page$, pageUrl, url),
              ...findChapterListPaginationUrls(page$, pageUrl, url),
            ]
          : [];

        for (const listPageUrl of discoveredListUrls) {
          if (!visitedListPages.has(listPageUrl) && !pendingListPages.includes(listPageUrl)) {
            pendingListPages.push(listPageUrl);
          }
        }
      }
    }

    const units = finalizeChapters(chaptersByUrl);

    return {
      title,
      author,
      authorPenName,
      authorRealName,
      alternativeNames,
      genres,
      originalSource,
      publicationStatus,
      description,
      coverUrl,
      units,
    };
  }

  /**
   * Scrapes a single chapter's content
   */
  static async scrapeUnit(url: string): Promise<ScrapedUnit> {
    const data = await fetchHtml(url);
    return this.scrapeUnitFromHtml(data, url);
  }

  static async scrapeUnitFromHtml(html: string, url: string): Promise<ScrapedUnit> {
    return this.parseUnitHtml(html, url);
  }

  private static parseUnitHtml(data: string, _url: string): ScrapedUnit {
    const $ = cheerio.load(data);
    const title = extractChapterTitleFromHtml($, data);
    const contentHtml = extractChapterContentHtml($, title);

    return {
      title,
      content: contentHtml,
    };
  }
}
