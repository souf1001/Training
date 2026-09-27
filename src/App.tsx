import { Component, lazy, Suspense, useEffect, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useApp } from './state/app'
import { TabBar } from './components/TabBar'
import { Spinner } from './components/ui'
import { WelcomePage } from './pages/WelcomePage'
import { TodayPage } from './pages/TodayPage'

// Pages are loaded when they are first opened, so the app starts faster.
// The service worker keeps them all cached for offline use.
const OnboardingPage = lazy(() => import('./pages/OnboardingPage').then((m) => ({ default: m.OnboardingPage })))
const ResultPage = lazy(() => import('./pages/ResultPage').then((m) => ({ default: m.ResultPage })))
const AuthPage = lazy(() => import('./pages/AuthPage').then((m) => ({ default: m.AuthPage })))
const PlanPage = lazy(() => import('./pages/PlanPage').then((m) => ({ default: m.PlanPage })))
const DayPage = lazy(() => import('./pages/DayPage').then((m) => ({ default: m.DayPage })))
const WorkoutPage = lazy(() => import('./pages/WorkoutPage').then((m) => ({ default: m.WorkoutPage })))
const ExercisePage = lazy(() => import('./pages/ExercisePage').then((m) => ({ default: m.ExercisePage })))
const FoodPage = lazy(() => import('./pages/FoodPage').then((m) => ({ default: m.FoodPage })))
const ProgressPage = lazy(() => import('./pages/ProgressPage').then((m) => ({ default: m.ProgressPage })))
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })))

// title of the browser tab / for screen readers
const TITLES: Record<string, string> = {
  heute: 'Heute',
  plan: 'Plan',
  training: 'Training',
  uebung: 'Übung',
  essen: 'Essen',
  fortschritt: 'Fortschritt',
  profil: 'Profil',
  start: 'Profil-Check',
  ergebnis: 'Dein Ergebnis',
  registrieren: 'Konto erstellen',
  login: 'Einloggen',
}

// pages that show the bottom tab bar
const TAB_PAGES = ['/heute', '/plan', '/essen', '/fortschritt', '/profil']

const loadingScreen = (
  <div className="center-screen">
    <Spinner />
  </div>
)

export function App() {
  const { me, loading, offline } = useApp()
  const { pathname } = useLocation()

  useEffect(() => {
    const page = TITLES[pathname.split('/')[1]]
    document.title = page ? `${page} · Forma` : 'Forma – Training & Ernährung'
  }, [pathname])

  if (loading) return loadingScreen

  if (!me) {
    return (
      <div className="app">
        <ErrorBoundary>
          <Suspense fallback={loadingScreen}>
            <Routes>
              <Route path="/" element={<WelcomePage />} />
              <Route path="/start" element={<OnboardingPage />} />
              <Route path="/ergebnis" element={<ResultPage />} />
              <Route path="/registrieren" element={<AuthPage mode="register" />} />
              <Route path="/login" element={<AuthPage mode="login" />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </div>
    )
  }

  const showTabs = TAB_PAGES.some((p) => pathname === p || (p === '/plan' && pathname.startsWith('/plan/')))

  return (
    <div className="app">
      {offline && <div className="offline-banner">Offline – Änderungen werden gespeichert, sobald du wieder online bist</div>}
      <ErrorBoundary key={pathname}>
        <Suspense fallback={loadingScreen}>
          <Routes>
            <Route path="/heute" element={<TodayPage />} />
            <Route path="/plan" element={<PlanPage />} />
            <Route path="/plan/:weekday" element={<DayPage />} />
            <Route path="/training/:weekday" element={<WorkoutPage />} />
            <Route path="/uebung/:id" element={<ExercisePage />} />
            <Route path="/essen" element={<FoodPage />} />
            <Route path="/fortschritt" element={<ProgressPage />} />
            <Route path="/profil" element={<ProfilePage />} />
            <Route path="*" element={<Navigate to="/heute" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
      {showTabs && <TabBar />}
    </div>
  )
}

// Shows a friendly message instead of a white screen if a page crashes.
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="center-screen" style={{ flexDirection: 'column', gap: 16, padding: 24, textAlign: 'center' }}>
        <p>Hier ist etwas schiefgelaufen.</p>
        <button className="btn" onClick={() => window.location.reload()}>
          Neu laden
        </button>
      </div>
    )
  }
}
