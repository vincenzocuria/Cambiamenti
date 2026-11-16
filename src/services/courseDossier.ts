import { supabase } from '../lib/supabase'
import { categoryLabels } from '../data/documentCategories'
import { excelXml } from '../lib/exportExcel'
import { fmtDate, formatCourseEdition, fullName } from '../lib/format'
import { buildZip, type ZipEntry } from '../lib/zip'
import { buildDossierIndex, type DossierData } from '../lib/courseDossier'
import { certificateLabel, summarizeResponses } from '../lib/quality'
import { protocolLabel } from '../lib/protocol'
import { listCourseEnrollments, listCoursePeople } from './enrollments'
import { listDocuments } from './documents'
import { listFadSessions } from './fadAttendance'
import { listProtocol } from './protocol'
import { listCertificates, listSurveyResponses, listSurveys } from './quality'
import type { CalendarEvent, Course } from '../types/db'

const enc = new TextEncoder()
const text = (s: string) => enc.encode(s)
const sheet = (title: string, headers: string[], rows: string[][]) => text(excelXml({ title, headers, rows }))

function time(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })
}

async function listCourseCalendar(courseId: string): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('course_id', courseId)
    .order('starts_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as CalendarEvent[]
}

/**
 * Fascicolo del corso per l'auditor: indice, elenchi in Excel (organico, allievi, calendario,
 * presenze FAD, attestati, protocolli, gradimento) e tutti i documenti caricati, in un unico ZIP.
 */
export async function buildCourseDossier(
  course: Course,
  onProgress?: (msg: string) => void,
): Promise<{ zip: Uint8Array; fileName: string; missing: string[] }> {
  onProgress?.('Raccolgo i dati del corso…')
  const [teachers, tutors, admins, students, enrollments, calendar, docs, certificates, protocol, surveys, fad] =
    await Promise.all([
      listCoursePeople('teacher', course.id),
      listCoursePeople('tutor', course.id),
      listCoursePeople('admin_staff', course.id),
      listCoursePeople('student', course.id),
      listCourseEnrollments(course.id),
      listCourseCalendar(course.id),
      listDocuments({ mode: 'course', courseId: course.id }),
      listCertificates({ courseId: course.id }),
      listProtocol({ courseId: course.id }),
      listSurveys(course.id),
      course.moodle_course_id ? listFadSessions(course.id).catch(() => []) : Promise.resolve([]),
    ])
  const responses = await listSurveyResponses(surveys.map((s) => s.id))
  const summary = summarizeResponses(responses)

  const entries: ZipEntry[] = []
  const add = (path: string, data: Uint8Array) => entries.push({ path, data })

  const staffRows = [
    ...teachers.map((p) => ['Docente', fullName(p), p.tax_code, p.email, p.phone]),
    ...tutors.map((p) => ['Tutor', fullName(p), p.tax_code, p.email, p.phone]),
    ...admins.map((p) => ['Amministrativo', fullName(p), p.tax_code, p.email, p.phone]),
  ]
  add('02 Organico del corso.xls', sheet('Organico', ['Ruolo', 'Nome', 'Codice fiscale', 'Email', 'Telefono'], staffRows))

  add(
    '03 Allievi.xls',
    sheet(
      'Allievi',
      ['Cognome e nome', 'Codice fiscale', 'Data di nascita', 'Email', 'Telefono', 'Stato', 'Iscritto dal', 'Uscito il', 'Nota'],
      students.map((p) => {
        const e = enrollments.get(p.id)
        return [
          fullName(p),
          p.tax_code,
          fmtDate(p.birth_date),
          p.email,
          p.phone,
          e?.status ?? 'attivo',
          fmtDate(e?.enrolled_on ?? null),
          fmtDate(e?.left_on ?? null),
          e?.status_note ?? '',
        ]
      }),
    ),
  )

  add(
    '04 Calendario lezioni.xls',
    sheet(
      'Calendario',
      ['Data', 'Inizio', 'Fine', 'Argomento', 'Aula', 'Note'],
      calendar.map((ev) => [fmtDate(ev.starts_at.slice(0, 10)), time(ev.starts_at), time(ev.ends_at), ev.title, ev.room, ev.notes]),
    ),
  )

  const fadRows = fad
    .filter((s) => !s.excluded)
    .flatMap((s) =>
      s.rows.map((r) => [
        fmtDate(s.day),
        r.student ? `${r.student.last_name} ${r.student.first_name}` : r.moodle_name,
        r.student?.tax_code ?? '',
        time(r.first_join_at),
        time(r.exit_at),
        r.minutes != null ? String(r.minutes) : '',
        r.status,
        [r.manual ? 'corretto a mano' : '', r.note].filter(Boolean).join(' · '),
      ]),
    )
  if (fadRows.length) {
    add(
      '05 Presenze FAD dai log Moodle.xls',
      sheet('Presenze FAD', ['Giorno', 'Allievo', 'Codice fiscale', 'Primo accesso', 'Uscita', 'Minuti', 'Stato', 'Note'], fadRows),
    )
  }

  add(
    '06 Registro attestati.xls',
    sheet(
      'Attestati',
      ['N.', 'Data', 'Intestatario', 'Codice fiscale', 'Titolo', 'Ore', 'Esito', 'Consegnato il', 'Modalità consegna', 'Annullato'],
      [...certificates]
        .sort((a, b) => a.year - b.year || a.number - b.number)
        .map((c) => [
          certificateLabel(c),
          fmtDate(c.issued_on),
          c.holder_name,
          c.holder_tax_code,
          c.title,
          c.hours != null ? String(c.hours) : '',
          c.outcome,
          fmtDate(c.delivered_on),
          c.delivery_method,
          c.cancelled_at ? `sì: ${c.cancelled_reason}` : '',
        ]),
    ),
  )

  if (protocol.length) {
    add(
      '07 Protocolli del corso.xls',
      sheet(
        'Protocolli',
        ['N.', 'Data', 'Tipo', 'Mittente / destinatario', 'Oggetto', 'Mezzo', 'Rif. esterno'],
        [...protocol].reverse().map((p) => [protocolLabel(p), fmtDate(p.entry_date), p.direction, p.counterpart, p.subject, p.channel, p.external_ref]),
      ),
    )
  }

  // Documenti: una cartella per categoria
  const missing: string[] = []
  let n = 0
  for (const doc of docs) {
    n++
    onProgress?.(`Scarico i documenti (${n}/${docs.length})…`)
    const { data, error } = await supabase.storage.from('documents').download(doc.storage_path)
    if (error || !data) {
      missing.push(doc.file_name)
      continue
    }
    const folder = categoryLabels[doc.category] ?? 'Altro'
    add(`Documenti/${folder}/${doc.file_name}`, new Uint8Array(await data.arrayBuffer()))
  }

  const dossier: DossierData = {
    course,
    generatedAt: new Date(),
    teachers,
    tutors,
    admins,
    students: students.length,
    activeStudents: students.filter((p) => (enrollments.get(p.id)?.status ?? 'attivo') === 'attivo').length,
    lessons: calendar.length,
    fadDays: fad.filter((s) => !s.excluded).length,
    certificates: certificates.filter((c) => !c.cancelled_at).length,
    deliveredCertificates: certificates.filter((c) => !c.cancelled_at && c.delivered_on).length,
    protocol: protocol.length,
    surveyResponses: summary.responses,
    survey: summary,
    documents: docs.map((d) => ({ name: d.file_name, title: d.title, category: categoryLabels[d.category] ?? d.category, date: d.created_at })),
    missingFiles: missing,
  }
  entries.unshift({ path: '01 Indice del fascicolo.html', data: text(buildDossierIndex(dossier)) })

  onProgress?.('Creo lo ZIP…')
  const edition = formatCourseEdition(course.edition)
  const base = ['Fascicolo', course.code, course.name, edition].filter(Boolean).join(' ')
  return { zip: buildZip(entries), fileName: `${base.replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 120)}.zip`, missing }
}
