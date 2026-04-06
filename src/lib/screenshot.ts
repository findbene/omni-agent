/**
 * Screenshot capture and clipboard image handling.
 * Uses chrome.tabs.captureVisibleTab via background message bridge.
 */

export interface CapturedImage {
  dataUrl: string; // base64 data URL
  mimeType: 'image/png' | 'image/jpeg';
  width?: number;
  height?: number;
}

/**
 * Capture the visible portion of the current tab.
 * Returns a base64 PNG data URL.
 */
export async function captureScreenshot(): Promise<CapturedImage> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Screenshot timed out')), 10000);
    chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' }, (response) => {
      clearTimeout(timeout);
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (response?.error) {
        reject(new Error(response.error));
        return;
      }
      if (response?.dataUrl) {
        resolve({ dataUrl: response.dataUrl, mimeType: 'image/png' });
      } else {
        reject(new Error('No screenshot data received'));
      }
    });
  });
}

/**
 * Extract base64 data from a data URL.
 * Returns { base64, mimeType } ready for Gemini inlineData.
 */
export function dataUrlToBase64(dataUrl: string): { base64: string; mimeType: string } {
  const [header, base64] = dataUrl.split(',');
  const mimeType = header.match(/:(.*?);/)?.[1] || 'image/png';
  return { base64, mimeType };
}

/**
 * Try to extract an image from a clipboard paste event.
 * Returns null if no image found.
 */
export function extractImageFromClipboard(e: ClipboardEvent): CapturedImage | null {
  const items = e.clipboardData?.items;
  if (!items) return null;

  for (const item of Array.from(items)) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) {
        // Return a promise-like but we need sync here, so return file info
        // The caller should use FileReader
        return { dataUrl: '', mimeType: item.type as 'image/png' | 'image/jpeg' };
      }
    }
  }
  return null;
}

/**
 * Read a File/Blob as a base64 data URL.
 */
export function readFileAsDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Extract image from clipboard event and convert to data URL.
 */
export async function getClipboardImage(e: ClipboardEvent): Promise<CapturedImage | null> {
  const items = e.clipboardData?.items;
  if (!items) return null;

  for (const item of Array.from(items)) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) {
        const dataUrl = await readFileAsDataUrl(file);
        return { dataUrl, mimeType: item.type as 'image/png' | 'image/jpeg' };
      }
    }
  }
  return null;
}
