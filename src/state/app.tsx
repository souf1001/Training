// Global app state: the logged-in user with profile, plan and settings.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, ApiError } from '../lib/api'
import { calcTargets } from '../lib/nutrition'
import { generatePlan } from '../lib/plan'
import type { NutritionTargets, Plan, Profile } from '../lib/types'

export type Theme = 'system' | 'light' | 'dark'

export interface Settings {
  theme?: Theme
}

export interface Me {
  email: string
  createdAt: string
  profile: Profile
  plan: Plan
  settings: Settings
}

interface AppState {
  me: Me | null
  loading: boolean
  targets: NutritionTargets | null
  refresh: () => Promise<void>
  saveProfile: (profile: Profile) => Promise<void>
  savePlan: (plan: Plan) => Promise<void>
  saveSettings: (settings: Settings) => Promise<void>
  logout: () => Promise<void>
}

export const DEFAULT_PROFILE: Profile = {
  sex: 'male',
  age: 30,
  heightCm: 178,
  weightKg: 80,
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
  'age',
]

export function cardioMinutes(plan: Plan | null): number {
  return plan?.days.reduce((sum, d) => sum + (d.cardio?.minutes ?? 0), 0) ?? 0
}

const AppContext = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<Me>('/me')
      // older accounts may miss newer profile fields
      const profile = { ...DEFAULT_PROFILE, ...data.profile }
      const plan = data.plan ?? generatePlan(profile)
      setMe({ ...data, profile, plan })
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) setMe(null)
      else throw error
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh().catch(() => setLoading(false))
  }, [refresh])

  // apply the chosen colour theme
  useEffect(() => {
    const theme = me?.settings.theme ?? 'system'
    if (theme === 'system') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = theme
  }, [me?.settings.theme])

  // When a training-related answer changes, the plan is rebuilt so it fits again.
  // Body weight or calories alone keep the current plan (and swapped exercises).
  const saveProfile = useCallback(
    async (profile: Profile) => {
      const changed = !me || PLAN_FIELDS.some((f) => JSON.stringify(me.profile[f]) !== JSON.stringify(profile[f]))
      const plan = changed || !me ? generatePlan(profile) : me.plan
      await api.put('/me', { profile, plan })
      setMe((m) => (m ? { ...m, profile, plan } : m))
    },
    [me],
  )

  const savePlan = useCallback(async (plan: Plan) => {
    await api.put('/me', { plan })
    setMe((m) => (m ? { ...m, plan } : m))
  }, [])

  const saveSettings = useCallback(async (settings: Settings) => {
    await api.put('/me', { settings })
    setMe((m) => (m ? { ...m, settings } : m))
  }, [])

  const logout = useCallback(async () => {
    await api.post('/auth/logout')
    setMe(null)
  }, [])

  const targets = useMemo(() => (me ? calcTargets(me.profile, cardioMinutes(me.plan)) : null), [me])

  return (
    <AppContext.Provider value={{ me, loading, targets, refresh, saveProfile, savePlan, saveSettings, logout }}>
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

// --- questionnaire draft (before registration) -------------------------------------

const DRAFT_KEY = 'forma.draft'

export function loadDraft(): Profile | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? { ...DEFAULT_PROFILE, ...JSON.parse(raw) } : null
  } catch {
    return null
  }
}

export function saveDraft(profile: Profile | null) {
  if (profile) localStorage.setItem(DRAFT_KEY, JSON.stringify(profile))
  else localStorage.removeItem(DRAFT_KEY)
}
