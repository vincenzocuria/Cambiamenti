import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { signOut } from '../services/auth'
import { SecondaryButton } from '../components/Buttons'
import { BrandLogo } from '../components/BrandLogo'
import { isPending } from '../lib/roles'

// Un utente registrato ma non ancora approvato dall'admin non vede alcun dato
export function PendingPage() {
  const { session, profile, loading } = useAuth()
  const navigate = useNavigate()

  if (loading) return null
  if (!session) return <Navigate to="/login" replace />
  if (profile && !isPending(profile.role)) return <Navigate to="/" replace />

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <BrandLogo size="md" className="mx-auto mb-4" />
        <h1 className="mb-2 text-xl font-bold text-slate-800">Account in attesa di approvazione</h1>
        <p className="mb-6 text-sm text-slate-500">
          Hai confermato l&apos;account: resta in attesa finché il superadmin non ti abilita
          dal pannello Utenti. Fino ad allora non puoi vedere i dati della scuola.
        </p>
        <SecondaryButton
          onClick={async () => {
            await signOut()
            navigate('/login')
          }}
        >
          Esci
        </SecondaryButton>
      </div>
    </div>
  )
}
