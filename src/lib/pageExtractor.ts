/**
 * Smart page content extraction.
 * Prioritizes article body, strips nav/footer/ads, returns metadata.
 */

export interface PageContent {
  text: string;
  wordCount: number;
  readingTimeMin: number;
  pageType: 'article' | 'product' | 'docs' | 'code' | 'social' | 'search' | 'generic';
  title: string;
  domain: string;
}

const STRIP_SELECTORS = [
  'nav', 'header', 'footer', 'aside', '[role="navigation"]', '[role="banner"]',
  '[role="complementary"]', '.sidebar', '.nav', '.navbar', '.footer', '.header',
  '.cookie-banner', '.cookie-consent', '#cookie-banner', '.ad', '.ads', '.advertisement',
  '[class*="cookie"]', '[class*="popup"]', '[class*="modal"]', '[class*="newsletter"]',
  '[class*="promo"]', '[class*="banner"]', 'script', 'style', 'noscript',
];

const ARTICLE_SELECTORS = [
  'article', '[role="main"]', 'main', '.article', '.post', '.content',
  '.post-content', '.article-content', '.entry-content', '.story-body',
  '#content', '#main', '#article', '.markdown-body', '.prose',
];

function detectPageType(): PageContent['pageType'] {
  const url = window.location.href;
  const hostname = window.location.hostname;

  if (url.includes('github.com') || document.querySelector('pre code, .highlight')) return 'code';
  if (document.querySelector('.product-title, [itemtype*="Product"], .price, #productTitle')) return 'product';
  if (hostname.includes('twitter.com') || hostname.includes('x.com') ||
    hostname.includes('reddit.com') || hostname.includes('facebook.com') ||
    hostname.includes('linkedin.com')) return 'social';
  if (hostname.includes('google.com') || hostname.includes('bing.com') ||
    hostname.includes('duckduckgo.com')) return 'search';
  if (document.querySelector('article, .post-content, .article-body, time[datetime]')) return 'article';
  if (document.querySelector('.docs, .documentation, .api-reference, .toc')) return 'docs';
  return 'generic';
}

function extractText(root: Element): string {
  // Clone to avoid mutating the page
  const clone = root.cloneNode(true) as Element;
  // Remove unwanted elements from clone
  STRIP_SELECTORS.forEach(sel => {
    clone.querySelectorAll(sel).forEach(el => el.remove());
  });
  return (clone as HTMLElement).innerText || clone.textContent || '';
}

export function extractPageContent(): PageContent {
  const title = document.title.trim();
  const domain = window.location.hostname;
  const pageType = detectPageType();

  let text = '';

  // Try structured article selectors first
  for (const sel of ARTICLE_SELECTORS) {
    const el = document.querySelector(sel);
    if (el) {
      const candidate = extractText(el).trim();
      if (candidate.length > 500) {
        text = candidate;
        break;
      }
    }
  }

  // Fall back to largest text block heuristic
  if (!text) {
    const paragraphs = Array.from(document.querySelectorAll('p'));
    if (paragraphs.length > 3) {
      text = paragraphs.map(p => p.textContent?.trim()).filter(Boolean).join('\n');
    }
  }

  // Ultimate fallback: full body text
  if (!text || text.length < 200) {
    text = extractText(document.body).trim();
  }

  // Truncate at 30,000 chars
  if (text.length > 30000) {
    text = text.substring(0, 30000) + '\n\n[Content truncated for length...]';
  }

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const readingTimeMin = Math.max(1, Math.ceil(wordCount / 238));

  return { text, wordCount, readingTimeMin, pageType, title, domain };
}

export function getPageStats(): { wordCount: number; readingTimeMin: number; pageType: PageContent['pageType'] } {
  const { wordCount, readingTimeMin, pageType } = extractPageContent();
  return { wordCount, readingTimeMin, pageType };
}
