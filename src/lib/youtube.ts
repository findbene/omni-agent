/**
 * YouTube page detection and context extraction.
 */

export function isYouTubePage(): boolean {
  return window.location.hostname.includes('youtube.com') && window.location.pathname === '/watch';
}

export function getVideoId(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('v');
}

export function getVideoTitle(): string {
  const el = document.querySelector('h1.ytd-watch-metadata yt-formatted-string');
  return el?.textContent?.trim() || document.title.replace(' - YouTube', '').trim();
}

export function getVideoDescription(): string {
  const el = document.querySelector('#description-inner ytd-text-inline-expander .content');
  return el?.textContent?.trim().substring(0, 2000) || '';
}

export function getTranscriptText(): string | null {
  // Try to extract from the transcript panel if it's open
  const segments = document.querySelectorAll('ytd-transcript-segment-renderer .segment-text');
  if (segments.length === 0) return null;
  
  const lines: string[] = [];
  segments.forEach((seg) => {
    const text = seg.textContent?.trim();
    if (text) lines.push(text);
  });
  
  return lines.join(' ');
}

export function buildYouTubeContext(): string {
  const title = getVideoTitle();
  const description = getVideoDescription();
  const transcript = getTranscriptText();
  
  let context = `[YouTube Video] Title: "${title}"`;
  if (description) context += `\nDescription: ${description}`;
  if (transcript) context += `\nTranscript: ${transcript}`;
  
  return context;
}
