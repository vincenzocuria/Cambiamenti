import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type {
  Course,
  CourseInput,
  CourseReportLine,
  DocumentRow,
  Person,
  PersonType,
} from '../types/db'
import { deleteCourse, getCourse, updateCourse } from '../services/courses'
import { listCoursePeople } from '../services/enrollments'
import { fetchCourseStaffingCounts } from '../services/courseStaffing'
import { listCourseReportLines } from '../services/courseDocuments'
import { staffingOk, staffingRequirements, type CourseStaffingCounts } from '../data/courseStaffing'
import { fmtDate, formatCourseEdition, fullName } from '../lib/format'
import { formatEuro } from '../lib/euroInWords'
import { matchesSearch } from '../lib/matchesSearch'
import { hasCompleteFadCredentials } from '../lib/fadCredentials'
import { filterBrowsePeople } from '../hooks/usePeopleBrowse'
import { DEFAULT_PERSON_SORT, DEFAULT_SORT_DIRECTION } from '../lib/sortPeople'
import { categoryLabels } from '../data/documentCategories'
import { CourseForm } from '../components/CourseForm'
import { CoursePeople } from '../components/CoursePeople'
import { CourseStatusBadge } from '../components/CourseStatusBadge'
import { CourseProgress } from '../components/CourseProgress'
import { DocumentsPanel } from '../components/DocumentsPanel'
import { CourseReportLines } from '../components/CourseReportLines'
import { CourseInvoicesPanel } from '../components/CourseInvoicesPanel'
import { listCourseInvoices, type CourseInvoiceRow } from '../services/courseInvoices'
import { courseInvoiceKindLabel, courseInvoiceSummary } from '../lib/courseInvoice'
import { GenerateDocumentForm } from '../components/GenerateDocumentForm'
import { BulkGenerateDocumentsForm } from '../components/BulkGenerateDocumentsForm'
import { DangerButton, SecondaryButton } from '../components/Buttons'
import { SegmentedControl } from '../components/SegmentedControl'
import { KpiCards, type KpiCardItem } from '../components/KpiCards'
import { CollapsibleSection } from '../components/CollapsibleSection'
import { takenStaffIds } from '../lib/takenStaffIds'
import { formatCourseShareLabel } from '../lib/fadShareMessage'
import { FadShareBulk } from '../components/FadShareBulk'
import { FadMoodleSync } from '../components/FadMoodleSync'

const genRoles: { type: PersonType; label: string }[] = [
  { type: 'teacher', label: 'Docente' },
  { type: 'tutor', label: 'Tutor' },
  { type: 'admin_staff', label: 'Amministrativo' },
  { type: 'student', label: 'Alunno' },
]

const roleLabels: Record<string, string> = {
  student: 'Alunni',
  teacher: 'Docenti',
  tutor: 'Tutor',
  admin_staff: 'Amministrativi',
}

/** Sezioni della scheda, nell'ordine in cui compaiono. */
const SECTIONS = [
  { id: 'dati', label: 'Dati' },
  { id: 'docenti', label: 'Docenti' },
  { id: 'tutor', label: 'Tutor' },
  { id: 'amministrativi', label: 'Amministrativi' },
  { id: 'alunni', label: 'Alunni' },
  { id: 'documenti', label: 'Documenti' },
  { id: 'verbali', label: 'Verbali' },
  { id: 'fatture', label: 'Fatture' },
  { id: 'genera', label: 'Genera' },
  { id: 'fad', label: 'FAD' },
] as const
type SectionId = (typeof SECTIONS)[number]['id']
type OpenState = Record<SectionId, boolean>

/** Di default tutte chiuse: il quadro d'insieme lo danno avanzamento e KPI. */
const DEFAULT_OPEN = Object.fromEntries(SECTIONS.map((s) => [s.id, false])) as OpenState

const OPEN_STORAGE_KEY = 'courseDetail.openSections.v2'

/** Sezione della pagina per ogni ruolo del corso. */
const ROLE_SECTIONS = [
  { type: 'teacher', id: 'docenti', title: 'Docenti' },
  { type: 'tutor', id: 'tutor', title: 'Tutor' },
  { type: 'admin_staff', id: 'amministrativi', title: 'Figure amministrative' },
  { type: 'student', id: 'alunni', title: 'Alunni' },
] as const satisfies readonly { type: PersonType; id: SectionId; title: string }[]

function loadOpenState(): OpenState {
  try {
    const raw = window.localStorage.getItem(OPEN_STORAGE_KEY)
    if (raw) return { ...DEFAULT_OPEN, ...(JSON.parse(raw) as Partial<OpenState>) }
  } catch {
    // storage non disponibile: si usano le impostazioni predefinite
  }
  return DEFAULT_OPEN
}

function saveOpenState(state: OpenState) {
  try {
    window.localStorage.setItem(OPEN_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignorato
  }
}

const money = (n: number) => `€ ${formatEuro(n)}`

const NO_LINES: CourseReportLine[] = []

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

export function CourseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [course, setCourse] = useState<Course | null>(null)
  const [editing, setEditing] = useState(false)
  const [staffing, setStaffing] = useState<CourseStaffingCounts>({
    teacher: 0,
    tutor: 0,
    admin_staff: 0,
  })
  const [peopleByType, setPeopleByType] = useState<Partial<Record<PersonType, Person[]>>>({
    student: [],
    teacher: [],
    tutor: [],
    admin_staff: [],
  })
  const [docs, setDocs] = useState<DocumentRow[] | null>(null)
  const [reportLines, setReportLines] = useState<CourseReportLine[] | null>(null)
  const [invoiceRows, setInvoiceRows] = useState<CourseInvoiceRow[] | null>(null)
  const [docsKey, setDocsKey] = useState(0)
  const [peopleType, setPeopleType] = useState<PersonType>('student')
  const [genMode, setGenMode] = useState<'single' | 'bulk'>('bulk')
  const [open, setOpen] = useState<OpenState>(loadOpenState)
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  const staffTakenIds = useMemo(() => takenStaffIds(peopleByType), [peopleByType])
  const personNames = useMemo(
    () =>
      Object.fromEntries(
        Object.values(peopleByType)
          .flat()
          .filter((p): p is Person => Boolean(p))
          .map((p) => [p.id, fullName(p)]),
      ),
    [peopleByType],
  )

  async function reloadStaff() {
    if (!id) return
    const [counts, students, teachers, tutors, admins] = await Promise.all([
      fetchCourseStaffingCounts(id),
      listCoursePeople('student', id),
      listCoursePeople('teacher', id),
      listCoursePeople('tutor', id),
      listCoursePeople('admin_staff', id),
    ])
    setStaffing(counts)
    setPeopleByType({
      student: students,
      teacher: teachers,
      tutor: tutors,
      admin_staff: admins,
    })
  }

  const reloadReportLines = useCallback(() => {
    if (!id) return
    listCourseReportLines(id)
      .then(setReportLines)
      .catch(() => setReportLines([]))
  }, [id])

  const reloadInvoices = useCallback(() => {
    if (!id) return
    listCourseInvoices([id])
      .then(setInvoiceRows)
      .catch(() => setInvoiceRows([]))
  }, [id])

  useEffect(() => {
    if (id) {
      setCourse(null)
      setDocs(null)
      setReportLines(null)
      setInvoiceRows(null)
      reloadInvoices()
      getCourse(id).then(setCourse)
      void reloadStaff()
      reloadReportLines()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // "/" porta il cursore nella ricerca, Esc la svuota
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const typing =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      if (e.key === '/' && !typing) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function setSectionOpen(sectionId: SectionId, value: boolean) {
    setOpen((prev) => {
      const next = { ...prev, [sectionId]: value }
      saveOpenState(next)
      return next
    })
  }

  function setAllOpen(value: boolean) {
    const next = Object.fromEntries(SECTIONS.map((s) => [s.id, value])) as OpenState
    saveOpenState(next)
    setOpen(next)
  }

  function goTo(sectionId: SectionId) {
    setSectionOpen(sectionId, true)
    window.requestAnimationFrame(() =>
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    )
  }

  const query = search.trim()
  const searching = query.length > 0

  // Risultati della ricerca, sezione per sezione
  const matches = useMemo(() => {
    const people = Object.fromEntries(
      Object.entries(peopleByType).map(([type, list]) => [
        type,
        query
          ? filterBrowsePeople(list ?? [], query, DEFAULT_PERSON_SORT, DEFAULT_SORT_DIRECTION)
          : (list ?? []),
      ]),
    ) as Record<string, Person[]>
    const peopleCount = Object.values(people).reduce((n, list) => n + list.length, 0)
    const docMatches = (docs ?? []).filter((d) =>
      matchesSearch(
        [
          d.title,
          d.file_name,
          categoryLabels[d.category] ?? d.category,
          d.person_id ? personNames[d.person_id] : '',
        ]
          .filter(Boolean)
          .join(' '),
        query,
      ),
    )
    const lineMatches = (reportLines ?? []).filter((l) =>
      matchesSearch(
        [l.subject, l.protocol_number, l.membership_act, 'verbale regione'].filter(Boolean).join(' '),
        query,
      ),
    )
    const invoiceMatches = (invoiceRows ?? []).filter((r) =>
      matchesSearch(
        [r.invoice.number, r.invoice.counterpart_name, courseInvoiceKindLabel(r.kind), r.description, 'fattura nota debito']
          .filter(Boolean)
          .join(' '),
        query,
      ),
    )
    const courseFields = course
      ? [course.code, course.cup, course.notes, query.length >= 3 ? 'dati corso' : '']
          .filter(Boolean)
          .join(' ')
      : ''
    return {
      people,
      peopleCount,
      docs: docMatches,
      lines: lineMatches,
      invoices: invoiceMatches,
      dati: Boolean(query) && matchesSearch(courseFields, query),
      // Le parole chiave delle sezioni contano solo da 3 lettere, per non accendere tutto con "de"
      genera: query.length >= 3 && matchesSearch('genera documenti modelli', query),
      fad:
        Boolean(query) &&
        (peopleCount > 0 ||
          (query.length >= 3 && matchesSearch('fad moodle credenziali piattaforma', query))),
    }
  }, [query, peopleByType, docs, reportLines, invoiceRows, personNames, course])

  const sectionHasMatch: Record<SectionId, boolean> = {
    dati: matches.dati,
    docenti: (matches.people.teacher?.length ?? 0) > 0,
    tutor: (matches.people.tutor?.length ?? 0) > 0,
    amministrativi: (matches.people.admin_staff?.length ?? 0) > 0,
    alunni: (matches.people.student?.length ?? 0) > 0,
    documenti: matches.docs.length > 0,
    verbali: matches.lines.length > 0,
    fatture: matches.invoices.length > 0,
    genera: matches.genera,
    fad: matches.fad,
  }

  /** Durante la ricerca restano aperte solo le sezioni con risultati. */
  function isOpen(sectionId: SectionId) {
    if (sectionId === 'dati' && editing) return true
    return searching ? sectionHasMatch[sectionId] : open[sectionId]
  }

  function toggle(sectionId: SectionId) {
    if (searching) {
      // Durante la ricerca il clic sull'intestazione azzera il filtro e mostra la sezione intera
      setSearch('')
      setSectionOpen(sectionId, true)
      return
    }
    setSectionOpen(sectionId, !open[sectionId])
  }

  if (!id || !course) return <p className="text-slate-400">Caricamento…</p>

  const courseLabel = formatCourseShareLabel(course)
  const editionLabel = formatCourseEdition(course.edition)
  const students = peopleByType.student ?? []
  const requirements = staffingRequirements(staffing)
  const organicoOk = staffingOk(staffing)
  const fadReady = students.filter(hasCompleteFadCredentials).length
  const balance = (reportLines ?? []).reduce((n, l) => n + Number(l.amount_balance ?? 0), 0)
  const recognized = (reportLines ?? []).reduce((n, l) => n + Number(l.amount_recognized ?? 0), 0)
  const hasLines = (reportLines?.length ?? 0) > 0
  const billing = courseInvoiceSummary(invoiceRows ?? [], reportLines ?? [])

  const kpis: KpiCardItem[] = [
    {
      key: 'alunni',
      label: 'Alunni',
      value: students.length,
      hint: students.length
        ? `${fadReady} di ${students.length} con credenziali FAD`
        : 'Nessun alunno iscritto',
      tone: students.length ? 'default' : 'warn',
      onClick: () => goTo('alunni'),
    },
    {
      key: 'organico',
      label: 'Organico',
      value: organicoOk ? 'Completo' : 'Incompleto',
      hint: requirements.map((r) => `${shortRole(r.type)} ${r.current}/${r.min}`).join(' · '),
      tone: organicoOk ? 'ok' : 'warn',
      onClick: () => {
        const missing = requirements.find((r) => !r.ok)
        goTo(
          missing
            ? (ROLE_SECTIONS.find((r) => r.type === missing.type)?.id ?? 'docenti')
            : 'docenti',
        )
      },
    },
    {
      key: 'documenti',
      label: 'Documenti',
      value: docs == null ? '…' : docs.length,
      hint: docs == null ? 'Caricamento' : 'Allegati e generati',
      onClick: () => goTo('documenti'),
    },
    {
      key: 'durata',
      label: 'Durata',
      value: course.duration_hours != null ? `${course.duration_hours} ore` : '—',
      hint:
        course.start_date || course.end_date
          ? `${fmtDate(course.start_date)} – ${fmtDate(course.end_date)}`
          : 'Date da inserire',
      onClick: () => goTo('dati'),
    },
    {
      key: 'saldo',
      label: 'Saldo Regione',
      value: hasLines ? money(balance) : '—',
      hint: hasLines
        ? `Riconosciuto ${money(recognized)} · ${plural(reportLines!.length, 'verbale', 'verbali')}`
        : 'Nessun verbale caricato',
      tone: hasLines ? 'ok' : 'default',
      onClick: () => goTo('verbali'),
    },
    {
      key: 'fatturato',
      label: 'Fatturato Regione',
      value: invoiceRows == null ? '…' : money(billing.billed),
      hint:
        invoiceRows == null
          ? 'Caricamento'
          : `Incassato ${money(billing.paid)}${hasLines ? ` · saldo da fatturare ${money(billing.toBill)}` : ''}`,
      tone: hasLines && billing.toBill > 0 ? 'warn' : billing.billed ? 'ok' : 'default',
      onClick: () => goTo('fatture'),
    },
  ]

  async function handleSave(input: CourseInput) {
    const updated = await updateCourse(id!, input)
    setCourse(updated)
    setEditing(false)
  }

  async function handleDelete() {
    if (!window.confirm(`Eliminare il corso "${course!.name}"? Verranno rimosse anche le iscrizioni.`))
      return
    await deleteCourse(id!)
    navigate('/corsi')
  }

  function startEditing() {
    setEditing(true)
    goTo('dati')
  }

  const peopleSearch = searching ? query : ''
  const docSearch = searching ? query : ''
  const sectionCounts: Partial<Record<SectionId, number>> = searching
    ? {
        docenti: matches.people.teacher?.length ?? 0,
        tutor: matches.people.tutor?.length ?? 0,
        amministrativi: matches.people.admin_staff?.length ?? 0,
        alunni: matches.people.student?.length ?? 0,
        documenti: matches.docs.length,
        verbali: matches.lines.length,
        fatture: matches.invoices.length,
        fad: matches.peopleCount,
      }
    : {}

  const resultParts = [
    matches.peopleCount ? plural(matches.peopleCount, 'persona', 'persone') : '',
    matches.docs.length ? plural(matches.docs.length, 'documento', 'documenti') : '',
    matches.lines.length ? plural(matches.lines.length, 'verbale', 'verbali') : '',
    matches.invoices.length ? plural(matches.invoices.length, 'fattura', 'fatture') : '',
    matches.dati ? 'dati del corso' : '',
  ].filter(Boolean)

  return (
    <div className="space-y-6">
      {/* Intestazione */}
      <div>
        <Link to="/corsi" className="text-xs font-medium text-indigo-600 hover:underline">
          ← Tutti i corsi
        </Link>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold leading-tight text-slate-800">
              {course.name}
              {editionLabel && (
                <span className="font-medium text-slate-400"> · {editionLabel}</span>
              )}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
              <CourseStatusBadge status={course.status} />
              {course.code && <span className="text-slate-300">·</span>}
              {course.code && <span>Codice {course.code}</span>}
              {course.cup && <span className="text-slate-300">·</span>}
              {course.cup && <span>CUP {course.cup}</span>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!editing && <SecondaryButton onClick={startEditing}>Modifica</SecondaryButton>}
            <DangerButton size="md" onClick={() => void handleDelete()}>
              Elimina corso
            </DangerButton>
          </div>
        </div>
        <div className="mt-4">
          <CourseProgress
            status={course.status}
            startDate={course.start_date}
            endDate={course.end_date}
          />
        </div>
      </div>

      {/* KPI */}
      <KpiCards items={kpis} compact className="" />

      {/* Barra di ricerca e navigazione, resta in alto scorrendo */}
      <div className="sticky top-0 z-20 -mx-4 border-y border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:shadow-sm">
        <div className="flex flex-col gap-2">
          <div className="relative min-w-0 flex-1">
            <svg
              aria-hidden
              viewBox="0 0 20 20"
              fill="currentColor"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            >
              <path
                fillRule="evenodd"
                d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.45 4.39l3.08 3.08a.75.75 0 1 1-1.06 1.06l-3.08-3.08A7 7 0 0 1 2 9Z"
                clipRule="evenodd"
              />
            </svg>
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setSearch('')
              }}
              placeholder="Cerca persone, documenti, verbali…"
              aria-label="Cerca nella scheda del corso"
              className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-10 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            {!search && (
              <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-slate-200 px-1.5 text-[10px] font-medium text-slate-400 sm:block">
                /
              </kbd>
            )}
          </div>
          <nav
            aria-label="Sezioni della scheda"
            className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-0.5"
          >
            {SECTIONS.map((s) => {
              const count = sectionCounts[s.id]
              const dim = searching && !sectionHasMatch[s.id]
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    if (searching && !sectionHasMatch[s.id]) setSearch('')
                    goTo(s.id)
                  }}
                  className={
                    'inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition ' +
                    (dim
                      ? 'text-slate-300 hover:bg-slate-100'
                      : searching
                        ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800')
                  }
                >
                  {s.label}
                  {count != null && count > 0 && (
                    <span className="rounded-full bg-indigo-600 px-1.5 text-[10px] text-white tabular-nums">
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
            <span className="mx-1 h-5 w-px shrink-0 bg-slate-200 sm:ml-auto" aria-hidden />
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setAllOpen(true)
              }}
              className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              Apri tutto
            </button>
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setAllOpen(false)
              }}
              className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              Chiudi tutto
            </button>
          </nav>
        </div>
        {searching && (
          <p className="mt-2 text-xs text-slate-500" role="status">
            {resultParts.length ? (
              <>
                Trovati {resultParts.join(', ')} per «{query}».{' '}
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="font-medium text-indigo-600 hover:underline"
                >
                  Azzera ricerca
                </button>
              </>
            ) : (
              <>
                Nessun risultato per «{query}».{' '}
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="font-medium text-indigo-600 hover:underline"
                >
                  Azzera ricerca
                </button>
              </>
            )}
          </p>
        )}
      </div>

      {/* Sezioni */}
      <div className="space-y-4">
        <CollapsibleSection
          id="dati"
          title="Dati del corso"
          summary={[
            course.code && `Codice ${course.code}`,
            course.cup && `CUP ${course.cup}`,
            `${fmtDate(course.start_date)} – ${fmtDate(course.end_date)}`,
          ]
            .filter(Boolean)
            .join(' · ')}
          open={isOpen('dati')}
          onToggle={() => toggle('dati')}
          dimmed={searching && !sectionHasMatch.dati}
          actions={
            !editing && (
              <SecondaryButton size="sm" onClick={startEditing}>
                Modifica
              </SecondaryButton>
            )
          }
        >
          {editing ? (
            <div className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm">
              <CourseForm initial={course} onSave={handleSave} onCancel={() => setEditing(false)} />
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm sm:p-5">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
                <Info label="Codice" value={course.code || '—'} />
                <Info label="Edizione" value={editionLabel || '—'} />
                <Info label="CUP" value={course.cup || '—'} />
                <Info label="Inizio" value={fmtDate(course.start_date)} />
                <Info label="Fine" value={fmtDate(course.end_date)} />
                <Info
                  label="Durata"
                  value={course.duration_hours != null ? `${course.duration_hours} ore` : '—'}
                />
              </dl>
              <dl className="mt-4 border-t border-slate-100 pt-4">
                <Info
                  label="Note"
                  value={
                    course.notes ? (
                      <span className="whitespace-pre-line font-normal text-slate-700">{course.notes}</span>
                    ) : (
                      <span className="font-normal text-slate-400">Nessuna nota</span>
                    )
                  }
                />
              </dl>
            </div>
          )}
        </CollapsibleSection>

        {ROLE_SECTIONS.map((role) => {
          const list = peopleByType[role.type] ?? []
          const req = requirements.find((r) => r.type === role.type)
          const found = matches.people[role.type]?.length ?? 0
          const isStudent = role.type === 'student'
          return (
            <CollapsibleSection
              key={role.id}
              id={role.id}
              title={role.title}
              badge={
                searching
                  ? plural(found, 'trovato', 'trovati')
                  : req
                    ? `${list.length} / min. ${req.min}`
                    : `${list.length}`
              }
              badgeTone={req ? (req.ok ? 'ok' : 'warn') : list.length ? 'default' : 'warn'}
              summary={roleSummary(role.type, list, req)}
              open={isOpen(role.id)}
              onToggle={() => toggle(role.id)}
              dimmed={searching && !sectionHasMatch[role.id]}
            >
              {isStudent ? (
                <CoursePeople
                  courseId={id}
                  type="student"
                  fadShareChannels={false}
                  showTitle={false}
                  externalSearch={peopleSearch}
                  onChanged={() => void reloadStaff()}
                />
              ) : (
                <CoursePeople
                  courseId={id}
                  type={role.type}
                  takenPersonIds={staffTakenIds}
                  showStaffPoolHint={false}
                  fadShareChannels={false}
                  showTitle={false}
                  wide
                  externalSearch={peopleSearch}
                  onChanged={() => void reloadStaff()}
                />
              )}
            </CollapsibleSection>
          )
        })}

        <CollapsibleSection
          id="documenti"
          title="Documenti"
          badge={
            docs == null ? '' : searching ? plural(matches.docs.length, 'trovato', 'trovati') : `${docs.length}`
          }
          summary="Documenti allegati e generati; carica anche i verbali validi per più corsi"
          open={isOpen('documenti')}
          onToggle={() => toggle('documenti')}
          dimmed={searching && !sectionHasMatch.documenti}
        >
          <DocumentsPanel
            key={docsKey}
            mode="course"
            courseId={id}
            personNames={personNames}
            externalSearch={docSearch}
            showTitle={false}
            onLoaded={setDocs}
            onChanged={reloadReportLines}
          />
        </CollapsibleSection>

        <CollapsibleSection
          id="verbali"
          title="Verbali della Regione"
          badge={hasLines ? money(balance) : 'nessuno'}
          badgeTone={hasLines ? 'ok' : 'muted'}
          summary={
            hasLines
              ? `${plural(reportLines!.length, 'verbale letto', 'verbali letti')} · saldo da liquidare`
              : 'Importi letti dai verbali caricati nei documenti'
          }
          open={isOpen('verbali')}
          onToggle={() => toggle('verbali')}
          dimmed={searching && !sectionHasMatch.verbali}
        >
          {hasLines ? (
            <CourseReportLines
              courseId={id}
              lines={searching ? matches.lines : (reportLines ?? [])}
              showTitle={false}
            />
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
              Nessun verbale per questo corso. Caricalo da{' '}
              <button
                type="button"
                className="font-medium text-indigo-600 hover:underline"
                onClick={() => goTo('documenti')}
              >
                Documenti → Carica verbale / documento per più corsi
              </button>
              : gli importi compaiono qui.
            </p>
          )}
        </CollapsibleSection>

        <CollapsibleSection
          id="fatture"
          title="Note di debito e fatture"
          badge={
            invoiceRows == null
              ? ''
              : searching
                ? plural(matches.invoices.length, 'trovata', 'trovate')
                : invoiceRows.length
                  ? money(billing.billed)
                  : 'nessuna'
          }
          badgeTone={invoiceRows?.length ? 'ok' : 'muted'}
          summary="Note di debito alla Regione: genera dal verbale, storico, incassi"
          open={isOpen('fatture')}
          onToggle={() => toggle('fatture')}
          dimmed={searching && !sectionHasMatch.fatture}
        >
          {invoiceRows == null ? (
            <p className="text-sm text-slate-400">Caricamento…</p>
          ) : (
            <CourseInvoicesPanel
              course={course}
              reportLines={reportLines ?? NO_LINES}
              rows={invoiceRows}
              shownRows={searching ? matches.invoices : invoiceRows}
              onChanged={reloadInvoices}
            />
          )}
        </CollapsibleSection>

        <CollapsibleSection
          id="genera"
          title="Genera documenti"
          summary="Crea i documenti dai modelli per docenti, tutor, amministrativi o alunni"
          open={isOpen('genera')}
          onToggle={() => toggle('genera')}
          dimmed={searching && !sectionHasMatch.genera}
        >
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <SegmentedControl
                ariaLabel="Ruolo dei documenti"
                value={peopleType}
                onChange={setPeopleType}
                options={genRoles.map((role) => ({ value: role.type, label: role.label }))}
              />
              <SegmentedControl
                ariaLabel="Modalità di generazione"
                value={genMode}
                onChange={setGenMode}
                options={[
                  { value: 'bulk', label: 'In massa' },
                  { value: 'single', label: 'Singolo' },
                ]}
              />
            </div>
            {genMode === 'bulk' ? (
              <BulkGenerateDocumentsForm
                course={course}
                people={peopleByType[peopleType] ?? []}
                peopleType={peopleType}
                onGenerated={() => setDocsKey((n) => n + 1)}
              />
            ) : (
              <GenerateDocumentForm
                course={course}
                people={peopleByType[peopleType] ?? []}
                peopleType={peopleType}
                onGenerated={() => setDocsKey((n) => n + 1)}
              />
            )}
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          id="fad"
          title="FAD e credenziali"
          badge={students.length ? `${fadReady}/${students.length}` : ''}
          badgeTone={students.length && fadReady === students.length ? 'ok' : 'warn'}
          summary="Invio credenziali a alunni e personale, sincronizzazione con Moodle"
          open={isOpen('fad')}
          onToggle={() => toggle('fad')}
          dimmed={searching && !sectionHasMatch.fad}
        >
          <div className="space-y-4">
            <FadShareBulk
              peopleByType={peopleByType}
              courseLabel={courseLabel}
              externalSearch={peopleSearch}
            />
            <FadMoodleSync courseId={id} />
          </div>
        </CollapsibleSection>
      </div>
    </div>
  )
}

function roleSummary(
  type: PersonType,
  list: Person[],
  req: { min: number; ok: boolean; current: number } | undefined,
): string {
  if (type === 'student') {
    if (!list.length) return 'Nessun alunno iscritto'
    const fad = list.filter(hasCompleteFadCredentials).length
    return `${plural(list.length, 'alunno', 'alunni')} · ${fad} con credenziali FAD`
  }
  const names = list.map(fullName).join(', ')
  if (req && !req.ok) {
    const missing = req.min - req.current
    return `${missing === 1 ? 'Manca' : 'Mancano'} ancora ${missing}${names ? ` · ${names}` : ''}`
  }
  return names || 'Nessuno associato'
}

function shortRole(type: PersonType): string {
  if (type === 'admin_staff') return 'Amm.'
  return roleLabels[type] ?? type
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-slate-400">{label}</dt>
      <dd className="mt-1 break-words font-medium text-slate-800">{value}</dd>
    </div>
  )
}
