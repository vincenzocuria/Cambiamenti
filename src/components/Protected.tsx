import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

// Blocca l'accesso: richiede sessione valida e ruolo staff/admin
export function Protected({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-400">
        Caricamento…
      </div>
    )
  }
  if (!session) return <Navigate to="/login" replace />
  if (!profile || profile.role === 'pending') return <Navigate to="/in-attesa" replace />
  return <>{children}</>
}
