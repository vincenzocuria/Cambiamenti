import { staffingOk, staffingRequirements, type CourseStaffingCounts } from '../data/courseStaffing'

export function CourseStaffingStatus({ counts }: { counts: CourseStaffingCounts }) {
  const reqs = staffingRequirements(counts)
  const ok = staffingOk(counts)

  return (
    <div
      className={
        'rounded-xl border p-4 ' +
        (ok ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50')
      }
    >
      <p className={`text-sm font-semibold ${ok ? 'text-emerald-800' : 'text-amber-800'}`}>
        {ok ? 'Organico corso completo' : 'Organico corso incompleto'}
      </p>
      <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-3">
        {reqs.map((r) => (
          <li key={r.type} className={r.ok ? 'text-emerald-700' : 'text-amber-800'}>
            {r.label}: {r.current}/{r.min} min.
          </li>
        ))}
      </ul>
      {!ok && (
        <p className="mt-2 text-xs text-amber-700">
          Ogni corso richiede almeno 1 docente, 1 tutor e 3 figure amministrative.
        </p>
      )}
    </div>
  )
}
