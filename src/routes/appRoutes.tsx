import { Navigate, Route, Routes } from 'react-router-dom'
import { Protected } from '../components/Protected'
import { Layout } from '../components/Layout'
import { LoginPage } from '../pages/LoginPage'
import { ResetPasswordPage } from '../pages/ResetPasswordPage'
import { PendingPage } from '../pages/PendingPage'
import { DashboardPage } from '../pages/DashboardPage'
import { CoursesPage } from '../pages/CoursesPage'
import { CourseDetailPage } from '../pages/CourseDetailPage'
import { PeopleListPage } from '../pages/PeopleListPage'
import { PersonDetailPage } from '../pages/PersonDetailPage'
import { UsersPage } from '../pages/UsersPage'
import { TemplatesPage } from '../pages/TemplatesPage'
import { TemplateEditPage } from '../pages/TemplateEditPage'
import { RedirectToPersonale } from './RedirectToPersonale'

function page(element: React.ReactNode, adminOnly = false) {
  return (
    <Protected adminOnly={adminOnly}>
      <Layout>{element}</Layout>
    </Protected>
  )
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/reimposta-password" element={<ResetPasswordPage />} />
      <Route path="/in-attesa" element={<PendingPage />} />
      <Route path="/" element={page(<DashboardPage />)} />
      <Route path="/corsi" element={page(<CoursesPage />)} />
      <Route path="/corsi/:id" element={page(<CourseDetailPage />)} />
      <Route path="/alunni" element={page(<PeopleListPage type="student" />)} />
      <Route path="/alunni/:id" element={page(<PersonDetailPage type="student" />)} />
      <Route path="/personale" element={page(<PeopleListPage type="staff" />)} />
      <Route path="/personale/:id" element={page(<PersonDetailPage type="staff" />)} />
      <Route path="/docenti" element={<Navigate to="/personale" replace />} />
      <Route path="/docenti/:id" element={<RedirectToPersonale />} />
      <Route path="/tutor" element={<Navigate to="/personale" replace />} />
      <Route path="/tutor/:id" element={<RedirectToPersonale />} />
      <Route path="/amministrativi" element={<Navigate to="/personale" replace />} />
      <Route path="/amministrativi/:id" element={<RedirectToPersonale />} />
      <Route path="/template" element={page(<TemplatesPage />)} />
      <Route path="/template/:id" element={page(<TemplateEditPage />)} />
      <Route path="/utenti" element={page(<UsersPage />, true)} />
    </Routes>
  )
}
