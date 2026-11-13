import { describe, expect, it } from 'vitest'
import { parseReportLog } from '../../supabase/functions/sync-fad-attendance/reportCsv'
import { parseMoodleDateTime, romeDay } from '../../supabase/functions/sync-fad-attendance/romeTime'
import { lessonEntry, nameKey, reconstructCourse, withStudentAliases } from '../../supabase/functions/sync-fad-attendance/reconstruct'
import { eventsForSessions, exportableSessions, periodText, romeIso, romeTime } from '../lib/fadAttendance'
import type { FadSessionWithRows } from '../services/fadAttendance'
import type { FadLogEventRow } from '../types/db'

const HEAD =
  'Data/Ora,"Nome completo dell\'utente","Utente coinvolto","Contesto dell\'evento",Componente,Evento,Descrizione,Origine,"Indirizzo IP"'

function row(time: string, name: string, kind: 'join' | 'leave' | 'end', uid: number) {
  const desc =
    kind === 'join'
      ? `The user with id '${uid}' has joined a bigbluebutton meeting for the bigbluebuttonbn activity with id '11' for the course id '12'.`
      : kind === 'leave'
        ? `The user with id '${uid}' has left a bigbluebutton meeting for the bigbluebuttonbn activity with id '11' for the course id '12'.`
        : `A bigbluebutton meeting for the bigbluebuttonbn activity with id '11' for the course id '12' has been forcibly ended by the user with id '${uid}'.`
  const evento =
    kind === 'join' ? 'Accesso alla riunione' : kind === 'leave' ? 'Abbandono della riunione' : 'Termine forzato della riunione'
  return `"13/03/26, ${time}","${name}",-,"BigBlueButton: Aula Corso",BigBlueButton,"${evento}","${desc}",web,1.2.3.4`
}

const students = [
  { id: 'a', firstName: 'Elisa', lastName: 'Ginese' },
  { id: 'b', firstName: 'Sandra', lastName: 'Godino' },
  { id: 'c', firstName: 'Irene', lastName: 'Gatto' },
  { id: 'd', firstName: 'Paola', lastName: 'Figola' },
  { id: 'e', firstName: 'Rosina', lastName: 'Pignataro' },
]

describe('orari Moodle', () => {
  it('converte l’ora di Roma in UTC (ora solare e legale)', () => {
    expect(new Date(parseMoodleDateTime('13/03/26, 16:00:21')!).toISOString()).toBe('2026-03-13T15:00:21.000Z')
    expect(new Date(parseMoodleDateTime('12/06/26, 08:49:13')!).toISOString()).toBe('2026-06-12T06:49:13.000Z')
    expect(romeDay(Date.parse('2026-03-12T23:30:00Z'))).toBe('2026-03-13')
  })

  it('ora locale ↔ ISO per le correzioni a mano', () => {
    const iso = romeIso('2026-03-13', '16:00')!
    expect(iso).toBe('2026-03-13T15:00:00.000Z')
    expect(romeTime(iso)).toBe('16:00:00')
    expect(romeIso('2026-03-13', '25:00')).toBeNull()
  })

  it('abbina nomi scritti in modo diverso solo se il caso è univoco', () => {
    const st = [
      { id: 'x', firstName: 'Mariantonia', lastName: 'Buonofiglio' },
      { id: 'y', firstName: 'Natale', lastName: 'Scarpello' },
    ]
    const ev = (userName: string) => ({ key: userName, at: 0, kind: 'join' as const, moodleUserId: 1, userName, description: '', ip: '' })
    const out = withStudentAliases([ev('MARIA ANTONIA BUONOFIGLIO'), ev('Marco Busa')], st, new Set(st.map((s) => nameKey(`${s.firstName} ${s.lastName}`))))
    expect(out.map((e) => e.userName)).toEqual(['Mariantonia Buonofiglio', 'Marco Busa'])
  })

  it('confronta i nomi senza accenti e in qualsiasi ordine', () => {
    expect(nameKey('Malfarà Pina')).toBe(nameKey('PINA MALFARA'))
  })
})

describe('ricostruzione presenze', () => {
  const csv = [
    HEAD,
    row('12:01:00', 'Elisa Ginese', 'join', 1),
    row('12:02:00', 'Sandra Godino', 'join', 2),
    row('12:03:00', 'Irene Gatto', 'join', 3),
    row('12:04:00', 'Paola Figola', 'join', 4),
    row('12:05:00', 'Leonardo Fortunato', 'join', 9),
    // Gatto esce e rientra: pausa di 10 minuti
    row('13:00:00', 'Irene Gatto', 'leave', 3),
    row('13:10:00', 'Irene Gatto', 'join', 3),
    // Figola esce un'ora prima
    row('15:00:00', 'Paola Figola', 'leave', 4),
    row('16:00:21', 'System Administrator', 'end', 2),
    row('16:00:31', 'Leonardo Fortunato', 'leave', 9),
    row('16:00:34', 'Elisa Ginese', 'leave', 1),
    row('16:00:40', 'Irene Gatto', 'leave', 3),
    // Godino non ha uscita: aveva chiuso la scheda
  ].join('\n')

  const events = parseReportLog(csv)

  it('legge solo gli eventi BigBlueButton con chiave unica', () => {
    expect(events).toHaveLength(12)
    expect(new Set(events.map((e) => e.key)).size).toBe(12)
    expect(events.find((e) => e.kind === 'end')?.moodleUserId).toBe(2)
  })

  it('usa il termine forzato come chiusura e completa le uscite mancanti', () => {
    const [day] = reconstructCourse(events, students)
    expect(day.day).toBe('2026-03-13')
    expect(day.closure.source).toBe('registrata')
    expect(romeTime(new Date(day.closure.at!).toISOString())).toBe('16:00:21')

    const by = Object.fromEntries(day.students.map((s) => [s.studentId, s]))
    expect(by.a).toMatchObject({ status: 'fino_chiusura', exitSource: 'log' })
    expect(by.b).toMatchObject({ status: 'fino_chiusura', exitSource: 'chiusura', minutes: 238 })
    expect(by.c).toMatchObject({ status: 'fino_chiusura', pauseMinutes: 10 })
    expect(by.d).toMatchObject({ status: 'uscito_prima', minutesBeforeClose: 60 })
    expect(by.e).toMatchObject({ status: 'assente' })
    expect(day.others.map((o) => o.name)).toEqual(['Leonardo Fortunato'])
  })

  it('senza termine forzato usa le uscite simultanee', () => {
    const noEnd = events.filter((e) => e.kind !== 'end')
    const [day] = reconstructCourse(noEnd, students)
    expect(day.closure.source).toBe('ricostruita')
    expect(romeTime(new Date(day.closure.at!).toISOString())).toBe('16:00:31')
    expect(day.students.find((s) => s.studentId === 'b')?.status).toBe('fino_chiusura')
  })

  it('ignora le uscite di gruppo seguite da rientro (pausa)', () => {
    const pause = [
      HEAD,
      row('12:01:00', 'Elisa Ginese', 'join', 1),
      row('12:02:00', 'Sandra Godino', 'join', 2),
      row('12:03:00', 'Irene Gatto', 'join', 3),
      row('13:31:00', 'Elisa Ginese', 'leave', 1),
      row('13:31:20', 'Sandra Godino', 'leave', 2),
      row('13:31:40', 'Irene Gatto', 'leave', 3),
      row('13:40:00', 'Elisa Ginese', 'join', 1),
      row('13:41:00', 'Sandra Godino', 'join', 2),
      row('16:01:05', 'Elisa Ginese', 'leave', 1),
      row('16:01:10', 'Sandra Godino', 'leave', 2),
    ].join('\n')
    const [day] = reconstructCourse(parseReportLog(pause), students)
    expect(romeTime(new Date(day.closure.at!).toISOString())).toBe('16:01:05')
    expect(day.students.find((s) => s.studentId === 'c')?.status).toBe('uscito_prima')
  })

  it('collegata da due schede: l’ultima uscita vale; un rientro dopo la lezione non la rende «da verificare»', () => {
    const tabs = [
      HEAD,
      row('12:01:00', 'Elisa Ginese', 'join', 1),
      row('12:02:00', 'Sandra Godino', 'join', 2),
      row('12:03:00', 'Irene Gatto', 'join', 3),
      row('12:04:00', 'Paola Figola', 'join', 4),
      // Figola apre una seconda scheda, ne chiude una e resta nell'aula fino alla fine
      row('14:00:00', 'Paola Figola', 'join', 4),
      row('14:00:20', 'Paola Figola', 'leave', 4),
      row('16:00:21', 'System Administrator', 'end', 2),
      row('16:00:40', 'Paola Figola', 'leave', 4),
      // e rientra brevemente nel pomeriggio, a lezione finita
      row('18:52:00', 'Paola Figola', 'join', 4),
      row('18:52:40', 'Paola Figola', 'leave', 4),
    ].join('\n')
    const [day] = reconstructCourse(parseReportLog(tabs), students)
    expect(day.students.find((s) => s.studentId === 'd')).toMatchObject({ status: 'fino_chiusura', exitSource: 'log', minutes: 237 })
  })

  it('con più ingressi conta quello più vicino all’inizio della lezione', () => {
    expect(lessonEntry([10, 50, 90], 60)).toBe(50)
    expect(lessonEntry([70, 90], 60)).toBe(70)
    expect(lessonEntry([10, 50], null)).toBe(10)
    expect(lessonEntry([], 60)).toBeNull()
  })

  it('nel registro restano ritirati, trasferiti e non ancora iscritti, senza contare presenze', () => {
    const windowed = students.map((s) =>
      s.id === 'a'
        ? { ...s, untilDay: '2026-03-13', leftAs: 'trasferito' as const, leftNote: 'Trasferito a 474 ED2 dal 13/03/2026' }
        : s.id === 'b'
          ? { ...s, fromDay: '2026-03-14', enteredNote: 'Nel corso dal 14/03/2026' }
          : s.id === 'c'
            ? { ...s, untilDay: '2026-03-01', leftAs: 'ritirato' as const, leftNote: 'Ritirato dal 01/03/2026' }
            : s,
    )
    const [day] = reconstructCourse(events, windowed)
    const by = Object.fromEntries(day.students.map((s) => [s.studentId, s]))
    expect(day.students).toHaveLength(5)
    expect(by.a).toMatchObject({ status: 'trasferito', minutes: null, note: 'Trasferito a 474 ED2 dal 13/03/2026' })
    expect(by.b).toMatchObject({ status: 'non_iscritto', note: 'Nel corso dal 14/03/2026' })
    expect(by.c).toMatchObject({ status: 'ritirato' })
    expect(by.d.status).toBe('uscito_prima')
  })

  it('una chiusura indicata a mano prevale', () => {
    const at = Date.parse('2026-03-13T14:45:00Z') // 15:45 a Roma: Figola è uscita alle 15:00, oltre la tolleranza
    const [day] = reconstructCourse(events, students, new Map([['2026-03-13', at]]))
    expect(day.closure.source).toBe('manuale')
    expect(day.students.find((s) => s.studentId === 'd')?.status).toBe('uscito_prima')
  })
})

describe('esportazioni parziali', () => {
  const ses = (day: string, excluded = false) => ({ day, excluded, rows: [] }) as unknown as FadSessionWithRows
  const all = [ses('2026-03-04'), ses('2026-03-05', true), ses('2026-03-06'), ses('2026-03-10')]

  it('toglie le giornate escluse e quelle fuori periodo', () => {
    expect(exportableSessions(all).map((s) => s.day)).toEqual(['2026-03-04', '2026-03-06', '2026-03-10'])
    const part = exportableSessions(all, { from: '2026-03-05', to: '2026-03-08' })
    expect(part.map((s) => s.day)).toEqual(['2026-03-06'])
    expect(periodText(exportableSessions(all))).toBe('dal 04/03/2026 al 10/03/2026')
    expect(periodText(part)).toBe('del 06/03/2026')
  })

  it('tiene solo i log delle giornate esportate (ora di Roma)', () => {
    const ev = (at: string) => ({ occurred_at: at }) as FadLogEventRow
    const kept = eventsForSessions([ev('2026-03-05T23:30:00Z'), ev('2026-03-04T10:00:00Z')], [ses('2026-03-06')])
    expect(kept).toHaveLength(1)
  })
})
