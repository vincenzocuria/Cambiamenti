import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { Protected } from './components/Protected'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { PendingPage } from './pages/PendingPage'
import { DashboardPage } from './pages/DashboardPage'
import { CoursesPage } from './pages/CoursesPage'
import { CourseDetailPage } from './pages/CourseDetailPage'
import { PeopleListPage } from './pages/PeopleListPage'
import { PersonDetailPage } from './pages/PersonDetailPage'
import { UsersPage } from './pages/UsersPage'

function page(element: React.ReactNode, adminOnly = false) {
  return (
    <Protected adminOnly={adminOnly}>
      <Layout>{element}</Layout>
    </Protected>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/in-attesa" element={<PendingPage />} />
          <Route path="/" element={page(<DashboardPage />)} />
          <Route path="/corsi" element={page(<CoursesPage />)} />
          <Route path="/corsi/:id" element={page(<CourseDetailPage />)} />
          <Route path="/alunni" element={page(<PeopleListPage type="student" />)} />
          <Route path="/alunni/:id" element={page(<PersonDetailPage type="student" />)} />
          <Route path="/docenti" element={page(<PeopleListPage type="teacher" />)} />
          <Route path="/docenti/:id" element={page(<PersonDetailPage type="teacher" />)} />
          <Route path="/utenti" element={page(<UsersPage />, true)} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
