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
  /** Convenzione/decreto di finanziamento citato nei documenti (es. "Decreto n. 12595 del 08/09/2025"). */
  funding_decree: string
  /** Avviso/programma che finanzia il corso, citato nella lettera di incarico. */
  funding_program: string
  moodle_course_id: number | null
  moodle_bbb_id: number | null
  moodle_shortname: string
  created_at: string
  updated_at: string
}

export type CourseInput = Omit<
  Course,
  'id' | 'created_at' | 'updated_at' | 'moodle_course_id' | 'moodle_bbb_id' | 'moodle_shortname'
>

export interface CalendarEvent {
  id: string
  course_id: string | null
  title: string
  starts_at: string
  ends_at: string
  room: string
  notes: string
  external_uid: string
  moodle_event_id: number | null
  created_at: string
  updated_at: string
}

export type CalendarEventInput = Omit<
  CalendarEvent,
  'id' | 'created_at' | 'updated_at' | 'moodle_event_id'
>

/** Anagrafica o ruolo sul corso. `staff` = personale unificato; teacher/tutor/admin_staff = ruoli. */
export type PersonType = 'student' | 'staff' | 'teacher' | 'tutor' | 'admin_staff'

export type CourseStaffRole = 'teacher' | 'tutor' | 'admin_staff'

/** Dati dell'incarico di una figura su un corso (lettera di incarico). */
export interface CourseStaffAssignment {
  role: CourseStaffRole
  modules: string
  hours: number | null
  hourly_rate: number | null
}

/** Proprietario di un documento: anagrafiche corsi più i corsisti EIPASS privati. */
export type DocumentPersonType = PersonType | 'eipass'

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
  | 'certificate'
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
  person_type: DocumentPersonType | null
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

/** Corsista EIPASS privato: acquisto diretto della certificazione, fuori dai corsi. */
export interface EipassCandidate {
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
  doc_type: string
  doc_number: string
  doc_expiry_date: string | null
  certification: string
  purchase_date: string | null
  exam_done: boolean
  exam_date: string | null
  /** Totale pagato, IVA inclusa. */
  amount: number | null
  vat_rate: number
  payment_method: string
  payment_date: string | null
  invoice_status: EipassInvoiceStatus
  invoice_number: string
  invoice_date: string | null
  notes: string
  created_at: string
  updated_at: string
}

export type EipassInvoiceStatus = 'da_fatturare' | 'fatturato' | 'non_richiesta'

export type EipassCandidateInput = Omit<EipassCandidate, 'id' | 'created_at' | 'updated_at'>
