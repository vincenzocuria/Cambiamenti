import { romeToUtcMs } from '../../supabase/functions/sync-fad-attendance/romeTime.ts'
import type {
  Course,
  FadAttendanceStatus,
  FadClosedSource,
  FadExitSource,
  FadLogEventRow,
} from '../types/db'
import type { FadSessionWithRows } from '../services/fadAttendance'

export const statusLabels: Record<FadAttendanceStatus, string> = {
  fino_chiusura: 'Collegato fino alla chiusura',
  uscito_prima: 'Uscito prima della chiusura',
  assente: 'Assente',
  da_verificare: 'Da verificare',
}

export const statusTone: Record<FadAttendanceStatus, string> = {
  fino_chiusura: 'bg-emerald-50 text-emerald-700',
  uscito_prima: 'bg-red-50 text-red-700',
  assente: 'bg-slate-100 text-slate-500',
  da_verificare: 'bg-amber-50 text-amber-800',
}

export const closedSourceLabels: Record<FadClosedSource, string> = {
  registrata: 'Registrata su Moodle',
  ricostruita: 'Ricostruita dai log',
  manuale: 'Inserita a mano',
  non_determinabile: 'Non determinabile',
}

export const exitSourceLabels: Record<FadExitSource, string> = {
  '': '—',
  log: 'Uscita registrata',
  chiusura: 'Chiusura aula',
  manuale: 'Inserita a mano',
}

/** Ora (HH:MM:SS) di un istante, nel fuso di Roma. */
export function romeTime(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso))
}

/** Istante ISO da giorno (AAAA-MM-GG) e ora locale (HH:MM o HH:MM:SS). Vuoto se l'ora non è valida. */
export function romeIso(day: string, time: string): string | null {
  const d = day.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const t = time.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!d || !t) return null
  const h = Number(t[1])
  const m = Number(t[2])
  const s = Number(t[3] ?? 0)
  if (h > 23 || m > 59 || s > 59) return null
  return new Date(romeToUtcMs(Number(d[1]), Number(d[2]), Number(d[3]), h, m, s)).toISOString()
}

export function itDate(day: string): string {
  const [y, m, d] = day.split('-')
  return `${d}/${m}/${y}`
}

export interface FadTotals {
  days: number
  fino: number
  prima: number
  verificare: number
  assenti: number
}

export function fadTotals(sessions: FadSessionWithRows[]): FadTotals {
  const t: FadTotals = { days: sessions.length, fino: 0, prima: 0, verificare: 0, assenti: 0 }
  for (const s of sessions) {
    for (const r of s.rows) {
      if (r.status === 'fino_chiusura') t.fino++
      else if (r.status === 'uscito_prima') t.prima++
      else if (r.status === 'da_verificare') t.verificare++
      else t.assenti++
    }
  }
  return t
}

export interface FadPeriod {
  from: string
  to: string
}

/** Giornate da esportare: escluse quelle segnate come non FAD e quelle fuori dal periodo scelto. */
export function exportableSessions(sessions: FadSessionWithRows[], period: FadPeriod = { from: '', to: '' }) {
  return sessions.filter(
    (s) => !s.excluded && (!period.from || s.day >= period.from) && (!period.to || s.day <= period.to),
  )
}

/** Testo del periodo coperto da un'esportazione, es. «dal 04/03/2026 al 08/04/2026». */
export function periodText(sessions: FadSessionWithRows[]): string {
  if (!sessions.length) return ''
  const days = sessions.map((s) => s.day).sort()
  const first = days[0]
  const last = days[days.length - 1]
  return first === last ? `del ${itDate(first)}` : `dal ${itDate(first)} al ${itDate(last)}`
}

/** Eventi del log che cadono nelle giornate esportate. */
export function eventsForSessions(events: FadLogEventRow[], sessions: FadSessionWithRows[]): FadLogEventRow[] {
  const days = new Set(sessions.map((s) => s.day))
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' })
  return events.filter((e) => days.has(fmt.format(new Date(e.occurred_at))))
}

export function studentName(r: FadSessionWithRows['rows'][number]): string {
  return r.student ? `${r.student.last_name} ${r.student.first_name}`.trim() : r.moodle_name
}

export function sortedRows(rows: FadSessionWithRows['rows']): FadSessionWithRows['rows'] {
  return [...rows].sort((a, b) => studentName(a).localeCompare(studentName(b), 'it'))
}

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v)
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** CSV per Excel (separatore ;) con una riga per giornata e alunno. */
export function attendanceCsv(sessions: FadSessionWithRows[]): string {
  const head = [
    'Data',
    'Ora chiusura aula',
    'Chiusura determinata da',
    'Alunno',
    'Codice fiscale',
    'Primo accesso',
    'Uscita',
    'Uscita da',
    'Esito',
    'Minuti collegamento',
    'Minuti di pausa registrati',
    'N. accessi',
    'Correzione manuale',
    'Note',
  ]
  const lines = [head.join(';')]
  for (const s of sessions) {
    for (const r of sortedRows(s.rows)) {
      lines.push(
        [
          itDate(s.day),
          romeTime(s.closed_at),
          `${closedSourceLabels[s.closed_source]}${s.closed_note ? ` - ${s.closed_note}` : ''}`,
          studentName(r),
          r.student?.tax_code ?? '',
          romeTime(r.first_join_at),
          romeTime(r.exit_at),
          exitSourceLabels[r.exit_source],
          statusLabels[r.status],
          r.minutes ?? '',
          r.pause_minutes,
          r.joins,
          r.manual ? 'sì' : '',
          r.note,
        ]
          .map(csvCell)
          .join(';'),
      )
    }
  }
  return '﻿' + lines.join('\r\n')
}

export function logCsv(events: FadLogEventRow[]): string {
  const kind = { join: 'Accesso alla riunione', leave: 'Abbandono della riunione', end: 'Termine forzato della riunione' }
  const lines = ['Data;Ora;Utente Moodle;Evento;Descrizione originale;Indirizzo IP']
  for (const e of events) {
    const day = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome' }).format(new Date(e.occurred_at))
    lines.push([day, romeTime(e.occurred_at), e.user_name, kind[e.kind], e.description, e.ip].map(csvCell).join(';'))
  }
  return '﻿' + lines.join('\r\n')
}

function esc(s: string | number | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Dichiarazione per la Regione: pagina stampabile (Salva come PDF) con metodo,
 * riepilogo per giornata e prospetto per alunno.
 */
export function declarationHtml(
  course: Course,
  sessions: FadSessionWithRows[],
  options: { partial?: boolean; issuedOn?: Date } = {},
): string {
  const issuedOn = options.issuedOn ?? new Date()
  const totals = fadTotals(sessions)
  const period = periodText(sessions)
  const edition = course.edition ? ` – ${course.edition}` : ''
  const today = new Intl.DateTimeFormat('it-IT').format(issuedOn)
  const daysRows = sessions
    .map((s) => {
      const counts = { fino: 0, prima: 0, ver: 0, ass: 0 }
      for (const r of s.rows) {
        if (r.status === 'fino_chiusura') counts.fino++
        else if (r.status === 'uscito_prima') counts.prima++
        else if (r.status === 'da_verificare') counts.ver++
        else counts.ass++
      }
      return `<tr><td>${itDate(s.day)}</td><td>${esc(romeTime(s.closed_at)) || '—'}</td><td>${esc(
        closedSourceLabels[s.closed_source],
      )}${s.closed_note ? `<br><small>${esc(s.closed_note)}</small>` : ''}${
        s.closed_by ? `<br><small>da: ${esc(s.closed_by)}</small>` : ''
      }</td><td class="n">${counts.fino + counts.prima + counts.ver}</td><td class="n">${counts.fino}</td><td class="n">${counts.prima}</td><td class="n">${counts.ver}</td><td class="n">${counts.ass}</td></tr>`
    })
    .join('')
  const studentRows = sessions
    .map((s) =>
      sortedRows(s.rows)
        .map(
          (r) =>
            `<tr class="${r.status}"><td>${itDate(s.day)}</td><td>${esc(studentName(r))}</td><td>${esc(
              r.student?.tax_code ?? '',
            )}</td><td>${esc(romeTime(r.first_join_at))}</td><td>${esc(romeTime(r.exit_at))}</td><td>${esc(
              exitSourceLabels[r.exit_source],
            )}</td><td class="n">${esc(r.minutes ?? '')}</td><td>${esc(statusLabels[r.status])}${
              r.note ? `<br><small>${esc(r.note)}</small>` : ''
            }</td></tr>`,
        )
        .join(''),
    )
    .join('')

  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Dichiarazione presenze FAD – ${esc(
    course.name,
  )}${esc(edition)}</title><style>
body{font-family:Georgia,'Times New Roman',serif;color:#111;margin:32px;font-size:12px;line-height:1.45}
h1{font-size:17px;text-align:center;margin:0 0 4px}h2{font-size:14px;margin:22px 0 6px}
.sub{text-align:center;margin:0 0 18px}table{border-collapse:collapse;width:100%;margin:6px 0}
th,td{border:1px solid #999;padding:3px 5px;vertical-align:top}th{background:#eee;text-align:left}
.n{text-align:right}tr.uscito_prima td{background:#fde2e2}tr.da_verificare td{background:#fff3cd}
tr.assente td{color:#777}small{color:#444}.sign{margin-top:40px;display:flex;justify-content:space-between}
@media print{body{margin:12mm}h2{break-after:avoid}tr{break-inside:avoid}}
</style></head><body>
<h1>DICHIARAZIONE SOSTITUTIVA DI ATTO DI NOTORIETÀ</h1>
<p class="sub">(art. 47 D.P.R. 28 dicembre 2000, n. 445)<br>Presenze in Formazione a Distanza – permanenza degli allievi fino alla chiusura dell'aula virtuale<br><b>Giornate FAD ${esc(period)}</b>${options.partial ? ' (prospetto parziale)' : ''}</p>
<p>Il/La sottoscritto/a ______________________________, in qualità di legale rappresentante di <b>Cambia-Menti S.r.l.</b>, ente di formazione accreditato presso la Regione Calabria, consapevole delle sanzioni penali previste dall'art. 76 del D.P.R. 445/2000 in caso di dichiarazioni mendaci,</p>
<p style="text-align:center"><b>DICHIARA</b></p>
<p>con riferimento al corso <b>${esc(course.name)}${esc(edition)}</b>${course.code ? `, ID ${esc(course.code)}` : ''}${
    course.cup ? `, CUP ${esc(course.cup)}` : ''
  }${course.funding_program ? `, ${esc(course.funding_program)}` : ''}${
    course.funding_decree ? `, ${esc(course.funding_decree)}` : ''
  }, svolto in modalità FAD sincrona sulla piattaforma Moodle (www.cambiamentisrl.it/fad) con aula virtuale BigBlueButton:</p>
<ol>
<li>che i dati riportati di seguito sono estratti dal registro eventi originale della piattaforma Moodle, non modificabile dall'ente, e sono allegati integralmente in formato elettronico;</li>
<li>che la piattaforma registra l'evento «Accesso alla riunione» a ogni ingresso dell'allievo nell'aula virtuale, mentre registra l'evento «Abbandono della riunione» <b>solo quando il browser dell'allievo ritorna sulla pagina del corso Moodle</b>;</li>
<li>che al termine di ciascuna lezione il docente chiude l'aula virtuale per tutti i partecipanti: in quel momento gli allievi che avevano chiuso la finestra o l'applicazione della videoconferenza non generano alcun evento di uscita. Per tali allievi <b>l'assenza dell'evento di uscita non indica un abbandono anticipato</b>: l'uscita coincide con la chiusura dell'aula;</li>
<li>che l'ora di chiusura dell'aula di ogni giornata è stata determinata dall'evento «Termine forzato della riunione», quando registrato, oppure dall'uscita simultanea dei partecipanti (almeno tre partecipanti che escono entro due minuti), come indicato giornata per giornata nella Tabella 1;</li>
<li>che un allievo è indicato come «Collegato fino alla chiusura» quando, all'ora di chiusura dell'aula (con una tolleranza di 5 minuti), risultava entrato e non uscito; eventuali uscite anticipate e i casi non determinabili dai log sono indicati espressamente nella Tabella 2;</li>
<li>che il presente prospetto riguarda le sole giornate di lezione svolte in modalità FAD ${esc(period)}${options.partial ? ', limitatamente al periodo indicato' : ''}, per un totale di ${totals.days} giornate, elencate nella Tabella 1;</li>
<li>che nel complesso, nelle ${totals.days} giornate FAD considerate, risultano <b>${totals.fino}</b> presenze con collegamento fino alla chiusura dell'aula, <b>${totals.prima}</b> uscite anticipate, <b>${totals.verificare}</b> casi da verificare con il registro didattico e ${totals.assenti} assenze.</li>
</ol>
<h2>Tabella 1 – Chiusura dell'aula per giornata</h2>
<table><thead><tr><th>Data</th><th>Ora chiusura</th><th>Come è determinata</th><th>Allievi collegati</th><th>Fino alla chiusura</th><th>Usciti prima</th><th>Da verificare</th><th>Assenti</th></tr></thead><tbody>${daysRows}</tbody></table>
<h2>Tabella 2 – Prospetto per allievo e giornata</h2>
<table><thead><tr><th>Data</th><th>Allievo</th><th>Codice fiscale</th><th>Primo accesso</th><th>Uscita</th><th>Uscita da</th><th>Minuti</th><th>Esito</th></tr></thead><tbody>${studentRows}</tbody></table>
<p>Allegati: registro eventi Moodle originale (accessi, abbandoni, chiusure forzate) per il corso indicato e le giornate ${esc(period)}.</p>
<div class="sign"><div>Luogo e data: ____________, ${today}</div><div>Il legale rappresentante<br><br>______________________________</div></div>
</body></html>`
}
