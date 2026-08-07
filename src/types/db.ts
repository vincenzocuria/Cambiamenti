import type { CourseStatus } from '../data/courseStatus'
import type { NotificationType } from '../lib/notificationTypes'

export type Role = 'superadmin' | 'admin' | 'staff' | 'pending'

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string
  link: string
  read_at: string | null
  created_at: string
}

export interface Profile {
  id: string
  email: string
  full_name: string
  role: Role
  created_at: string
}

export interface Course {
  id: string
  name: string
  edition: string
  code: string
  cup: string
  notes: string
  status: CourseStatus
  start_date: string | null
  end_date: string | null
  duration_hours: number | null
  created_at: string
  updated_at: string
}

export type CourseInput = Omit<Course, 'id' | 'created_at' | 'updated_at'>

/** Anagrafica o ruolo sul corso. `staff` = personale unificato; teacher/tutor/admin_staff = ruoli. */
export type PersonType = 'student' | 'staff' | 'teacher' | 'tutor' | 'admin_staff'

export type CourseStaffRole = 'teacher' | 'tutor' | 'admin_staff'

export interface Person {
  id: string
  first_name: string
  last_name: string
  birth_date: string | null
  birth_place: string
  tax_code: string
  gender: string
  address: string
  city: string
  postal_code: string
  province: string
  phone: string
  email: string
  fad_email: string
  fad_password: string
  iban: string
  bank_name: string
  bic: string
  doc_type: string
  doc_number: string
  doc_issued_by: string
  doc_issue_date: string | null
  doc_expiry_date: string | null
  notes: string
  /** Solo alunni: naspi | adi | sfl | cig | nessuno | '' */
  inps_benefit: string
  created_at: string
  updated_at: string
}

export type PersonInput = Omit<Person, 'id' | 'created_at' | 'updated_at'>

export type DocumentCategory =
  | 'identity'
  | 'module'
  | 'appointment'
  | 'curriculum'
  | 'other'
  | 'generated'

export type TemplatePersonRole =
  | 'none'
  | 'student'
  | 'staff'
  | 'teacher'
  | 'tutor'
  | 'admin_staff'
  | 'any'

export interface DocumentTemplate {
  id: string
  name: string
  description: string
  body: string
  requires_course: boolean
  person_role: TemplatePersonRole
  default_category: DocumentCategory
  created_at: string
  updated_at: string
}

export type DocumentTemplateInput = Omit<DocumentTemplate, 'id' | 'created_at' | 'updated_at'>

export interface DocumentRow {
  id: string
  person_type: PersonType | null
  person_id: string | null
  course_id: string | null
  category: DocumentCategory
  title: string
  template_id: string | null
  file_name: string
  storage_path: string
  mime_type: string
  size_bytes: number
  uploaded_by: string | null
  created_at: string
}
