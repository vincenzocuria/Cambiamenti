import { useCallback, useEffect, useRef, useState } from 'react'
import {
  agentOnline,
  getArubaAgent,
  listArubaSyncRequests,
  requestArubaSync,
  type ArubaAgent,
  type ArubaSyncRequest,
} from '../services/arubaSync'
import { PrimaryButton } from './Buttons'

function when(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })
}

function ago(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 90) return `${s} s fa`
  const m = Math.round(s / 60)
  if (m < 90) return `${m} min fa`
  const h = Math.round(m / 60)
  return h < 48 ? `${h} ore fa` : `${Math.round(h / 24)} giorni fa`
}

/**
 * Tasto «Sincronizza con Aruba»: la richiesta la esegue il servizio sul PC (Aruba non si apre
 * dal server). Mostra se il PC è collegato, l'avanzamento e l'esito dell'ultima sincronizzazione.
 */
export function ArubaSyncPanel({ years, onSynced }: { years: number[]; onSynced: () => void }) {
  const [agent, setAgent] = useState<ArubaAgent | null>(null)
  const [requests, setRequests] = useState<ArubaSyncRequest[]>([])
  const [error, setError] = useState('')
  const [showLog, setShowLog] = useState(false)
  const [, tick] = useState(0)
  const wasActive = useRef(false)

  const refresh = useCallback(async () => {
    try {
      const [a, r] = await Promise.all([getArubaAgent(), listArubaSyncRequests()])
      setAgent(a)
      setRequests(r)
      // Appena una richiesta in corso finisce, ricarico le fatture
      const nowActive = r.some((p) => p.status === 'pending' || p.status === 'running')
      if (wasActive.current && !nowActive) onSynced()
      wasActive.current = nowActive
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stato della sincronizzazione non letto')
    }
  }, [onSynced])

  const active = requests.find((r) => r.status === 'pending' || r.status === 'running')
  const last = requests.find((r) => r.status === 'done' || r.status === 'error')
  const online = agentOnline(agent)

  useEffect(() => {
    void refresh()
    const id = window.setInterval(() => {
      void refresh()
      tick((n) => n + 1)
    }, active ? 4000 : 30000)
    return () => window.clearInterval(id)
  }, [refresh, active])

  async function handleSync() {
    setError('')
    try {
      const req = await requestArubaSync(years)
      wasActive.current = true
      setRequests((r) => [req, ...r])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Richiesta non inviata')
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="flex items-center gap-2 font-medium text-slate-700">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-slate-300'}`}
              aria-hidden="true"
            />
            {online
              ? `PC collegato ad Aruba${agent?.busy ? ' · sta sincronizzando' : ''}`
              : agent
                ? `PC non collegato (ultimo segnale ${ago(agent.last_seen_at)})`
                : 'Servizio Aruba non ancora acceso sul PC'}
          </p>
          {active ? (
            <p className="text-indigo-700">
              {active.status === 'pending'
                ? online
                  ? 'Richiesta inviata: il PC la prende tra pochi secondi…'
                  : 'Richiesta in attesa: parte appena il PC è acceso con il servizio attivo.'
                : `Sincronizzazione in corso sul PC (${active.years.join(', ')})…`}
            </p>
          ) : last ? (
            <p className={last.status === 'error' ? 'text-red-600' : 'text-slate-500'}>
              Ultima sincronizzazione {when(last.finished_at)}
              {last.source === 'auto' ? ' (automatica)' : ''}: {last.status === 'error' ? 'errore · ' : ''}
              {last.message || 'finita'}
            </p>
          ) : (
            <p className="text-slate-500">Nessuna sincronizzazione dal gestionale finora.</p>
          )}
          {last && last.log.length > 0 && !active && (
            <button
              type="button"
              className="text-xs font-medium text-indigo-600 hover:underline"
              onClick={() => setShowLog((v) => !v)}
            >
              {showLog ? 'Nascondi dettagli' : 'Dettagli'}
            </button>
          )}
        </div>
        <PrimaryButton disabled={!!active} onClick={() => void handleSync()}>
          {active ? 'Sincronizzazione…' : 'Sincronizza con Aruba'}
        </PrimaryButton>
      </div>
      {showLog && last && !active && (
        <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
          {last.log.join('\n')}
        </pre>
      )}
      {!online && !agent && (
        <p className="mt-2 text-xs text-slate-400">
          Sul PC: npm run aruba -- installa-servizio (una volta sola), poi parte da solo a ogni accensione.
        </p>
      )}
      {error && <p className="mt-2 text-red-600">{error}</p>}
    </div>
  )
}
