/**
 * YouTube page detection and context extraction.
 * Handles watch, shorts, and live pages with robust fallback selectors.
 */

export function isYouTubePage(): boolean {
  if (!window.location.hostname.includes('youtube.com')) return false;
  const path = window.location.pathname;
  return path === '/watch' || path.startsWith('/shorts/') || path.startsWith('/live');
}

export function getVideoId(): string | null {
  const path = window.location.pathname;
  // Shorts: /shorts/{id}
  if (path.startsWith('/shorts/')) {
    return path.replace('/shorts/', '').split('/')[0];
  }
  // Live: /live/{id}
  if (path.startsWith('/live/')) {
    return path.replace('/live/', '').split('/')[0];
  }
  // Regular watch: ?v=
  return new URLSearchParams(window.location.search).get('v');
}

export function getVideoTitle(): string {
  // Try multiple selectors (YouTube changes these frequently)
  const selectors = [
    'h1.ytd-watch-metadata yt-formatted-string',
    'h1.style-scope.ytd-watch-metadata',
    '#above-the-fold h1',
    'ytd-watch-metadata h1',
    'h1[class*="title"]',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el?.textContent?.trim()) return el.textContent.trim();
  }
  // Fallback: parse from page title
  return document.title.replace(/\s*[-–|]\s*YouTube\s*$/, '').trim() || 'Unknown Video';
}

export function getVideoDescription(): string {
  const selectors = [
    '#description-inner ytd-text-inline-expander .content',
    '#description .content',
    'ytd-video-secondary-info-renderer #description',
    '#description-text',
    'yt-formatted-string#content',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    const text = el?.textContent?.trim();
    if (text && text.length > 20) return text.substring(0, 2000);
  }
  return '';
}

export function getTranscriptText(): string | null {
  // Try multiple transcript segment selectors
  const segmentSelectors = [
    'ytd-transcript-segment-renderer .segment-text',
    'ytd-transcript-segment-renderer .cue-group-start-offset',
    '.ytd-transcript-segment-renderer',
    '[class*="segment"] [class*="text"]',
  ];

  for (const sel of segmentSelectors) {
    const segments = document.querySelectorAll(sel);
    if (segments.length > 0) {
      const lines: string[] = [];
      segments.forEach(seg => {
        const text = seg.textContent?.trim();
        if (text) lines.push(text);
      });
      if (lines.length > 0) return lines.join(' ');
    }
  }
  return null;
}

export function getChapterList(): string {
  const chapters = document.querySelectorAll('#panels ytd-macro-markers-list-item-renderer, .chapter-title');
  if (chapters.length === 0) return '';
  const list = Array.from(chapters).map(c => c.textContent?.trim()).filter(Boolean);
  return list.length ? `\nChapters: ${list.join(', ')}` : '';
}

export function buildYouTubeContext(): string {
  const title = getVideoTitle();
  const description = getVideoDescription();
  const transcript = getTranscriptText();
  const chapters = getChapterList();

  let context = `[YouTube Video] Title: "${title}"`;
  if (chapters) context += chapters;
  if (description) context += `\nDescription: ${description}`;
  if (transcript) {
    context += `\nTranscript (${transcript.split(' ').length} words): ${transcript}`;
  } else {
    context += '\nNote: Transcript not available. Open the transcript panel (⋮ menu → "Open transcript") for better video analysis.';
  }

  return context;
}
