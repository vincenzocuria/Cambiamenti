import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { signOut } from '../services/auth'
import { isAdmin } from '../lib/roles'
import { BrandLogo } from './BrandLogo'
import { NotificationBell } from './NotificationBell'

const links = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/corsi', label: 'Corsi' },
  { to: '/alunni', label: 'Alunni' },
  { to: '/personale', label: 'Personale' },
  { to: '/template', label: 'Template' },
]

export function Layout({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-8">
            <BrandLogo size="sm" />
            <nav className="flex gap-1">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) =>
                    'rounded-lg px-3 py-1.5 text-sm font-medium ' +
                    (isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:bg-slate-100')
                  }
                >
                  {l.label}
                </NavLink>
              ))}
              {isAdmin(profile?.role) && (
                <NavLink
                  to="/utenti"
                  className={({ isActive }) =>
                    'rounded-lg px-3 py-1.5 text-sm font-medium ' +
                    (isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:bg-slate-100')
                  }
                >
                  Utenti
                </NavLink>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <span className="text-xs text-slate-500">{profile?.email}</span>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              Esci
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  )
}
