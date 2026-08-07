import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { isPending, isAdmin } from '../lib/roles'

// Blocca l'accesso: richiede sessione valida e ruolo abilitato
export function Protected({
  children,
  adminOnly = false,
}: {
  children: ReactNode
  adminOnly?: boolean
}) {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-400">
        Caricamento…
      </div>
    )
  }
  if (!session) return <Navigate to="/login" replace />
  if (isPending(profile?.role)) return <Navigate to="/in-attesa" replace />
  if (adminOnly && !isAdmin(profile?.role)) return <Navigate to="/" replace />
  return <>{children}</>
}
