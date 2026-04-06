/**
 * Deep Research Agent
 * Generates search queries, fetches multi-source results via DuckDuckGo,
 * and synthesizes a structured research report.
 */

export interface ResearchProgress {
  stage: 'generating_queries' | 'searching' | 'fetching' | 'synthesizing' | 'done';
  detail: string;
  progress: number; // 0–100
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  bodyText?: string;
}

export interface ResearchContext {
  query: string;
  results: SearchResult[];
  totalSources: number;
}

/**
 * Send a message to background to do a fetch (avoids CORS in content scripts).
 */
async function backgroundFetch(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Fetch timeout')), 15000);
    chrome.runtime.sendMessage({ type: 'RESEARCH_FETCH', url }, (response) => {
      clearTimeout(timeout);
      if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
      if (response?.error) { reject(new Error(response.error)); return; }
      resolve(response?.html || '');
    });
  });
}

/**
 * Parse DuckDuckGo HTML results page into SearchResult[].
 */
function parseDDGResults(html: string): SearchResult[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const results: SearchResult[] = [];

  const links = doc.querySelectorAll('.result__a, .result .result__title a');
  const snippets = doc.querySelectorAll('.result__snippet');

  links.forEach((link, i) => {
    const href = (link as HTMLAnchorElement).getAttribute('href') || '';
    // DDG uses redirect URLs, extract actual URL
    const urlMatch = href.match(/uddg=([^&]+)/);
    const url = urlMatch ? decodeURIComponent(urlMatch[1]) : href;
    const title = link.textContent?.trim() || '';
    const snippet = snippets[i]?.textContent?.trim() || '';

    if (url && title && !url.includes('duckduckgo.com') && !url.startsWith('/')) {
      results.push({ title, url, snippet });
    }
  });

  return results.slice(0, 8);
}

/**
 * Extract readable text from a fetched page (lightweight).
 */
function extractBodyText(html: string, maxChars = 3000): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Remove unwanted elements
  ['script', 'style', 'nav', 'header', 'footer', 'aside'].forEach(tag => {
    doc.querySelectorAll(tag).forEach(el => el.remove());
  });

  // Try article first
  const article = doc.querySelector('article, main, [role="main"], .content, .post-content');
  const text = (article || doc.body)?.textContent?.replace(/\s+/g, ' ').trim() || '';
  return text.substring(0, maxChars);
}

/**
 * Perform a single DuckDuckGo search.
 */
async function searchDDG(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=us-en`;
    const html = await backgroundFetch(url);
    return parseDDGResults(html);
  } catch {
    return [];
  }
}

/**
 * Fetch and extract body text from a URL.
 */
async function fetchPageText(url: string): Promise<string> {
  try {
    // Skip non-http, PDFs, and obviously dynamic sites
    if (!url.startsWith('http') || url.endsWith('.pdf')) return '';
    const html = await backgroundFetch(url);
    return extractBodyText(html);
  } catch {
    return '';
  }
}

/**
 * Main research function.
 * @param topic - The research topic
 * @param onProgress - Progress callback
 * @returns Research context ready for AI synthesis
 */
export async function conductResearch(
  topic: string,
  onProgress: (p: ResearchProgress) => void
): Promise<ResearchContext> {
  onProgress({ stage: 'generating_queries', detail: 'Planning search strategy...', progress: 5 });

  // Generate 4 search queries from the topic
  const queries = generateSearchQueries(topic);
  const allResults: SearchResult[] = [];
  const seenUrls = new Set<string>();

  onProgress({ stage: 'searching', detail: `Searching ${queries.length} queries...`, progress: 15 });

  // Search in parallel (limit concurrency)
  const searchPromises = queries.map(q => searchDDG(q));
  const searchResults = await Promise.allSettled(searchPromises);

  for (const result of searchResults) {
    if (result.status === 'fulfilled') {
      for (const item of result.value) {
        if (!seenUrls.has(item.url)) {
          seenUrls.add(item.url);
          allResults.push(item);
        }
      }
    }
  }

  onProgress({ stage: 'fetching', detail: `Reading top ${Math.min(5, allResults.length)} sources...`, progress: 40 });

  // Fetch body text from top 5 results
  const topResults = allResults.slice(0, 5);
  const fetchPromises = topResults.map(async (result) => {
    const body = await fetchPageText(result.url);
    return { ...result, bodyText: body };
  });

  const enriched = await Promise.all(fetchPromises);

  // Merge enriched results back
  const finalResults = allResults.map(r => {
    const enrichedItem = enriched.find(e => e.url === r.url);
    return enrichedItem || r;
  });

  onProgress({ stage: 'synthesizing', detail: 'Synthesizing findings...', progress: 80 });

  return {
    query: topic,
    results: finalResults.slice(0, 10),
    totalSources: finalResults.length,
  };
}

/**
 * Build a synthesis prompt from research context.
 */
export function buildResearchPrompt(context: ResearchContext): string {
  const sourceTexts = context.results.map((r, i) => {
    const body = r.bodyText ? `\nContent: ${r.bodyText}` : '';
    return `Source ${i + 1}: [${r.title}](${r.url})\nSnippet: ${r.snippet}${body}`;
  }).join('\n\n---\n\n');

  return `You are a research analyst. Based on the following ${context.results.length} sources, write a comprehensive research report about: "${context.query}"

SOURCES:
${sourceTexts}

Write a structured report with:
## Executive Summary
(2-3 sentence overview)

## Key Findings
(5-8 bulleted findings, most important first)

## Detailed Analysis
(3-5 paragraphs synthesizing the sources)

## Source Citations
(numbered list of all sources with titles and URLs)

## Related Questions
(3-5 follow-up questions worth exploring)

Be accurate, cite sources by number [1], [2] etc., and note any conflicting information between sources.`;
}

function generateSearchQueries(topic: string): string[] {
  const base = topic.trim();
  return [
    base,
    `${base} explained`,
    `${base} latest research`,
    `${base} guide comprehensive`,
  ];
}
