import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useApp } from './state/app'
import { TabBar } from './components/TabBar'
import { Spinner } from './components/ui'
import { Welcome } from './pages/Welcome'
import { Onboarding } from './pages/Onboarding'
import { Result } from './pages/Result'
import { Auth } from './pages/Auth'
import { Today } from './pages/Today'
import { PlanPage } from './pages/PlanPage'
import { DayPage } from './pages/DayPage'
import { WorkoutPage } from './pages/WorkoutPage'
import { ExercisePage } from './pages/ExercisePage'
import { FoodPage } from './pages/FoodPage'
import { ProgressPage } from './pages/ProgressPage'
import { ProfilePage } from './pages/ProfilePage'

// pages that show the bottom tab bar
const TAB_PAGES = ['/heute', '/plan', '/essen', '/fortschritt', '/profil']

export function App() {
  const { me, loading } = useApp()
  const { pathname } = useLocation()

  if (loading) {
    return (
      <div className="center-screen">
        <Spinner />
      </div>
    )
  }

  if (!me) {
    return (
      <div className="app">
        <Routes>
          <Route path="/" element={<Welcome />} />
          <Route path="/start" element={<Onboarding />} />
          <Route path="/ergebnis" element={<Result />} />
          <Route path="/registrieren" element={<Auth mode="register" />} />
          <Route path="/login" element={<Auth mode="login" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    )
  }

  const showTabs = TAB_PAGES.some((p) => pathname === p || (p === '/plan' && pathname.startsWith('/plan/')))

  return (
    <div className="app">
      <Routes>
        <Route path="/heute" element={<Today />} />
        <Route path="/plan" element={<PlanPage />} />
        <Route path="/plan/:weekday" element={<DayPage />} />
        <Route path="/training/:weekday" element={<WorkoutPage />} />
        <Route path="/uebung/:id" element={<ExercisePage />} />
        <Route path="/essen" element={<FoodPage />} />
        <Route path="/fortschritt" element={<ProgressPage />} />
        <Route path="/profil" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/heute" replace />} />
      </Routes>
      {showTabs && <TabBar />}
    </div>
  )
}
