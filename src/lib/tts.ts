/**
 * Text-to-Speech wrapper using Web Speech API.
 * Strips markdown before speaking for clean output.
 */

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/`[^`]+`/g, '') // Remove inline code
    .replace(/#{1,6}\s+/g, '') // Remove headings
    .replace(/\*\*(.+?)\*\*/g, '$1') // Bold → plain
    .replace(/\*(.+?)\*/g, '$1') // Italic → plain
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links → text only
    .replace(/^[-*]\s+/gm, '') // Remove list markers
    .replace(/^\d+\.\s+/gm, '') // Remove ordered list markers
    .replace(/^>\s+/gm, '') // Remove blockquotes
    .replace(/---/g, '') // Remove HR
    .replace(/\n{3,}/g, '\n\n') // Collapse excess newlines
    .trim();
}

let currentUtterance: SpeechSynthesisUtterance | null = null;

export function speak(text: string, voice?: string, rate = 1.0, pitch = 1.0): void {
  stopSpeaking();
  const clean = stripMarkdown(text);
  if (!clean) return;

  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.rate = rate;
  utterance.pitch = pitch;

  if (voice) {
    const voices = speechSynthesis.getVoices();
    const found = voices.find(v => v.name === voice || v.voiceURI === voice);
    if (found) utterance.voice = found;
  }

  currentUtterance = utterance;
  speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (speechSynthesis.speaking || speechSynthesis.pending) {
    speechSynthesis.cancel();
  }
  currentUtterance = null;
}

export function isSpeaking(): boolean {
  return speechSynthesis.speaking;
}

export function getAvailableVoices(): SpeechSynthesisVoice[] {
  return speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'));
}

export function onVoicesLoaded(callback: (voices: SpeechSynthesisVoice[]) => void): void {
  if (speechSynthesis.getVoices().length > 0) {
    callback(speechSynthesis.getVoices());
  } else {
    speechSynthesis.addEventListener('voiceschanged', () => {
      callback(speechSynthesis.getVoices());
    }, { once: true });
  }
}
