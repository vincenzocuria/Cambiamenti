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
  const [birthDate, setBirthDate] = useState('')
  const [isUnder14, setIsUnder14] = useState(false)
  const [parentalName, setParentalName] = useState('')
  const [parentalContact, setParentalContact] = useState('')
  const [parentalConsent, setParentalConsent] = useState(false)
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
        if (isUnder14 && (!parentalConsent || !parentalName || !parentalContact)) {
          setError('Per i minori di 14 anni è richiesto il consenso di un genitore/tutore.')
          setBusy(false)
          return
        }
        await signUp(email, password, fullName, {
          birthDate: birthDate || null,
          isUnder14,
          parentalConsentGiven: isUnder14 ? parentalConsent : null,
          parentalGuardianName: isUnder14 ? parentalName : null,
          parentalGuardianContact: isUnder14 ? parentalContact : null,
        })
        setInfo(
          'Registrazione inviata: conferma l\'email, poi attendi l\'approvazione di un amministratore.',
        )
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
            <>
              <TextField
                label="Nome e cognome"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
              <div className="space-y-2">
                <TextField
                  label="Data di nascita (opzionale)"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                />
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isUnder14}
                    onChange={(e) => setIsUnder14(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span className="text-slate-700">Ho meno di 14 anni</span>
                </label>
              </div>
              {isUnder14 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-3">
                  <p className="text-xs text-amber-900 font-medium">
                    Per i minori di 14 anni è richiesto il consenso di un genitore o tutore per il
                    trattamento dei dati personali.
                  </p>
                  <TextField
                    label="Nome del genitore/tutore"
                    required={isUnder14}
                    value={parentalName}
                    onChange={(e) => setParentalName(e.target.value)}
                  />
                  <TextField
                    label="Email o telefono del genitore/tutore"
                    required={isUnder14}
                    value={parentalContact}
                    onChange={(e) => setParentalContact(e.target.value)}
                  />
                  <label className="flex items-start gap-2 text-xs">
                    <input
                      type="checkbox"
                      required={isUnder14}
                      checked={parentalConsent}
                      onChange={(e) => setParentalConsent(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span className="text-slate-700">
                      Come genitore/tutore, autorizzo il trattamento dei dati personali del minore
                      secondo l'
                      <a
                        href="/privacy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:underline"
                      >
                        informativa privacy
                      </a>
                      .
                    </span>
                  </label>
                </div>
              )}
              <p className="text-xs text-slate-500">
                Dopo la conferma email il tuo accesso resterà in attesa finché un amministratore
                non ti abilita.
              </p>
            </>
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
