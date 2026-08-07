import { Navigate, useParams } from 'react-router-dom'

/** Redirect vecchie rotte /docenti|/tutor|/amministrativi/:id → /personale/:id */
export function RedirectToPersonale() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={id ? `/personale/${id}` : '/personale'} replace />
}
