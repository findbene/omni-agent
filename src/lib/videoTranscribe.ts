/**
 * Video audio capture and transcription.
 * Uses HTMLVideoElement.captureStream() to record audio from any playing video,
 * then sends to background for AI transcription (Gemini or OpenAI Whisper).
 */

export interface VideoTranscribeProgress {
  stage: 'detecting' | 'recording' | 'processing' | 'transcribing';
  message: string;
  secondsRemaining?: number;
}

export interface VideoTranscribeResult {
  transcript: string;
  title: string;
  durationSec: number;
  source: 'gemini' | 'whisper';
}

/** Find the most prominent video element on the page. */
export function findVideoElement(): HTMLVideoElement | null {
  const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('video'));
  if (videos.length === 0) return null;
  // Prefer largest video that has loaded
  return videos
    .filter(v => v.readyState >= 1)
    .sort((a, b) => (b.videoWidth * b.videoHeight) - (a.videoWidth * a.videoHeight))[0]
    ?? videos[0];
}

/** Get a human-readable title for the video source. */
export function getVideoSourceTitle(): string {
  // YouTube
  if (window.location.hostname.includes('youtube.com')) {
    const el = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, h1[class*="title"]');
    if (el?.textContent?.trim()) return el.textContent.trim();
  }
  // Generic: try og:title, page title, or URL
  const ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content;
  if (ogTitle) return ogTitle;
  return document.title || window.location.hostname;
}

/**
 * Capture N seconds of audio from the best video element on the page.
 * Returns base64-encoded WebM/Opus audio blob.
 *
 * Automatically starts playback if paused and restores pause state when done.
 */
export async function captureVideoAudio(
  durationMs: number,
  onProgress: (p: VideoTranscribeProgress) => void,
  signal?: AbortSignal,
): Promise<{ base64: string; mimeType: string; durationSec: number }> {
  onProgress({ stage: 'detecting', message: 'Looking for video on this page…' });

  const video = findVideoElement();
  if (!video) throw new Error('No video element found on this page. Make sure a video is loaded.');

  // captureStream is a non-standard but Chrome-supported method
  const videoEl = video as HTMLVideoElement & { captureStream?: () => MediaStream };

  // Check captureStream support
  if (typeof videoEl.captureStream !== 'function') {
    throw new Error('Video capture is not supported in this browser. Please use Chrome.');
  }

  // Try to capture — throws if DRM-protected
  let stream: MediaStream;
  try {
    stream = videoEl.captureStream();
  } catch {
    throw new Error('This video is DRM-protected and cannot be captured. Try a different video source.');
  }

  const audioTracks = stream.getAudioTracks();
  if (audioTracks.length === 0) {
    throw new Error('No audio track found in the video. The video may be muted or silent.');
  }

  // Auto-play if paused
  const wasPaused = video.paused;
  if (wasPaused) {
    await video.play().catch(() => {
      throw new Error('Could not start video playback. Please press play on the video first.');
    });
  }

  // Prefer opus for best compression/quality ratio
  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : 'audio/ogg;codecs=opus';

  const audioStream = new MediaStream(audioTracks);
  const recorder = new MediaRecorder(audioStream, { mimeType });
  const chunks: Blob[] = [];

  const actualDurationSec = Math.round(durationMs / 1000);

  await new Promise<void>((resolve, reject) => {
    if (signal?.aborted) { reject(new Error('Cancelled')); return; }

    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => resolve();
    recorder.onerror = () => reject(new Error('Recording failed'));

    // Start and update countdown
    recorder.start(500);
    const startTime = Date.now();
    const tick = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, Math.ceil((durationMs - elapsed) / 1000));
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      onProgress({
        stage: 'recording',
        message: `Recording video audio… ${mins}:${String(secs).padStart(2, '0')} remaining`,
        secondsRemaining: remaining,
      });
    }, 500);

    const stop = () => {
      clearInterval(tick);
      try { recorder.stop(); } catch { resolve(); }
      // Restore pause state
      if (wasPaused) video.pause();
      // Stop the captured stream tracks (not the video itself)
      audioStream.getTracks().forEach(t => t.stop());
    };

    setTimeout(stop, durationMs);
    signal?.addEventListener('abort', () => { stop(); reject(new Error('Cancelled')); });
  });

  onProgress({ stage: 'processing', message: 'Processing audio…' });

  const blob = new Blob(chunks, { type: mimeType });
  const base64 = await blobToBase64(blob);
  return { base64, mimeType: mimeType.split(';')[0], durationSec: actualDurationSec };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Send captured audio to background for transcription. */
export async function transcribeVideoAudio(
  base64: string,
  mimeType: string,
  durationSec: number,
  onProgress: (p: VideoTranscribeProgress) => void,
): Promise<VideoTranscribeResult> {
  if (!chrome.runtime?.id) throw new Error('Extension context invalidated. Please reload the page.');

  onProgress({ stage: 'transcribing', message: 'Sending to AI for transcription…' });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Transcription timed out (90s). Try a shorter clip.')), 90000);

    chrome.runtime.sendMessage(
      { type: 'TRANSCRIBE_VIDEO', base64, mimeType, durationSec },
      (response) => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
        if (response?.error) { reject(new Error(response.error)); return; }
        resolve({
          transcript: response.transcript,
          title: getVideoSourceTitle(),
          durationSec,
          source: response.source,
        });
      }
    );
  });
}
