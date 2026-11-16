/** Indice del fascicolo corso (HTML stampabile) con il controllo di completezza per l'audit. */
import { fmtDate, formatCourseEdition, fullName } from './format'
import { fmtScore, surveyGroups, type SurveySummary } from './quality'
import type { Course, Person } from '../types/db'

export interface DossierData {
  course: Course
  generatedAt: Date
  teachers: Person[]
  tutors: Person[]
  admins: Person[]
  students: number
  activeStudents: number
  lessons: number
  fadDays: number
  certificates: number
  deliveredCertificates: number
  protocol: number
  surveyResponses: number
  survey: SurveySummary
  documents: { name: string; title: string; category: string; date: string }[]
  missingFiles: string[]
}

export interface DossierCheck {
  label: string
  ok: boolean
  detail: string
}

const has = (docs: DossierData['documents'], re: RegExp) =>
  docs.some((d) => re.test(`${d.title} ${d.name} ${d.category}`.toLowerCase()))

/** Le voci del «fascicolo corso» della lista di audit (punto 8.5) e se ci sono evidenze. */
export function dossierChecks(d: DossierData): DossierCheck[] {
  const docs = d.documents
  return [
    {
      label: 'Organico (docenti, tutor) con lettere di incarico',
      ok: d.teachers.length > 0 && has(docs, /incaric|nomina|lettera d'incarico/),
      detail: `${d.teachers.length} docenti, ${d.tutors.length} tutor`,
    },
    {
      label: 'Allievi iscritti e moduli di iscrizione',
      ok: d.students > 0 && has(docs, /iscrizion|domanda|allegato|modulo/),
      detail: `${d.students} allievi (${d.activeStudents} attivi)`,
    },
    {
      label: 'Calendario e comunicazione di avvio',
      ok: d.lessons > 0 && (d.protocol > 0 || has(docs, /avvio|calendario|convocazion/)),
      detail: `${d.lessons} lezioni a calendario, ${d.protocol} protocolli`,
    },
    {
      label: 'Registro presenze (vidimato) o report FAD con login/logout',
      ok: d.fadDays > 0 || has(docs, /registro|presenz/),
      detail: d.fadDays ? `${d.fadDays} giornate FAD dai log Moodle` : 'nessun registro caricato',
    },
    {
      label: 'Materiale didattico e ricevuta di consegna',
      ok: has(docs, /dispens|slide|material/),
      detail: has(docs, /dispens|slide|material/) ? 'presente tra i documenti' : 'da caricare nei documenti del corso',
    },
    {
      label: "Verifiche dell'apprendimento (test, prove finali)",
      ok: has(docs, /test|verific|prova|esame|questionario finale/),
      detail: has(docs, /test|verific|prova|esame/) ? 'presenti tra i documenti' : 'da caricare nei documenti del corso',
    },
    {
      label: 'Attestati nel registro progressivo e consegnati',
      ok: d.certificates > 0 && d.deliveredCertificates === d.certificates,
      detail: `${d.certificates} rilasciati, ${d.deliveredCertificates} consegnati`,
    },
    {
      label: 'Questionari di gradimento',
      ok: d.surveyResponses > 0,
      detail: d.surveyResponses ? `${d.surveyResponses} risposte, media ${fmtScore(d.survey.overall)} su 5` : 'nessuna risposta',
    },
  ]
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function buildDossierIndex(d: DossierData): string {
  const c = d.course
  const edition = formatCourseEdition(c.edition)
  const title = [c.code, c.name, edition].filter(Boolean).join(' · ')
  const checks = dossierChecks(d)
  const people = (label: string, list: Person[]) =>
    list.length ? `<tr><th>${label}</th><td>${esc(list.map(fullName).join(', '))}</td></tr>` : ''
  const survey = d.surveyResponses
    ? `<h2>Gradimento dei partecipanti</h2>
<p>${d.surveyResponses} risposte · media complessiva <strong>${fmtScore(d.survey.overall)}</strong> su 5 · soddisfatti ${
        d.survey.satisfiedShare != null ? Math.round(d.survey.satisfiedShare * 100) + '%' : '—'
      }</p>
<table><tr><th>Area</th><th>Media</th></tr>${surveyGroups
        .map((g) => `<tr><td>${esc(g.title)}</td><td>${fmtScore(d.survey.byGroup[g.id])}</td></tr>`)
        .join('')}</table>`
    : ''
  const docRows = d.documents
    .map(
      (doc) =>
        `<tr><td>${esc(doc.category)}</td><td>${esc(doc.title || doc.name)}</td><td>${esc(doc.name)}</td><td>${fmtDate(doc.date.slice(0, 10))}</td></tr>`,
    )
    .join('')
  return `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><title>Fascicolo ${esc(title)}</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;color:#1e293b;max-width:960px;margin:24px auto;padding:0 16px;font-size:14px}
h1{font-size:22px;margin-bottom:4px}h2{font-size:16px;margin-top:28px;border-bottom:1px solid #cbd5e1;padding-bottom:4px}
table{border-collapse:collapse;width:100%;margin-top:8px}th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left;vertical-align:top}
th{background:#f8fafc;font-weight:600}.ok{color:#047857;font-weight:700}.no{color:#b45309;font-weight:700}.muted{color:#64748b}
</style></head><body>
<h1>Fascicolo del corso</h1>
<p><strong>${esc(title)}</strong></p>
<p class="muted">Cambia-Menti S.r.l. · generato dal gestionale il ${fmtDate(d.generatedAt.toISOString().slice(0, 10))}</p>
<h2>Dati del corso</h2>
<table>
<tr><th>Codice</th><td>${esc(c.code || '—')}</td></tr>
<tr><th>Edizione</th><td>${esc(edition || '—')}</td></tr>
<tr><th>CUP</th><td>${esc(c.cup || '—')}</td></tr>
<tr><th>Periodo</th><td>${fmtDate(c.start_date)} – ${fmtDate(c.end_date)}</td></tr>
<tr><th>Durata</th><td>${c.duration_hours != null ? `${c.duration_hours} ore` : '—'}</td></tr>
<tr><th>Finanziamento</th><td>${esc([c.funding_program, c.funding_decree].filter(Boolean).join(' · ') || '—')}</td></tr>
${people('Docenti', d.teachers)}${people('Tutor', d.tutors)}${people('Amministrativi', d.admins)}
</table>
<h2>Completezza del fascicolo (ISO 9001 punto 8.5)</h2>
<table><tr><th></th><th>Evidenza</th><th>Situazione</th></tr>
${checks
  .map((ch) => `<tr><td class="${ch.ok ? 'ok' : 'no'}">${ch.ok ? '✓' : '!'}</td><td>${esc(ch.label)}</td><td>${esc(ch.detail)}</td></tr>`)
  .join('\n')}
</table>
<h2>Contenuto dello ZIP</h2>
<ul>
<li>02 Organico del corso · 03 Allievi · 04 Calendario lezioni (Excel)</li>
${d.fadDays ? '<li>05 Presenze FAD dai log Moodle (Excel)</li>' : ''}
<li>06 Registro attestati (Excel)</li>
${d.protocol ? '<li>07 Protocolli del corso (Excel)</li>' : ''}
<li>Cartella «Documenti»: tutti i documenti del corso, divisi per categoria</li>
</ul>
${survey}
<h2>Documenti del corso (${d.documents.length})</h2>
${
  d.documents.length
    ? `<table><tr><th>Categoria</th><th>Titolo</th><th>File</th><th>Caricato il</th></tr>${docRows}</table>`
    : '<p class="muted">Nessun documento caricato.</p>'
}
${
  d.missingFiles.length
    ? `<p class="no">File non scaricati: ${esc(d.missingFiles.join(', '))}</p>`
    : ''
}
</body></html>`
}
