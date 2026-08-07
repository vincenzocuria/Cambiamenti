import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { requestPasswordReset, signIn, signUp } from '../services/auth'
import { useAuth } from '../hooks/useAuth'
import { TextField } from '../components/Field'
import { PasswordField } from '../components/PasswordField'
import { PrimaryButton } from '../components/Buttons'
import { BrandLogo } from '../components/BrandLogo'
import { school } from '../data/school'

type Mode = 'login' | 'signup' | 'forgot'

export function LoginPage() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  if (!loading && session && mode !== 'forgot') return <Navigate to="/" replace />

  function switchMode(next: Mode) {
    setMode(next)
    setError('')
    setInfo('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setInfo('')
    try {
      if (mode === 'login') {
        await signIn(email, password)
        navigate('/')
      } else if (mode === 'signup') {
        await signUp(email, password, fullName)
        setInfo('Registrazione inviata: controlla la tua email per confermare l\'account.')
      } else {
        await requestPasswordReset(email)
        setInfo('Se l\'email è registrata, riceverai un link per reimpostare la password.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore di autenticazione')
    } finally {
      setBusy(false)
    }
  }

  const submitLabel =
    mode === 'forgot' ? 'Invia link di recupero' : mode === 'login' ? 'Accedi' : 'Registrati'

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <BrandLogo size="lg" />
          <p className="text-center text-sm text-slate-500">
            {mode === 'forgot' ? 'Ti invieremo un link via email' : school.name}
          </p>
        </div>
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
          {mode !== 'forgot' && (
            <PasswordField
              label="Password"
              required
              minLength={8}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
          {mode === 'login' && (
            <div className="-mt-2 text-right">
              <button
                type="button"
                onClick={() => switchMode('forgot')}
                className="text-xs text-indigo-600 hover:underline"
              >
                Password dimenticata?
              </button>
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {info && <p className="text-sm text-emerald-600">{info}</p>}
          <PrimaryButton type="submit" disabled={busy} className="w-full justify-center">
            {busy ? 'Attendere…' : submitLabel}
          </PrimaryButton>
        </form>
        {mode === 'forgot' ? (
          <button
            type="button"
            onClick={() => switchMode('login')}
            className="mt-4 w-full text-center text-xs text-indigo-600 hover:underline"
          >
            Torna al login
          </button>
        ) : (
          <button
            type="button"
            onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
            className="mt-4 w-full text-center text-xs text-indigo-600 hover:underline"
          >
            {mode === 'login' ? 'Non hai un account? Registrati' : 'Hai già un account? Accedi'}
          </button>
        )}
      </div>
    </div>
  )
}
