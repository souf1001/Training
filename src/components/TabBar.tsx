import { NavLink } from 'react-router-dom'
import { CalendarDays, ChartLine, House, User, Utensils } from 'lucide-react'

const TABS = [
  { to: '/heute', label: 'Heute', icon: House },
  { to: '/plan', label: 'Plan', icon: CalendarDays },
  { to: '/essen', label: 'Essen', icon: Utensils },
  { to: '/fortschritt', label: 'Fortschritt', icon: ChartLine },
  { to: '/profil', label: 'Profil', icon: User },
]

export function TabBar() {
  return (
    <div className="tabbar">
      <nav>
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon size={24} strokeWidth={2} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
