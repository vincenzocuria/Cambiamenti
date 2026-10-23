import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { signOut } from '../services/auth'
import { isAdmin, roleLabels } from '../lib/roles'
import { BrandLogo } from './BrandLogo'
import { NotificationBell } from './NotificationBell'
import { NavIcon, type NavIconName } from './NavIcon'
import { school } from '../data/school'

type NavItem = { to: string; label: string; icon: NavIconName; end?: boolean; adminOnly?: boolean }
type NavGroup = { title?: string; items: NavItem[] }

const groups: NavGroup[] = [
  { items: [{ to: '/', label: 'Dashboard', icon: 'dashboard', end: true }] },
  {
    title: 'Didattica',
    items: [
      { to: '/corsi', label: 'Corsi', icon: 'courses' },
      { to: '/alunni', label: 'Alunni', icon: 'students' },
      { to: '/personale', label: 'Personale', icon: 'staff' },
      { to: '/eipass', label: 'EIPASS privato', icon: 'eipass' },
      { to: '/import/jforma', label: 'Import JForma', icon: 'import' },
    ],
  },
  {
    title: 'Amministrazione',
    items: [
      { to: '/pagamenti', label: 'Pagamenti', icon: 'payments' },
      { to: '/fatturazione', label: 'Fatturazione', icon: 'invoices' },
      { to: '/template', label: 'Template', icon: 'templates' },
      { to: '/utenti', label: 'Utenti', icon: 'users', adminOnly: true },
    ],
  },
]

function Brand() {
  return (
    <NavLink to="/" className="flex min-w-0 items-center gap-2.5">
      <BrandLogo size="sm" className="shrink-0" />
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-sm font-semibold text-slate-900">{school.shortName}</span>
        <span className="block text-[11px] text-slate-500">Formazione</span>
      </span>
    </NavLink>
  )
}

function initials(email: string | null | undefined): string {
  const name = (email ?? '').split('@')[0].replace(/[^a-zA-Z]/g, '')
  return (name.slice(0, 2) || '?').toUpperCase()
}

export function Layout({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const admin = isAdmin(profile?.role)

  // Chiude il menu mobile quando si cambia pagina o si preme Esc.
  useEffect(() => setMenuOpen(false), [location.pathname])
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    // Se la finestra si allarga fino alla barra laterale, il menu mobile si chiude e sblocca lo scorrimento.
    const desktop = window.matchMedia('(min-width: 64rem)') // uguale al breakpoint lg di Tailwind
    const onResize = () => desktop.matches && setMenuOpen(false)
    onResize()
    desktop.addEventListener('change', onResize)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      desktop.removeEventListener('change', onResize)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  const nav = (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Menu principale">
      {groups.map((g, i) => {
        const items = g.items.filter((it) => !it.adminOnly || admin)
        if (items.length === 0) return null
        return (
          <div key={g.title ?? i}>
            {g.title && (
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {g.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {items.map((it) => (
                <li key={it.to}>
                  <NavLink
                    to={it.to}
                    end={it.end}
                    className={({ isActive }) =>
                      'group relative flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ' +
                      (isActive
                        ? 'bg-indigo-50 text-indigo-700 before:absolute before:inset-y-1.5 before:left-0 before:w-1 before:rounded-full before:bg-indigo-600'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900')
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <NavIcon
                          name={it.icon}
                          className={
                            'h-5 w-5 shrink-0 ' +
                            (isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600')
                          }
                        />
                        {it.label}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </nav>
  )

  const userBox = (
    <div className="border-t border-slate-200 p-3">
      <div className="flex items-center gap-3 rounded-lg px-2 py-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
          {initials(profile?.email)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800" title={profile?.email ?? ''}>
            {profile?.email}
          </p>
          {profile?.role && <p className="text-xs text-slate-500">{roleLabels[profile.role]}</p>}
        </div>
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
          title="Esci"
          aria-label="Esci"
        >
          <NavIcon name="logout" className="h-5 w-5" />
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Barra laterale fissa su schermi larghi */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 items-center justify-between gap-2 border-b border-slate-200 px-4">
          <Brand />
          <NotificationBell align="left" />
        </div>
        {nav}
        {userBox}
      </aside>

      {/* Barra superiore e menu a scomparsa su tablet e telefono */}
      <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-3 lg:hidden">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
          aria-label="Apri menu"
          aria-expanded={menuOpen}
        >
          <NavIcon name="menu" className="h-6 w-6" />
        </button>
        <Brand />
        <NotificationBell />
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMenuOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
              <Brand />
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Chiudi menu"
              >
                <NavIcon name="close" className="h-5 w-5" />
              </button>
            </div>
            {nav}
            {userBox}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </div>
    </div>
  )
}
