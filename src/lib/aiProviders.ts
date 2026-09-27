// All AI providers the app can talk to.
// Almost every provider speaks the OpenAI "chat completions" format,
// only Anthropic has its own API. "custom" is called straight from the
// browser (e.g. Ollama or LM Studio running on your own computer).

export interface AiProvider {
  id: string
  name: string
  api: 'openai' | 'anthropic' | 'custom'
  baseUrl: string
  defaultModel: string
  keyUrl: string // where you get an API key
  keyHint: string // how a key starts, shown as placeholder
  free: boolean // has a free tier
}

export const aiProviders: AiProvider[] = [
  {
    id: 'google',
    name: 'Google Gemini',
    api: 'openai',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.5-flash',
    keyUrl: 'https://aistudio.google.com/apikey',
    keyHint: 'AIza…',
    free: true,
  },
  {
    id: 'groq',
    name: 'Groq',
    api: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    keyUrl: 'https://console.groq.com/keys',
    keyHint: 'gsk_…',
    free: true,
  },
  {
    id: 'cerebras',
    name: 'Cerebras',
    api: 'openai',
    baseUrl: 'https://api.cerebras.ai/v1',
    defaultModel: 'llama-3.3-70b',
    keyUrl: 'https://cloud.cerebras.ai',
    keyHint: 'csk-…',
    free: true,
  },
  {
    id: 'mistral',
    name: 'Mistral',
    api: 'openai',
    baseUrl: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-small-latest',
    keyUrl: 'https://console.mistral.ai/api-keys',
    keyHint: 'API-Key',
    free: true,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    api: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openrouter/auto',
    keyUrl: 'https://openrouter.ai/keys',
    keyHint: 'sk-or-…',
    free: true,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    api: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-5-mini',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyHint: 'sk-…',
    free: false,
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    api: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-opus-5',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    keyHint: 'sk-ant-…',
    free: false,
  },
  {
    id: 'xai',
    name: 'xAI Grok',
    api: 'openai',
    baseUrl: 'https://api.x.ai/v1',
    defaultModel: 'grok-3-mini',
    keyUrl: 'https://console.x.ai',
    keyHint: 'xai-…',
    free: false,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    api: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    keyHint: 'sk-…',
    free: false,
  },
  {
    id: 'together',
    name: 'Together AI',
    api: 'openai',
    baseUrl: 'https://api.together.xyz/v1',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    keyUrl: 'https://api.together.ai/settings/api-keys',
    keyHint: 'API-Key',
    free: false,
  },
  {
    id: 'fireworks',
    name: 'Fireworks AI',
    api: 'openai',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    defaultModel: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
    keyUrl: 'https://fireworks.ai/account/api-keys',
    keyHint: 'fw_…',
    free: false,
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    api: 'openai',
    baseUrl: 'https://api.perplexity.ai',
    defaultModel: 'sonar',
    keyUrl: 'https://www.perplexity.ai/settings/api',
    keyHint: 'pplx-…',
    free: false,
  },
  {
    id: 'cohere',
    name: 'Cohere',
    api: 'openai',
    baseUrl: 'https://api.cohere.ai/compatibility/v1',
    defaultModel: 'command-a-03-2025',
    keyUrl: 'https://dashboard.cohere.com/api-keys',
    keyHint: 'API-Key',
    free: true,
  },
  {
    id: 'custom',
    name: 'Eigener Server (Ollama, LM Studio …)',
    api: 'custom',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3.1',
    keyUrl: 'https://ollama.com',
    keyHint: 'optional',
    free: true,
  },
]

export function findProvider(id: string): AiProvider | undefined {
  return aiProviders.find((p) => p.id === id)
}
