// Global app state: the logged-in user with profile, plan and settings.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, ApiError, UNAUTHORIZED_EVENT } from '../lib/api'
import { calcTargets } from '../lib/nutrition'
import { generatePlan, weeklyLoad } from '../lib/plan'
import { applyTheme } from '../lib/theme'
import { readJson, removeKeys, writeJson } from '../lib/storage'
import type { Me, NutritionTargets, Plan, Profile, Settings, Workout } from '../lib/types'

interface AppState {
  me: Me | null
  loading: boolean
  // true when the server can't be reached and we show the last known data
  offline: boolean
  targets: NutritionTargets | null
  refresh: () => Promise<void>
  saveProfile: (profile: Profile) => Promise<void>
  savePlan: (plan: Plan) => Promise<void>
  saveSettings: (settings: Settings) => Promise<void>
  logout: () => Promise<void>
}

export const DEFAULT_PROFILE: Profile = {
  sex: 'female',
  age: 30,
  heightCm: 172,
  weightKg: 70,
  activity: 'light',
  goal: 'recomp',
  experience: 'beginner',
  trainingDays: [0, 2, 4],
  sessionMinutes: 60,
  location: 'gym',
  equipment: [],
  cardioLevel: 'medium',
  cardioTypes: ['walk'],
  dietStyle: 'highProtein',
  kcalOverride: null,
}

// profile answers the training plan depends on
const PLAN_FIELDS: (keyof Profile)[] = [
  'goal',
  'experience',
  'trainingDays',
  'sessionMinutes',
  'location',
  'equipment',
  'cardioLevel',
  'cardioTypes',
  'age', // the heart rate zone in the cardio notes
]

// Would these profile changes create a new plan (and reset swapped exercises)?
export function changesPlan(before: Profile, after: Profile): boolean {
  return PLAN_FIELDS.some((f) => JSON.stringify(before[f]) !== JSON.stringify(after[f]))
}

const ME_KEY = 'forma.me'
const OUTBOX_KEY = 'forma.outbox'

// Workouts finished without internet wait here and are sent later.
export function queueWorkout(workout: Workout) {
  writeJson(OUTBOX_KEY, [...(readJson<Workout[]>(OUTBOX_KEY) ?? []), workout])
}

async function sendQueuedWorkouts() {
  const queued = readJson<Workout[]>(OUTBOX_KEY) ?? []
  for (const workout of queued) {
    await api.post('/workouts', workout)
    writeJson(OUTBOX_KEY, (readJson<Workout[]>(OUTBOX_KEY) ?? []).slice(1))
  }
}

const AppContext = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [me, setMeState] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)

  // keep a copy on the device, so the app also opens without internet (e.g. in the gym)
  const setMe = useCallback((update: Me | null | ((m: Me | null) => Me | null)) => {
    setMeState((current) => {
      const next = typeof update === 'function' ? update(current) : update
      writeJson(ME_KEY, next)
      return next
    })
  }, [])

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<Me>('/me')
      // older accounts may miss newer profile fields
      const profile = { ...DEFAULT_PROFILE, ...data.profile }
      setMe({ ...data, profile, plan: data.plan ?? generatePlan(profile) })
      setOffline(false)
      sendQueuedWorkouts().catch(() => {})
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setMe(null)
      } else {
        // no connection or server error: continue with the last known data
        const cached = readJson<Me>(ME_KEY)
        if (cached) setMeState(cached)
        setOffline(true)
      }
    } finally {
      setLoading(false)
    }
  }, [setMe])

  useEffect(() => {
    refresh()
    const onOnline = () => refresh()
    const onUnauthorized = () => setMe(null)
    window.addEventListener('online', onOnline)
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    }
  }, [refresh, setMe])

  useEffect(() => {
    if (me?.settings.theme) applyTheme(me.settings.theme)
  }, [me?.settings.theme])

  // When a training-related answer changes, the plan is rebuilt so it fits again.
  // Body weight or calories alone keep the current plan (and swapped exercises).
  const saveProfile = useCallback(
    async (profile: Profile) => {
      const plan = !me || changesPlan(me.profile, profile) ? generatePlan(profile) : me.plan
      await api.put('/me', { profile, plan })
      setMe((m) => (m ? { ...m, profile, plan } : m))
    },
    [me, setMe],
  )

  const savePlan = useCallback(
    async (plan: Plan) => {
      await api.put('/me', { plan })
      setMe((m) => (m ? { ...m, plan } : m))
    },
    [setMe],
  )

  const saveSettings = useCallback(
    async (settings: Settings) => {
      await api.put('/me', { settings })
      setMe((m) => (m ? { ...m, settings } : m))
    },
    [setMe],
  )

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => {})
    clearLocalData()
    setMe(null)
  }, [setMe])

  const targets = useMemo(() => (me ? calcTargets(me.profile, weeklyLoad(me.plan)) : null), [me])

  return (
    <AppContext.Provider value={{ me, loading, offline, targets, refresh, saveProfile, savePlan, saveSettings, logout }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp(): AppState {
  const state = useContext(AppContext)
  if (!state) throw new Error('useApp must be used inside <AppProvider>')
  return state
}

// Logged-in pages can rely on `me` being there.
export function useMe() {
  const state = useApp()
  if (!state.me || !state.targets) throw new Error('useMe needs a logged-in user')
  return { ...state, me: state.me, targets: state.targets }
}

// Removes the personal data this app stored on the device (AI key, cached profile,
// running workout, draft), so the next person on a shared phone doesn't get it.
export function clearLocalData() {
  removeKeys((key) => key.startsWith('forma.') && key !== 'forma.theme')
}

// --- questionnaire draft (before registration) -------------------------------------

const DRAFT_KEY = 'forma.draft'

export function loadDraft(): Profile | null {
  const draft = readJson<Partial<Profile>>(DRAFT_KEY)
  return draft ? { ...DEFAULT_PROFILE, ...draft } : null
}

export function saveDraft(profile: Profile | null) {
  writeJson(DRAFT_KEY, profile)
}
