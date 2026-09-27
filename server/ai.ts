// Forwards AI requests to the provider the user picked.
// The API key comes from the user's device with every request and is never stored.
import Anthropic from '@anthropic-ai/sdk'
import { findProvider, type AiProvider } from '../src/lib/aiProviders.ts'

export class AiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function getProvider(id: string): AiProvider {
  const provider = findProvider(id)
  // "custom" servers are called from the browser, never from here
  if (!provider || provider.api === 'custom') throw new AiError(400, 'Unbekannter Anbieter')
  return provider
}

export async function complete(
  providerId: string,
  model: string,
  apiKey: string,
  system: string,
  prompt: string,
): Promise<string> {
  const provider = getProvider(providerId)
  if (provider.api === 'anthropic') return completeAnthropic(model, apiKey, system, prompt)

  const res = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) throw new AiError(res.status, await readError(res))

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  return data.choices?.[0]?.message?.content ?? ''
}

async function completeAnthropic(model: string, apiKey: string, system: string, prompt: string) {
  const client = new Anthropic({ apiKey, timeout: 60_000, maxRetries: 0 })
  // Opus 5 and Fable 5 can decline a request; "fallbacks" lets the API retry
  // on a fitting model instead of returning nothing.
  const canFallback = model.startsWith('claude-opus-5') || model.startsWith('claude-fable-5')
  try {
    const response = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      system,
      messages: [{ role: 'user', content: prompt }],
      ...(canFallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
    })
    if (response.stop_reason === 'refusal') throw new AiError(422, 'Die KI hat die Anfrage abgelehnt.')
    return response.content.map((block) => (block.type === 'text' ? block.text : '')).join('')
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) throw new AiError(401, 'API-Key ungültig')
    if (error instanceof Anthropic.RateLimitError) throw new AiError(429, 'Zu viele Anfragen, bitte kurz warten')
    if (error instanceof Anthropic.APIError) throw new AiError(error.status ?? 502, error.message)
    throw error
  }
}

// Lists the models the key has access to, so users don't have to guess names.
export async function listModels(providerId: string, apiKey: string): Promise<string[]> {
  const provider = getProvider(providerId)

  if (provider.api === 'anthropic') {
    const client = new Anthropic({ apiKey, timeout: 30_000, maxRetries: 0 })
    const ids: string[] = []
    try {
      for await (const model of client.models.list()) ids.push(model.id)
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError) throw new AiError(401, 'API-Key ungültig')
      throw error
    }
    return ids
  }

  const res = await fetch(`${provider.baseUrl}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new AiError(res.status, await readError(res))
  const data = (await res.json()) as { data?: { id: string }[] }
  return (data.data ?? []).map((m) => m.id.replace(/^models\//, '')).sort()
}

async function readError(res: Response): Promise<string> {
  if (res.status === 401 || res.status === 403) return 'API-Key ungültig oder ohne Berechtigung'
  if (res.status === 429) return 'Limit erreicht, bitte kurz warten'
  try {
    const body = (await res.json()) as { error?: { message?: string } | string }
    const message = typeof body.error === 'string' ? body.error : body.error?.message
    return message ?? `Fehler ${res.status}`
  } catch {
    return `Fehler ${res.status}`
  }
}
