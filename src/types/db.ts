export type Role = 'superadmin' | 'admin' | 'staff' | 'pending'

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
  start_date: string | null
  end_date: string | null
  duration_hours: number | null
  created_at: string
  updated_at: string
}

export type CourseInput = Omit<Course, 'id' | 'created_at' | 'updated_at'>

export type PersonType = 'student' | 'teacher'

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
  iban: string
  bank_name: string
  bic: string
  doc_type: string
  doc_number: string
  doc_issued_by: string
  doc_issue_date: string | null
  doc_expiry_date: string | null
  notes: string
  created_at: string
  updated_at: string
}

export type PersonInput = Omit<Person, 'id' | 'created_at' | 'updated_at'>

export type DocumentCategory = 'identity' | 'module' | 'other'

export interface DocumentRow {
  id: string
  person_type: PersonType
  person_id: string
  course_id: string | null
  category: DocumentCategory
  file_name: string
  storage_path: string
  mime_type: string
  size_bytes: number
  uploaded_by: string | null
  created_at: string
}
