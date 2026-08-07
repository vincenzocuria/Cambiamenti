import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CourseStatusPipeline } from '../components/CourseStatusPipeline'
import { DashboardCourseList } from '../components/DashboardCourseList'
import {
  fetchActiveCourses,
  fetchCoursesToReport,
  fetchDashboardCounts,
  fetchIncompleteCourses,
  fetchPeopleCredentialAlerts,
  fetchUpcomingCourses,
  staffingGapsLabel,
  type DashboardCounts,
  type DashboardCourseRow,
  type IncompleteCourse,
  type PersonAlert,
} from '../services/dashboard'

const kpiCards: {
  key: keyof Pick<
    DashboardCounts,
    'inCorso' | 'prossimi' | 'daRendicontare' | 'esitoChiuso' | 'courses' | 'people'
  >
  label: string
  hint: string
  to: string
}[] = [
  {
    key: 'inCorso',
    label: 'In corso',
    hint: 'Formazione attiva',
    to: '/corsi',
  },
  {
    key: 'prossimi',
    label: 'Prossimi',
    hint: 'In attivazione',
    to: '/corsi',
  },
  {
    key: 'daRendicontare',
    label: 'Da rendicontare',
    hint: 'Finiti in attesa',
    to: '/corsi',
  },
  {
    key: 'esitoChiuso',
    label: 'Esito chiuso',
    hint: 'Ciclo completato',
    to: '/corsi',
  },
  {
    key: 'courses',
    label: 'Totale corsi',
    hint: 'Tutti gli step',
    to: '/corsi',
  },
  {
    key: 'people',
    label: 'Personale',
    hint: 'Figure in anagrafica',
    to: '/personale',
  },
]

export function DashboardPage() {
  const [counts, setCounts] = useState<DashboardCounts | null>(null)
  const [upcoming, setUpcoming] = useState<DashboardCourseRow[] | null>(null)
  const [active, setActive] = useState<DashboardCourseRow[] | null>(null)
  const [toReport, setToReport] = useState<DashboardCourseRow[] | null>(null)
  const [incomplete, setIncomplete] = useState<IncompleteCourse[] | null>(null)
  const [alerts, setAlerts] = useState<PersonAlert[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      fetchDashboardCounts(),
      fetchUpcomingCourses(),
      fetchActiveCourses(),
      fetchCoursesToReport(),
      fetchIncompleteCourses(),
      fetchPeopleCredentialAlerts(),
    ])
      .then(([c, next, running, report, courses, peopleAlerts]) => {
        setCounts(c)
        setUpcoming(next)
        setActive(running)
        setToReport(report)
        setIncomplete(courses)
        setAlerts(peopleAlerts)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Errore caricamento dashboard')
      })
  }, [])

  const missingEmail = alerts?.filter((a) => a.missing.includes('email')) ?? []
  const missingFad = alerts?.filter((a) => a.missing.includes('fad')) ?? []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          KPI e pipeline dei corsi Regione Calabria, fino all’esito chiuso.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {kpiCards.map((c) => (
          <Link
            key={c.key}
            to={c.to}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow"
          >
            <p className="text-sm font-medium text-slate-500">{c.label}</p>
            <p className="mt-2 text-3xl font-bold text-indigo-700">
              {counts ? counts[c.key] : '…'}
            </p>
            <p className="mt-1 text-xs text-slate-400">{c.hint}</p>
          </Link>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Pipeline corso</h2>
        <p className="mt-1 text-xs text-slate-500">
          Ogni corso attraversa questi step; l’obiettivo finale è Esito chiuso.
        </p>
        <div className="mt-3">
          <CourseStatusPipeline mode="legend" />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <DashboardCourseList
          title="Prossimi corsi"
          courses={upcoming}
          empty="Nessun corso in attivazione."
          dateKind="start"
        />
        <DashboardCourseList
          title="Corsi in corso"
          courses={active}
          empty="Nessun corso con formazione attiva."
          dateKind="end"
          tone="ok"
        />
        <DashboardCourseList
          title="Corsi da rendicontare"
          courses={toReport}
          empty="Nessun corso finito in attesa di rendicontazione."
          dateKind="end"
          tone="warn"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SummaryCard
          title="Organico incompleto"
          count={incomplete?.length}
          tone={incomplete && incomplete.length > 0 ? 'warn' : 'ok'}
          empty="Tutti i corsi hanno l’organico minimo."
        >
          {(incomplete ?? []).slice(0, 8).map((c) => (
            <li key={c.id}>
              <Link to={`/corsi/${c.id}`} className="font-medium text-indigo-600 hover:underline">
                {c.name}
                {c.edition ? ` · ${c.edition}` : ''}
              </Link>
              <p className="text-xs text-slate-500">{staffingGapsLabel(c.counts)}</p>
            </li>
          ))}
        </SummaryCard>

        <SummaryCard
          title="Senza email"
          count={missingEmail.length}
          tone={missingEmail.length > 0 ? 'warn' : 'ok'}
          empty="Tutte le figure hanno un’email."
        >
          {missingEmail.slice(0, 8).map((a) => (
            <AlertPersonRow key={`${a.kind}-${a.id}`} alert={a} />
          ))}
        </SummaryCard>

        <SummaryCard
          title="Credenziali FAD incomplete"
          count={missingFad.length}
          tone={missingFad.length > 0 ? 'warn' : 'ok'}
          empty="Email e password FAD compilate per tutti."
        >
          {missingFad.slice(0, 8).map((a) => (
            <AlertPersonRow key={`${a.kind}-${a.id}`} alert={a} />
          ))}
        </SummaryCard>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Accesso rapido</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <QuickLink to="/corsi" label="Gestisci corsi" />
          <QuickLink to="/personale" label="Personale e FAD" />
          <QuickLink to="/alunni" label="Alunni" />
          <QuickLink to="/template" label="Template documenti" />
        </div>
      </section>
    </div>
  )
}

function SummaryCard({
  title,
  count,
  tone,
  empty,
  children,
}: {
  title: string
  count: number | undefined
  tone: 'ok' | 'warn'
  empty: string
  children: ReactNode
}) {
  const loaded = count != null
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        <span
          className={
            'rounded-full px-2 py-0.5 text-xs font-semibold ' +
            (tone === 'warn' && loaded && count > 0
              ? 'bg-amber-50 text-amber-800'
              : 'bg-emerald-50 text-emerald-700')
          }
        >
          {loaded ? count : '…'}
        </span>
      </div>
      {!loaded ? (
        <p className="text-sm text-slate-400">Caricamento…</p>
      ) : count === 0 ? (
        <p className="text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="space-y-2 text-sm">{children}</ul>
      )}
      {loaded && count > 8 && (
        <p className="mt-3 text-xs text-slate-400">+ altre {count - 8}</p>
      )}
    </div>
  )
}

function AlertPersonRow({ alert }: { alert: PersonAlert }) {
  const to = alert.kind === 'student' ? `/alunni/${alert.id}` : `/personale/${alert.id}`
  return (
    <li>
      <Link to={to} className="font-medium text-indigo-600 hover:underline">
        {alert.name}
      </Link>
      <span className="ml-2 text-xs text-slate-400">
        {alert.kind === 'student' ? 'Alunno' : 'Personale'}
      </span>
    </li>
  )
}

function QuickLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
    >
      {label}
    </Link>
  )
}
