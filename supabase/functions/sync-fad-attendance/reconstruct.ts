/**
 * Ricostruisce dalle sole tracce di Moodle, per ogni giornata, quando è stata chiusa l'aula
 * e se ogni alunno era collegato fino alla chiusura.
 *
 * Moodle registra l'accesso a ogni ingresso, ma l'uscita solo se il browser dell'alunno torna
 * su Moodle. Quando il docente chiude l'aula per tutti, chi ha chiuso la scheda o l'app resta
 * senza uscita: per lui l'uscita coincide con la chiusura dell'aula.
 */
import type { FadLogEvent } from './reportCsv.ts'
import { romeDay } from './romeTime.ts'

export type ClosedSource = 'registrata' | 'ricostruita' | 'manuale' | 'non_determinabile'
export type AttendanceStatus = 'fino_chiusura' | 'uscito_prima' | 'assente' | 'da_verificare'
export type ExitSource = '' | 'log' | 'chiusura'

export interface FadStudent {
  id: string
  firstName: string
  lastName: string
  /** Primo giorno nel corso (trasferito da un altro corso); vuoto = dall'inizio. */
  fromDay?: string | null
  /** Primo giorno non più nel corso (ritirato o trasferito); vuoto = fino alla fine. */
  untilDay?: string | null
}

/** L'alunno fa parte del corso in quella giornata? */
export function enrolledOn(student: FadStudent, day: string): boolean {
  return (!student.fromDay || day >= student.fromDay) && (!student.untilDay || day < student.untilDay)
}

export interface SessionClosure {
  at: number | null
  source: ClosedSource
  note: string
  by: string
}

export interface StudentDay {
  studentId: string
  moodleName: string
  firstJoinAt: number | null
  exitAt: number | null
  exitSource: ExitSource
  status: AttendanceStatus
  minutes: number | null
  pauseMinutes: number
  joins: number
  /** Minuti tra l'uscita e la chiusura, per chi è uscito prima. */
  minutesBeforeClose: number | null
}

export interface FadDay {
  day: string
  closure: SessionClosure
  students: StudentDay[]
  /** Partecipanti non abbinati agli alunni del corso (docenti, tutor, amministratori). */
  others: { name: string; firstJoinAt: number; lastLeaveAt: number | null }[]
}

/** Una giornata conta come lezione se almeno questi alunni si collegano. */
export const MIN_STUDENTS_PER_DAY = 3
/** Tolleranza attorno all'ora di chiusura. */
export const CLOSE_TOLERANCE_MS = 5 * 60_000
/** Uscite entro questo tempo l'una dall'altra fanno parte dello stesso gruppo. */
const GROUP_GAP_MS = 2 * 60_000
/** Chi esce e rientra entro questo tempo stava facendo una pausa. */
const REJOIN_WINDOW_MS = 30 * 60_000
/** La chiusura si cerca almeno un'ora dopo il primo ingresso degli alunni. */
const MIN_LESSON_MS = 60 * 60_000

const hhmm = (ms: number) =>
  new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(ms))

/** Nome normalizzato senza accenti e indipendente dall'ordine nome/cognome. */
export function nameKey(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ')
}

/** Ora di chiusura dell'aula in una giornata. */
export function findClosure(events: FadLogEvent[], studentNames: Set<string>): SessionClosure {
  const studentJoins = events
    .filter((e) => e.kind === 'join' && studentNames.has(nameKey(e.userName)))
    .map((e) => e.at)
  const floor = studentJoins.length ? Math.min(...studentJoins) + MIN_LESSON_MS : 0

  const leaves = events.filter((e) => e.kind === 'leave')
  const groups: FadLogEvent[][] = []
  let cur: FadLogEvent[] = []
  for (const e of leaves) {
    if (cur.length && e.at - cur[cur.length - 1].at > GROUP_GAP_MS) {
      groups.push(cur)
      cur = []
    }
    cur.push(e)
  }
  if (cur.length) groups.push(cur)

  const candidates: SessionClosure[] = []
  for (const e of events) {
    if (e.kind === 'end' && e.at >= floor) {
      candidates.push({
        at: e.at,
        source: 'registrata',
        note: 'Evento Moodle «Termine forzato della riunione»',
        by: e.userName,
      })
    }
  }
  for (const g of groups) {
    const who = new Set(g.map((e) => nameKey(e.userName)))
    const people = who.size
    // Una pausa, non la chiusura: la maggior parte di chi esce rientra entro poco
    const groupEnd = g[g.length - 1].at
    const back = new Set(
      events
        .filter((e) => e.kind === 'join' && e.at > groupEnd && e.at <= groupEnd + REJOIN_WINDOW_MS)
        .map((e) => nameKey(e.userName))
        .filter((k) => who.has(k)),
    )
    if (back.size * 2 > people) continue
    if (people >= 3 && g[0].at >= floor) {
      candidates.push({
        at: g[0].at,
        source: 'ricostruita',
        note: `${people} partecipanti escono insieme (${hhmm(g[0].at)}–${hhmm(g[g.length - 1].at)})`,
        by: '',
      })
    }
  }
  if (candidates.length) {
    candidates.sort((a, b) => a.at! - b.at!)
    const first = candidates[0]
    // Un termine forzato a ridosso del gruppo di uscite è la prova più precisa
    const forced = candidates.find(
      (c) => c.source === 'registrata' && Math.abs(c.at! - first.at!) <= GROUP_GAP_MS,
    )
    return forced ?? first
  }

  // Ultime uscite della giornata senza ingressi dopo
  const tail: FadLogEvent[] = []
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]
    if (e.kind === 'join') break
    if (e.kind === 'leave') tail.unshift(e)
  }
  const tailPeople = new Set(tail.map((e) => nameKey(e.userName))).size
  if (tailPeople >= 2) {
    return {
      at: tail[0].at,
      source: 'ricostruita',
      note: `Ultime uscite della giornata (${tailPeople} partecipanti, nessun ingresso dopo)`,
      by: '',
    }
  }

  const staffLeaves = leaves.filter((e) => !studentNames.has(nameKey(e.userName)) && e.at >= floor)
  if (staffLeaves.length) {
    const last = staffLeaves[staffLeaves.length - 1]
    return {
      at: last.at,
      source: 'ricostruita',
      note: 'Uscita del docente/tutor (unico riferimento nei log)',
      by: last.userName,
    }
  }
  return { at: null, source: 'non_determinabile', note: 'Nessun segnale di fine lezione nei log', by: '' }
}

interface Span {
  from: number
  to: number | null
}

function spansOf(events: FadLogEvent[]): Span[] {
  const spans: Span[] = []
  let open: number | null = null
  for (const e of events) {
    if (e.kind === 'join') {
      if (open === null) open = e.at
    } else if (e.kind === 'leave' && open !== null) {
      spans.push({ from: open, to: e.at })
      open = null
    }
  }
  if (open !== null) spans.push({ from: open, to: null })
  return spans
}

/** Esito di un alunno in una giornata, data l'ora di chiusura. */
export function studentDay(
  student: FadStudent,
  events: FadLogEvent[],
  closeAt: number | null,
): StudentDay {
  const joins = events.filter((e) => e.kind === 'join')
  const base: StudentDay = {
    studentId: student.id,
    moodleName: events[0]?.userName ?? '',
    firstJoinAt: joins[0]?.at ?? null,
    exitAt: null,
    exitSource: '',
    status: 'assente',
    minutes: null,
    pauseMinutes: 0,
    joins: joins.length,
    minutesBeforeClose: null,
  }
  if (!joins.length) return base

  const spans = spansOf(events)
  const pauses: number[] = []
  for (let i = 0; i + 1 < spans.length; i++) {
    const gapFrom = spans[i].to!
    if (closeAt === null || gapFrom < closeAt - CLOSE_TOLERANCE_MS) pauses.push(spans[i + 1].from - gapFrom)
  }
  base.pauseMinutes = Math.round(pauses.reduce((a, b) => a + b, 0) / 60_000)

  if (closeAt === null) return { ...base, status: 'da_verificare' }

  const atClose = spans.filter(
    (s) => s.from <= closeAt + CLOSE_TOLERANCE_MS && (s.to === null || s.to >= closeAt - CLOSE_TOLERANCE_MS),
  )
  let exitAt: number
  let exitSource: ExitSource
  let status: AttendanceStatus
  let minutesBeforeClose: number | null = null
  if (atClose.length) {
    const s = atClose[atClose.length - 1]
    if (s.to !== null && s.to <= closeAt + 15 * 60_000) {
      exitAt = s.to
      exitSource = 'log'
    } else {
      exitAt = closeAt
      exitSource = 'chiusura'
    }
    status = 'fino_chiusura'
  } else {
    const before = spans.filter((s) => s.to !== null && s.to < closeAt - CLOSE_TOLERANCE_MS)
    if (!before.length || spans.some((s) => s.from >= closeAt)) {
      return { ...base, status: 'da_verificare' }
    }
    exitAt = before[before.length - 1].to!
    exitSource = 'log'
    status = 'uscito_prima'
    minutesBeforeClose = Math.round((closeAt - exitAt) / 60_000)
  }

  let ms = 0
  for (const s of spans) {
    const end = Math.min(s.to ?? exitAt, exitAt)
    if (end > s.from) ms += end - s.from
  }
  return {
    ...base,
    exitAt,
    exitSource,
    status,
    minutes: Math.round(ms / 60_000),
    minutesBeforeClose,
  }
}

function tokens(name: string): string[] {
  return nameKey(name).split(' ').filter(Boolean)
}

/**
 * Nomi scritti in modo diverso tra Moodle e gestionale (es. «Maria Antonia» / «Mariantonia»):
 * se il cognome compare per intero e un solo alunno del corso ha quel cognome e un nome con le
 * stesse prime 4 lettere, gli eventi vengono attribuiti a quell'alunno.
 */
export function withStudentAliases(
  events: FadLogEvent[],
  students: FadStudent[],
  studentNames: Set<string>,
): FadLogEvent[] {
  const alias = new Map<string, string>()
  for (const userName of new Set(events.map((e) => e.userName))) {
    const key = nameKey(userName)
    if (!key || studentNames.has(key)) continue
    const t = tokens(userName)
    const hits = students.filter((s) => {
      const last = tokens(s.lastName)
      if (!last.length || !last.every((x) => t.includes(x))) return false
      const rest = t.filter((x) => !last.includes(x))
      const first = tokens(s.firstName)[0] ?? ''
      return first.length >= 4 && rest.some((x) => x.slice(0, 4) === first.slice(0, 4))
    })
    if (hits.length === 1) alias.set(userName, `${hits[0].firstName} ${hits[0].lastName}`)
  }
  if (!alias.size) return events
  return events.map((e) => (alias.has(e.userName) ? { ...e, userName: alias.get(e.userName)! } : e))
}

/**
 * Tutte le giornate FAD di un corso.
 * `closureOverrides` contiene le chiusure corrette a mano (giorno → istante).
 */
export function reconstructCourse(
  events: FadLogEvent[],
  students: FadStudent[],
  closureOverrides: Map<string, number | null> = new Map(),
): FadDay[] {
  const byKey = new Map<string, FadStudent>()
  for (const s of students) byKey.set(nameKey(`${s.firstName} ${s.lastName}`), s)
  const studentNames = new Set(byKey.keys())
  events = withStudentAliases(events, students, studentNames)

  const byDay = new Map<string, FadLogEvent[]>()
  for (const e of [...events].sort((a, b) => a.at - b.at || (a.kind === 'end' ? -1 : 0))) {
    const day = romeDay(e.at)
    const list = byDay.get(day) ?? []
    list.push(e)
    byDay.set(day, list)
  }

  const days: FadDay[] = []
  for (const [day, list] of [...byDay].sort(([a], [b]) => a.localeCompare(b))) {
    const joinedStudents = new Set(
      list.filter((e) => e.kind === 'join' && studentNames.has(nameKey(e.userName))).map((e) => nameKey(e.userName)),
    )
    if (joinedStudents.size < MIN_STUDENTS_PER_DAY) continue

    let closure = findClosure(list, studentNames)
    if (closureOverrides.has(day)) {
      const at = closureOverrides.get(day) ?? null
      closure = { at, source: at === null ? 'non_determinabile' : 'manuale', note: 'Ora indicata a mano', by: '' }
    }

    const perPerson = new Map<string, FadLogEvent[]>()
    for (const e of list) {
      if (e.kind === 'end') continue
      const k = nameKey(e.userName)
      const l = perPerson.get(k) ?? []
      l.push(e)
      perPerson.set(k, l)
    }

    const studentsOut = students.filter((s) => enrolledOn(s, day)).map((s) =>
      studentDay(s, perPerson.get(nameKey(`${s.firstName} ${s.lastName}`)) ?? [], closure.at),
    )
    const others: FadDay['others'] = []
    for (const [k, l] of perPerson) {
      if (studentNames.has(k)) continue
      const firstJoin = l.find((e) => e.kind === 'join')
      if (!firstJoin) continue
      const leaves = l.filter((e) => e.kind === 'leave')
      others.push({
        name: l[0].userName,
        firstJoinAt: firstJoin.at,
        lastLeaveAt: leaves.length ? leaves[leaves.length - 1].at : null,
      })
    }
    days.push({ day, closure, students: studentsOut, others })
  }
  return days
}
