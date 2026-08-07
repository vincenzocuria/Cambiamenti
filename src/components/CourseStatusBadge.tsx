import {
  courseStatusBadgeClass,
  courseStatusLabel,
  courseStatusMeta,
  isCourseStatus,
} from '../data/courseStatus'

export function CourseStatusBadge({ status }: { status: string | null | undefined }) {
  const label = courseStatusLabel(status)
  const title =
    status && isCourseStatus(status) ? courseStatusMeta[status].description : undefined
  return (
    <span
      title={title}
      className={
        'inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ' +
        courseStatusBadgeClass(status)
      }
    >
      {label}
    </span>
  )
}
