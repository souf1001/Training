// AI features in the browser. The API key is saved only on this device (localStorage).
import { api } from './api'
import { findProvider } from './aiProviders'
import { readJson, writeJson } from './storage'
import type { AiSettings, Macros, Profile } from './types'

const STORAGE_KEY = 'forma.ai'

export function loadAiSettings(): AiSettings | null {
  return readJson<AiSettings>(STORAGE_KEY)
}

export function saveAiSettings(settings: AiSettings | null) {
  writeJson(STORAGE_KEY, settings)
}

export function aiEnabled(): boolean {
  const s = loadAiSettings()
  return Boolean(s?.apiKey || s?.provider === 'custom')
}

export async function askAi(system: string, prompt: string, settings = loadAiSettings()): Promise<string> {
  if (!settings) throw new Error('Kein KI-Anbieter eingerichtet.')
  const provider = findProvider(settings.provider)

  // A server on your own computer (Ollama, LM Studio) is only reachable from your browser.
  if (provider?.api === 'custom') {
    const base = (settings.baseUrl || provider.baseUrl).replace(/\/$/, '')
    const res = await fetch(`${base}/chat/completions`, {
      signal: AbortSignal.timeout(120_000),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
      }),
    }).catch(() => {
      throw new Error('Dein eigener KI-Server ist nicht erreichbar. Läuft er, und ist CORS erlaubt?')
    })
    if (!res.ok) throw new Error(`Eigener Server antwortet mit Fehler ${res.status}`)
    const data = await res.json()
    return data.choices?.[0]?.message?.content ?? ''
  }

  const { text } = await api.post<{ text: string }>('/ai/complete', { ...settings, system, prompt })
  return text
}

export async function listModels(settings: AiSettings): Promise<string[]> {
  const { models } = await api.post<{ models: string[] }>('/ai/models', settings)
  return models
}

// --- food ---------------------------------------------------------------------------

export interface EstimatedFood extends Macros {
  name: string
  amount: string
}

const FOOD_SYSTEM = `Du bist Ernährungsberater und schätzt Kalorien und Makronährstoffe so genau wie möglich.
Regeln:
- Zerlege die Eingabe in einzelne Lebensmittel oder Gerichte.
- Fehlt eine Menge, nimm eine typische Portion in Deutschland an und schreib sie in "amount".
- Denk an versteckte Kalorien wie Öl zum Braten, Soßen und Dressings, wenn sie üblich sind.
- Nutze Nährwerte von Standardquellen (z. B. Bundeslebensmittelschlüssel, USDA) oder bekannte Herstellerangaben.
Antworte NUR mit JSON in genau diesem Format, ohne weiteren Text:
{"items":[{"name":"Banane","amount":"1 Stück (120 g)","kcal":107,"protein":1.3,"carbs":24,"fat":0.4}]}`

export async function estimateFood(text: string): Promise<EstimatedFood[]> {
  const answer = await askAi(FOOD_SYSTEM, text)
  const data = parseJson(answer) as { items?: Partial<EstimatedFood>[] }
  const items = (data.items ?? []).map((i) => ({
    name: String(i.name ?? 'Essen'),
    amount: String(i.amount ?? ''),
    kcal: Math.round(Number(i.kcal) || 0),
    protein: Math.round((Number(i.protein) || 0) * 10) / 10,
    carbs: Math.round((Number(i.carbs) || 0) * 10) / 10,
    fat: Math.round((Number(i.fat) || 0) * 10) / 10,
  }))
  if (items.length === 0) throw new Error('Die KI hat nichts erkannt. Beschreib dein Essen etwas genauer.')
  return items
}

// Models sometimes add a sentence, ```json fences or <think>…</think> around the JSON.
// We try every "{" or "[" until one starts a valid JSON value.
export function parseJson(text: string): unknown {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/```(json)?/g, '')
  for (let start = 0; start < cleaned.length; start++) {
    const char = cleaned[start]
    if (char !== '{' && char !== '[') continue
    const close = char === '{' ? '}' : ']'
    for (let end = cleaned.lastIndexOf(close); end > start; end = cleaned.lastIndexOf(close, end - 1)) {
      try {
        const value = JSON.parse(cleaned.slice(start, end + 1).replace(/,\s*([}\]])/g, '$1'))
        return Array.isArray(value) ? { items: value } : value
      } catch {
        // try a shorter piece
      }
    }
  }
  throw new Error('Die KI-Antwort konnte nicht gelesen werden. Versuch es noch einmal.')
}

// --- coach ----------------------------------------------------------------------------

export async function askCoach(question: string, profile: Profile, context: string): Promise<string> {
  const system = `Du bist ein erfahrener Personal Trainer und Ernährungscoach. Antworte auf Deutsch, per du,
kurz und konkret (max. 150 Wörter), ohne Markdown-Überschriften. Gib keine medizinischen Diagnosen;
bei Schmerzen oder Krankheiten empfiehl ärztlichen Rat.
Über den Nutzer: ${JSON.stringify(profile)}
${context}`
  return askAi(system, question)
}
