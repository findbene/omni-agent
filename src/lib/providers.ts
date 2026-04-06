/**
 * AI model definitions and provider metadata.
 * Gemini is fully wired; OpenAI and Anthropic are architecture-ready for Phase 2.
 */

export type Provider = 'google' | 'openai' | 'anthropic';

export interface ModelDefinition {
  id: string;
  name: string;
  provider: Provider;
  description: string;
  icon: string;
  maxContext: number;
}

export const MODELS: ModelDefinition[] = [
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    description: 'Fast & capable',
    icon: '⚡',
    maxContext: 1000000,
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'google',
    description: 'Most powerful',
    icon: '🧠',
    maxContext: 1000000,
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    description: 'Legacy fast',
    icon: '💨',
    maxContext: 1000000,
  },
];

export const DEFAULT_MODEL = 'gemini-2.5-flash';

export function getModel(id: string): ModelDefinition | undefined {
  return MODELS.find(m => m.id === id);
}

export function getModelsByProvider(provider: Provider): ModelDefinition[] {
  return MODELS.filter(m => m.provider === provider);
}
