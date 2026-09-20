import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { updatePassword } from '../services/auth'
import { passwordError } from '../lib/passwordRules'
import { PasswordField } from '../components/PasswordField'
import { PrimaryButton } from '../components/Buttons'
import { BrandLogo } from '../components/BrandLogo'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [allowed, setAllowed] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setAllowed(Boolean(data.session))
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setAllowed(true)
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const issue = passwordError(password, confirm)
    if (issue) {
      setError(issue)
      return
    }
    setBusy(true)
    setError('')
    setInfo('')
    try {
      await updatePassword(password)
      setInfo('Password aggiornata. Ora puoi accedere.')
      setTimeout(() => navigate('/login', { replace: true }), 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossibile aggiornare la password')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <BrandLogo size="lg" />
          <p className="text-center text-sm text-slate-500">Imposta la tua password</p>
        </div>

        {!ready ? (
          <p className="text-center text-sm text-slate-500">Caricamento…</p>
        ) : !allowed ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-slate-600">
              Link non valido o scaduto. Richiedi un nuovo recupero password.
            </p>
            <Link to="/login" className="text-xs text-indigo-600 hover:underline">
              Torna al login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <PasswordField
              label="Nuova password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <PasswordField
              label="Conferma password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            {info && <p className="text-sm text-emerald-600">{info}</p>}
            <PrimaryButton type="submit" disabled={busy} className="w-full justify-center">
              {busy ? 'Attendere…' : 'Salva nuova password'}
            </PrimaryButton>
          </form>
        )}
      </div>
    </div>
  )
}
