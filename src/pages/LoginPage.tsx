import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { signIn, signUp } from '../services/auth'
import { useAuth } from '../hooks/useAuth'
import { TextField } from '../components/Field'
import { PrimaryButton } from '../components/Buttons'

export function LoginPage() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  if (!loading && session) return <Navigate to="/" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setInfo('')
    try {
      if (mode === 'login') {
        await signIn(email, password)
        navigate('/')
      } else {
        await signUp(email, password, fullName)
        setInfo('Registrazione inviata: controlla la tua email per confermare l\'account.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore di autenticazione')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-center text-2xl font-bold text-indigo-700">VCuria</h1>
        <p className="mb-6 text-center text-sm text-slate-500">Gestionale corsi di formazione</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <TextField
              label="Nome e cognome"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          )}
          <TextField
            label="Email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label="Password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          {info && <p className="text-sm text-emerald-600">{info}</p>}
          <PrimaryButton type="submit" disabled={busy} className="w-full justify-center">
            {busy ? 'Attendere…' : mode === 'login' ? 'Accedi' : 'Registrati'}
          </PrimaryButton>
        </form>
        <button
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login')
            setError('')
            setInfo('')
          }}
          className="mt-4 w-full text-center text-xs text-indigo-600 hover:underline"
        >
          {mode === 'login' ? 'Non hai un account? Registrati' : 'Hai già un account? Accedi'}
        </button>
      </div>
    </div>
  )
}
