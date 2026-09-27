// Data loading and other small hooks for the pages.
import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import { addDays, startOfDay } from './dates'
import type { FoodEntry, WeightEntry, Workout } from './types'

function useLoad<T>(load: () => Promise<T>, initial: T) {
  const [data, setData] = useState<T>(initial)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)

  useEffect(() => {
    // ignore answers that arrive after the user already moved on (e.g. tapped to the next day)
    let current = true
    setLoading(true)
    load()
      .then((result) => {
        if (!current) return
        setData(result)
        setError('')
      })
      .catch((err: Error) => current && setError(err.message))
      .finally(() => current && setLoading(false))
    return () => {
      current = false
    }
  }, [load, version])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  return { data, loading, error, reload }
}

// food entries between two dates (end exclusive)
export function useFood(from: Date, days = 1) {
  const fromIso = startOfDay(from).toISOString()
  const toIso = addDays(startOfDay(from), days).toISOString()
  const load = useCallback(() => api.get<FoodEntry[]>(`/food?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`), [fromIso, toIso])
  return useLoad(load, [])
}

export function useWorkouts(limit = 50) {
  const load = useCallback(() => api.get<Workout[]>(`/workouts?limit=${limit}`), [limit])
  return useLoad(load, [])
}

export function useWorkoutCount() {
  const load = useCallback(() => api.get<{ total: number }>('/workouts/count').then((r) => r.total), [])
  return useLoad(load, 0)
}

export function useWeights() {
  const load = useCallback(() => api.get<WeightEntry[]>('/weights'), [])
  return useLoad(load, [])
}

// Runs an async action with a busy flag and a readable error message,
// so buttons never hang and errors are shown instead of swallowed.
export function useAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const run = useCallback(async (action: () => Promise<unknown>): Promise<boolean> => {
    setBusy(true)
    setError('')
    try {
      await action()
      return true
    } catch (err) {
      setError((err as Error).message)
      return false
    } finally {
      setBusy(false)
    }
  }, [])

  return { busy, error, run, setError }
}

// Speech to text with the browser's built-in speech recognition (Chrome, Safari).
export function useSpeech(onText: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const Recognition =
    typeof window !== 'undefined'
      ? ((window as unknown as Record<string, unknown>).SpeechRecognition ?? (window as unknown as Record<string, unknown>).webkitSpeechRecognition)
      : undefined

  const start = useCallback(() => {
    if (!Recognition) return
    const recognition = new (Recognition as new () => SpeechRecognitionLike)()
    recognition.lang = 'de-DE'
    recognition.interimResults = false
    recognition.onresult = (event) => onText(event.results[0][0].transcript)
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)
    recognition.start()
    setListening(true)
  }, [Recognition, onText])

  return { supported: Boolean(Recognition), listening, start }
}

interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  onresult: (event: { results: { transcript: string }[][] }) => void
  onend: () => void
  onerror: () => void
  start: () => void
}
