/**
 * AI model definitions and provider metadata.
 * Supports Google Gemini, OpenAI, Anthropic, DeepSeek, and Groq.
 */

export type Provider = 'google' | 'openai' | 'anthropic' | 'deepseek' | 'groq' | 'ollama';

export interface ModelDefinition {
  id: string;
  name: string;
  provider: Provider;
  description: string;
  icon: string;
  maxContext: number;
  baseUrl?: string; // Override for non-standard endpoints
  supportsVision?: boolean;
}

export const MODELS: ModelDefinition[] = [
  // ── Google Gemini ──
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    description: 'Fast & capable · 1M context',
    icon: '⚡',
    maxContext: 1000000,
    supportsVision: true,
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'google',
    description: 'Most powerful · 1M context',
    icon: '🧠',
    maxContext: 1000000,
    supportsVision: true,
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    description: 'Fast multimodal',
    icon: '💨',
    maxContext: 1000000,
    supportsVision: true,
  },
  // ── OpenAI ──
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    provider: 'openai',
    description: 'Flagship · 1M context',
    icon: '🟢',
    maxContext: 1000000,
    supportsVision: true,
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    description: 'Advanced reasoning · 128K',
    icon: '🟢',
    maxContext: 128000,
    supportsVision: true,
  },
  {
    id: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    provider: 'openai',
    description: 'Fast & cost-effective',
    icon: '🟢',
    maxContext: 128000,
    supportsVision: true,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    description: 'Lightweight · 128K',
    icon: '🟢',
    maxContext: 128000,
    supportsVision: false,
  },
  // ── Anthropic ──
  {
    id: 'claude-opus-4-5-20251001',
    name: 'Claude Opus 4.5',
    provider: 'anthropic',
    description: 'Most capable · 200K',
    icon: '🟠',
    maxContext: 200000,
    supportsVision: true,
  },
  {
    id: 'claude-sonnet-4-5-20251001',
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    description: 'Balanced · 200K',
    icon: '🟠',
    maxContext: 200000,
    supportsVision: true,
  },
  {
    id: 'claude-3-7-sonnet-20250219',
    name: 'Claude 3.7 Sonnet',
    provider: 'anthropic',
    description: 'Extended thinking · 200K',
    icon: '🟠',
    maxContext: 200000,
    supportsVision: true,
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    description: 'Exceptional coding · 200K',
    icon: '🟠',
    maxContext: 200000,
    supportsVision: true,
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    description: 'Fast & efficient · 200K',
    icon: '🟠',
    maxContext: 200000,
    supportsVision: false,
  },
  // ── DeepSeek ──
  {
    id: 'deepseek-chat',
    name: 'DeepSeek V3',
    provider: 'deepseek',
    description: 'Best open-source · 64K',
    icon: '🔵',
    maxContext: 64000,
    baseUrl: 'https://api.deepseek.com/v1',
    supportsVision: false,
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek R1',
    provider: 'deepseek',
    description: 'Chain-of-thought · 64K',
    icon: '🔵',
    maxContext: 64000,
    baseUrl: 'https://api.deepseek.com/v1',
    supportsVision: false,
  },
  // ── Groq (Ultra-fast) ──
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B',
    provider: 'groq',
    description: 'Ultra-fast · 128K',
    icon: '⚡',
    maxContext: 128000,
    baseUrl: 'https://api.groq.com/openai/v1',
    supportsVision: false,
  },
  {
    id: 'mixtral-8x7b-32768',
    name: 'Mixtral 8x7B',
    provider: 'groq',
    description: 'Fast MoE · 32K',
    icon: '⚡',
    maxContext: 32000,
    baseUrl: 'https://api.groq.com/openai/v1',
    supportsVision: false,
  },
  // ── Ollama (Local) ──
  {
    id: 'ollama/default',
    name: 'Ollama (Local)',
    provider: 'ollama',
    description: 'Your local model',
    icon: '🏠',
    maxContext: 32000,
    baseUrl: 'http://localhost:11434/v1',
    supportsVision: false,
  },
];

export const DEFAULT_MODEL = 'gemini-2.5-flash';

export function getModel(id: string): ModelDefinition | undefined {
  // Handle dynamic Ollama models like "ollama/llama3"
  if (id.startsWith('ollama/')) {
    return {
      id,
      name: `Ollama: ${id.replace('ollama/', '')}`,
      provider: 'ollama',
      description: 'Local model',
      icon: '🏠',
      maxContext: 32000,
      baseUrl: 'http://localhost:11434/v1',
      supportsVision: false,
    };
  }
  return MODELS.find(m => m.id === id);
}

export function getModelsByProvider(provider: Provider): ModelDefinition[] {
  return MODELS.filter(m => m.provider === provider);
}

export function getApiKeyForProvider(provider: Provider, keys: Record<string, string>): string {
  switch (provider) {
    case 'google': return keys.geminiApiKey || '';
    case 'openai': return keys.openaiApiKey || '';
    case 'anthropic': return keys.anthropicApiKey || '';
    case 'deepseek': return keys.deepseekApiKey || '';
    case 'groq': return keys.groqApiKey || '';
    case 'ollama': return 'ollama'; // No key needed for local
    default: return '';
  }
}
