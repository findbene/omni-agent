/**
 * Type-safe Chrome storage wrapper for Omni-Agent settings and state.
 */

export interface CustomPrompt {
  id: string;
  title: string;
  content: string;
}

export interface MonitorJob {
  id: string;
  name: string;
  url: string;
  selector: string;
  intervalMin: number;
  lastValue?: string;
  lastCheck?: number;
  priceHistory?: { value: string; timestamp: number }[];
  webhookUrl?: string;
}

export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  triggers: ('summarize' | 'tracker_change' | 'research' | 'automation')[];
}

export interface OmniSettings {
  geminiApiKey: string;
  openaiApiKey: string;
  anthropicApiKey: string;
  deepseekApiKey: string;
  groqApiKey: string;
  ollamaUrl: string;
  selectedModel: string;
  theme: 'dark' | 'light' | 'system';
  omniAgentBrain: string;
  savedPrompts: CustomPrompt[];
  trackerJobs: MonitorJob[];
  webhooks: WebhookConfig[];
  sidebarWidth: number;
  ttsVoice: string;
  ttsRate: number;
  ttsPitch: number;
  showSelectionToolbar: boolean;
  autoSendTranscription: boolean;
}

export interface Message {
  role: 'user' | 'ai';
  content: string;
  timestamp?: number;
  action?: string;
  attachedFile?: string;
}

const DEFAULT_SETTINGS: OmniSettings = {
  geminiApiKey: '',
  openaiApiKey: '',
  anthropicApiKey: '',
  deepseekApiKey: '',
  groqApiKey: '',
  ollamaUrl: 'http://localhost:11434',
  selectedModel: 'gemini-2.5-flash',
  theme: 'dark',
  omniAgentBrain: '',
  savedPrompts: [
    { id: 'p1', title: 'Deep Critique', content: 'Analyze the provided text for logical fallacies, weak arguments, and structural blind spots. Be ruthless but constructive.' },
    { id: 'p2', title: 'SEO Optimizer', content: 'Extract the primary keywords and propose 3 optimized H1s, a meta description, and structural improvements for SEO.' },
    { id: 'p3', title: 'Explain Like I\'m 5', content: 'Break down this complex concept using simple analogies suitable for a 5-year-old. No jargon.' },
    { id: 'p4', title: 'Extract Action Items', content: 'Read this content and extract a clear, bulleted To-Do list assigning tasks if applicable.' },
    { id: 'p5', title: 'Devil\'s Advocate', content: 'Take the strongest opposing position to the main argument in this content. Argue it persuasively.' },
    { id: 'p6', title: 'Meeting Notes', content: 'Convert this content into structured meeting notes: Attendees, Key Decisions, Action Items, Next Steps.' },
  ],
  trackerJobs: [],
  webhooks: [],
  sidebarWidth: 420,
  ttsVoice: '',
  ttsRate: 1.0,
  ttsPitch: 1.0,
  showSelectionToolbar: true,
  autoSendTranscription: false,
};

export async function getSettings(): Promise<OmniSettings> {
  const data = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  return { ...DEFAULT_SETTINGS, ...data } as OmniSettings;
}

export async function saveSetting(key: keyof OmniSettings, value: unknown): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export async function saveSettings(updates: Partial<OmniSettings>): Promise<void> {
  await chrome.storage.local.set(updates);
}

export async function appendBrainFact(fact: string): Promise<string> {
  const { omniAgentBrain } = await getSettings();
  // Deduplicate: don't append if the fact is already present
  if (omniAgentBrain.includes(fact.trim())) return omniAgentBrain;
  const updated = omniAgentBrain ? `${omniAgentBrain}\n- ${fact}` : `- ${fact}`;
  await chrome.storage.local.set({ omniAgentBrain: updated });
  return updated;
}

export async function exportSettings(): Promise<string> {
  const settings = await getSettings();
  return JSON.stringify(settings, null, 2);
}

export async function importSettings(json: string): Promise<void> {
  const parsed = JSON.parse(json);
  // Validate it's an object with expected keys
  if (typeof parsed !== 'object' || parsed === null) throw new Error('Invalid settings file');
  await chrome.storage.local.set(parsed);
}
