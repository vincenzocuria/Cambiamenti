/**
 * Iter di più corsi in una volta (dashboard, connettore MCP): legge passi e dati dei corsi
 * con poche query e calcola lo stato effettivo dei passi con evaluateIter.
 * Riceve il client Supabase per funzionare sia nell'app sia nel connettore.
 */
import { evaluateIter, summarizeIter, type CourseStep, type EvaluatedStep, type IterFacts, type IterSummary } from './courseIter'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = { from: (table: string) => any }

export interface CourseIterOverview {
  course: { id: string; name: string; edition: string; status: string; start_date: string | null; end_date: string | null }
  evaluated: EvaluatedStep[]
  summary: IterSummary
}

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null))

function countBy(rows: { course_id: string }[] | null): Map<string, number> {
  const m = new Map<string, number>()
  for (const r of rows ?? []) m.set(r.course_id, (m.get(r.course_id) ?? 0) + 1)
  return m
}

async function rows<T>(q: PromiseLike<{ data: T[] | null; error: { message: string } | null }>, what: string): Promise<T[]> {
  const { data, error } = await q
  if (error) throw new Error(`Lettura ${what}: ${error.message}`)
  return data ?? []
}

/** Corsi con l'iter impostato (tutti, o quelli indicati) e lo stato dei loro passi. */
export async function loadIterOverview(db: Db, today: string, courseIds?: string[]): Promise<CourseIterOverview[]> {
  const scope = (q: any) => (courseIds ? q.in('course_id', courseIds) : q)
  const steps = await rows<CourseStep & { course_step_documents: { document_id: string }[] }>(
    scope(db.from('course_steps').select('*, course_step_documents(document_id)')),
    'passi',
  )
  const ids = [...new Set(steps.map((s) => s.course_id))]
  if (!ids.length) return []

  const [courses, staff, students, lessons, fad, lines, invoices, docs] = await Promise.all([
    rows<Record<string, any>>(db.from('courses').select('*').in('id', ids), 'corsi'),
    rows<{ course_id: string }>(db.from('course_staff').select('course_id').in('course_id', ids), 'organico'),
    rows<{ course_id: string }>(db.from('course_students').select('course_id').in('course_id', ids), 'allievi'),
    rows<{ course_id: string }>(db.from('calendar_events').select('course_id').in('course_id', ids), 'calendario'),
    rows<{ course_id: string }>(db.from('fad_sessions').select('course_id').in('course_id', ids), 'presenze FAD'),
    rows<{ course_id: string }>(db.from('course_report_lines').select('course_id').in('course_id', ids), 'verbali'),
    rows<{ course_id: string; kind: string; invoices: any }>(
      db.from('invoice_courses').select('course_id, kind, invoices(status, paid_at, direction)').in('course_id', ids),
      'note di debito',
    ),
    rows<{ course_id: string; documents: any }>(
      db.from('document_courses').select('course_id, documents(id, title, file_name, category, template_id)').in('course_id', ids),
      'documenti',
    ),
  ])
  const staffN = countBy(staff)
  const studentsN = countBy(students)
  const lessonsN = countBy(lessons)
  const fadN = countBy(fad)
  const linesN = countBy(lines)

  return courses.map((c) => {
    const courseSteps = steps.filter((s) => s.course_id === c.id)
    const facts: IterFacts = {
      status: c.status,
      code: c.code || null,
      cup: c.cup || null,
      fundingProgram: c.funding_program || null,
      fundingDecree: c.funding_decree || null,
      startDate: c.start_date ?? null,
      endDate: c.end_date ?? null,
      durationHours: c.duration_hours == null ? null : Number(c.duration_hours),
      staff: staffN.get(c.id) ?? 0,
      students: studentsN.get(c.id) ?? 0,
      lessons: lessonsN.get(c.id) ?? 0,
      fadDays: fadN.get(c.id) ?? 0,
      reportLines: linesN.get(c.id) ?? 0,
      invoices: invoices
        .filter((r) => r.course_id === c.id)
        .map((r) => ({ kind: r.kind, inv: one(r.invoices) as { status: string; paid_at: string | null; direction: string } | null }))
        .filter((r) => r.inv && r.inv.direction !== 'in' && r.inv.status !== 'draft')
        .map((r) => ({ kind: r.kind, paid: Boolean(r.inv!.paid_at) })),
      documents: docs
        .filter((r) => r.course_id === c.id)
        .map((r) => one(r.documents) as { id: string; title: string; file_name: string; category: string; template_id: string | null } | null)
        .filter((d): d is NonNullable<typeof d> => Boolean(d))
        .map((d) => ({ id: d.id, title: d.title, file_name: d.file_name, category: d.category, generated: Boolean(d.template_id) })),
    }
    const linked = new Map(courseSteps.map((s) => [s.id, (s.course_step_documents ?? []).map((l) => l.document_id)]))
    const evaluated = evaluateIter(courseSteps, facts, linked, today)
    return {
      course: { id: c.id, name: c.name, edition: c.edition, status: c.status, start_date: c.start_date, end_date: c.end_date },
      evaluated,
      summary: summarizeIter(evaluated),
    }
  })
}

export interface DueStep {
  courseId: string
  courseName: string
  edition: string
  title: string
  due_on: string | null
  overdue: boolean
  isNext: boolean
}

/** Passi aperti in ritardo o in scadenza entro `days` giorni, più il prossimo passo di ogni corso. */
export function dueSteps(overview: CourseIterOverview[], today: string, days = 14): DueStep[] {
  const limit = new Date(`${today}T00:00:00Z`)
  limit.setUTCDate(limit.getUTCDate() + days)
  const until = limit.toISOString().slice(0, 10)
  const out: DueStep[] = []
  for (const o of overview) {
    if (o.course.status === 'esito_chiuso') continue
    for (const e of o.evaluated) {
      if (e.state !== 'da_fare' && e.state !== 'in_corso') continue
      const isNext = o.summary.next?.step.id === e.step.id
      const dueSoon = !!e.step.due_on && e.step.due_on <= until
      if (!dueSoon && !isNext) continue
      out.push({
        courseId: o.course.id,
        courseName: o.course.name,
        edition: o.course.edition,
        title: e.step.title,
        due_on: e.step.due_on,
        overdue: e.overdue,
        isNext,
      })
    }
  }
  return out.sort(
    (a, b) => Number(b.overdue) - Number(a.overdue) || (a.due_on ?? '9999').localeCompare(b.due_on ?? '9999') || a.courseName.localeCompare(b.courseName),
  )
}
