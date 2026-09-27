// Choose an AI provider, enter the API key and pick a model.
import { useState } from 'react'
import { Sheet, Spinner } from './ui'
import { aiProviders, findProvider } from '../lib/aiProviders'
import { askAi, listModels, loadAiSettings, saveAiSettings } from '../lib/ai'
import type { AiSettings } from '../lib/types'

export function AiSettingsSheet({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<AiSettings>(
    () => loadAiSettings() ?? { provider: 'google', model: aiProviders[0].defaultModel, apiKey: '' },
  )
  const [models, setModels] = useState<string[]>([])
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const provider = findProvider(settings.provider) ?? aiProviders[0]
  const isCustom = provider.api === 'custom'

  function chooseProvider(id: string) {
    const next = findProvider(id)!
    setSettings({ provider: id, model: next.defaultModel, apiKey: '', baseUrl: next.api === 'custom' ? next.baseUrl : undefined })
    setModels([])
    setStatus(null)
  }

  async function loadModels() {
    setBusy(true)
    setStatus(null)
    try {
      const list = await listModels(settings)
      setModels(list)
      setStatus({ ok: true, text: `${list.length} Modelle gefunden.` })
    } catch (err) {
      setStatus({ ok: false, text: (err as Error).message })
    } finally {
      setBusy(false)
    }
  }

  async function test() {
    setBusy(true)
    setStatus(null)
    try {
      const answer = await askAi('Antworte nur mit dem Wort OK.', 'Test', settings)
      setStatus({ ok: true, text: `Verbindung klappt. Antwort: „${answer.trim().slice(0, 40)}“` })
    } catch (err) {
      setStatus({ ok: false, text: (err as Error).message })
    } finally {
      setBusy(false)
    }
  }

  function save() {
    saveAiSettings(settings)
    onClose()
  }

  function turnOff() {
    saveAiSettings(null)
    onClose()
  }

  return (
    <Sheet title="KI-Modus" onClose={onClose}>
      <div className="stack">
        <p className="muted small">
          Mit einem eigenen API-Key schätzt die KI deine Mahlzeiten und beantwortet Fragen. Der Key wird nur auf diesem Gerät gespeichert. Anbieter mit
          „Gratis“ haben ein kostenloses Kontingent.
        </p>

        <label className="field">
          <span>Anbieter</span>
          <select className="select" value={settings.provider} onChange={(e) => chooseProvider(e.target.value)}>
            {aiProviders.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.free ? ' · Gratis' : ''}
              </option>
            ))}
          </select>
        </label>

        {isCustom && (
          <label className="field">
            <span>Server-Adresse (OpenAI-kompatibel)</span>
            <input className="input" value={settings.baseUrl ?? ''} onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value })} />
            <small className="muted">Der Server muss vom Browser aus erreichbar sein (CORS erlaubt).</small>
          </label>
        )}

        <label className="field">
          <span>API-Key{isCustom ? ' (optional)' : ''}</span>
          <input
            className="input"
            type="password"
            autoComplete="off"
            placeholder="sk-…"
            value={settings.apiKey}
            onChange={(e) => setSettings({ ...settings, apiKey: e.target.value.trim() })}
          />
          {!isCustom && (
            <small>
              <a href={provider.keyUrl} target="_blank" rel="noreferrer">
                Key bei {provider.name} erstellen
              </a>
            </small>
          )}
        </label>

        <label className="field">
          <span>Modell</span>
          <input className="input" list="ai-models" value={settings.model} onChange={(e) => setSettings({ ...settings, model: e.target.value.trim() })} />
          <datalist id="ai-models">
            {models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>

        {status && <p className={status.ok ? 'small' : 'error'} style={status.ok ? { color: 'var(--good)' } : undefined}>{status.text}</p>}

        <div className="grid-2">
          {!isCustom && (
            <button className="btn secondary" onClick={loadModels} disabled={!settings.apiKey || busy}>
              Modelle laden
            </button>
          )}
          <button className="btn secondary" onClick={test} disabled={(!settings.apiKey && !isCustom) || !settings.model || busy} style={isCustom ? { gridColumn: 'span 2' } : undefined}>
            {busy ? <Spinner /> : 'Testen'}
          </button>
        </div>
        <button className="btn block" onClick={save} disabled={(!settings.apiKey && !isCustom) || !settings.model}>
          Speichern
        </button>
        {loadAiSettings() && (
          <button className="btn ghost block" onClick={turnOff}>
            KI ausschalten
          </button>
        )}
      </div>
    </Sheet>
  )
}
