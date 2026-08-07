import { courseStatuses, courseStatusMeta, type CourseStatus } from '../data/courseStatus'

export function CourseStatusPipeline({
  status,
  mode = 'progress',
}: {
  /** Se `legend`, mostra tutti gli step senza evidenziare lo stato corrente. */
  status?: CourseStatus
  mode?: 'progress' | 'legend'
}) {
  const currentOrder = status ? courseStatusMeta[status].order : 0

  return (
    <ol className="flex flex-wrap gap-1.5">
      {courseStatuses.map((s) => {
        const meta = courseStatusMeta[s]
        if (mode === 'legend') {
          return (
            <li
              key={s}
              title={meta.description}
              className={'rounded-full px-2.5 py-1 text-[11px] font-medium ' + meta.badgeClass}
            >
              {meta.label}
            </li>
          )
        }
        const done = meta.order < currentOrder
        const current = s === status
        return (
          <li
            key={s}
            title={meta.description}
            className={
              'rounded-full px-2.5 py-1 text-[11px] font-medium ' +
              (current
                ? meta.badgeClass + ' ring-1 ring-current/20'
                : done
                  ? 'bg-slate-100 text-slate-600'
                  : 'bg-slate-50 text-slate-400')
            }
          >
            {meta.label}
          </li>
        )
      })}
    </ol>
  )
}
