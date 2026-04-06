/**
 * Type-safe Chrome storage wrapper for Omni-Agent settings and state.
 */

export interface OmniSettings {
  geminiApiKey: string;
  openaiApiKey: string;
  anthropicApiKey: string;
  selectedModel: string;
  theme: 'dark' | 'light' | 'system';
  omniAgentBrain: string;
}

export interface Message {
  role: 'user' | 'ai';
  content: string;
}

const DEFAULT_SETTINGS: OmniSettings = {
  geminiApiKey: '',
  openaiApiKey: '',
  anthropicApiKey: '',
  selectedModel: 'gemini-2.5-flash',
  theme: 'dark',
  omniAgentBrain: '',
};

export async function getSettings(): Promise<OmniSettings> {
  const data = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  return { ...DEFAULT_SETTINGS, ...data } as OmniSettings;
}

export async function saveSetting(key: keyof OmniSettings, value: string): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export async function saveSettings(updates: Partial<OmniSettings>): Promise<void> {
  await chrome.storage.local.set(updates);
}

export async function appendBrainFact(fact: string): Promise<string> {
  const { omniAgentBrain } = await getSettings();
  const updated = omniAgentBrain ? `${omniAgentBrain}\n- ${fact}` : `- ${fact}`;
  await chrome.storage.local.set({ omniAgentBrain: updated });
  return updated;
}
