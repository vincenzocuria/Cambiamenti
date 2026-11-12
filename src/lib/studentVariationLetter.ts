import { school } from '../data/school'
import type { Course, Person } from '../types/db'
import type { EnrollmentInfo } from '../services/enrollments'

/** Una variazione da comunicare: ritiro, trasferimento in uscita/entrata o nuovo inserimento. */
export interface StudentVariation {
  person: Person
  kind: 'ritiro' | 'trasferimento_uscita' | 'trasferimento_entrata' | 'inserimento'
  /** Giorno da cui vale (ISO yyyy-mm-dd). */
  day: string
  note: string
  /** Corso di arrivo (uscita) o di provenienza (entrata). */
  otherCourse: { name: string; code: string; edition: string | null } | null
}

export interface RegionAddress {
  /** Destinatario, una riga per voce. */
  recipient: string
  /** Indirizzi PEC a cui inviare. */
  pecTo: string
  /** Testo dell'oggetto prima del titolo del percorso. */
  subjectPrefix: string
}

const GOL_RECIPIENT = [
  'Alla REGIONE CALABRIA',
  'Dipartimento “Lavoro”',
  'Settore 3 _ Lavoro e Politiche Attive',
  'E p c Settore 4_Formazione, Autoimpiego e Autoimprenditorialità',
  'PEC: accreditamento.formazione@pec.regione.calabria.it',
].join('\n')

/** Destinatari e oggetto come nelle comunicazioni già inviate, in base all'avviso del corso. */
export function regionAddressFor(course: Course): RegionAddress {
  const code = course.code?.trim() ?? ''
  if (code.startsWith('474') || /skills/i.test(course.funding_program ?? '')) {
    return {
      recipient: [
        'Alla REGIONE CALABRIA',
        'Dipartimento Lavoro, Imprese e Aree Produttive',
        'Settore 4 - Politiche Attive del Lavoro',
        'PEC: dipartimento.lavoro.imprese@pec.regione.calabria.it',
      ].join('\n'),
      pecTo: 'dipartimento.lavoro.imprese@pec.regione.calabria.it',
      subjectPrefix: `Comunicazione variazione allievi – Avviso «Skills for Green and Digital Transition» – PR Calabria FESR FSE+ 2021–2027, Azione 4.d.2${
        course.funding_decree ? ` – ${course.funding_decree}` : ''
      }${course.cup ? ` – CUP ${course.cup}` : ''}.`,
    }
  }
  if (code.startsWith('938') || /avviso\s*4|creazione di impresa/i.test(course.funding_program ?? '')) {
    return {
      recipient: GOL_RECIPIENT,
      pecTo: 'gol@pec.regione.calabria.it, accreditamento.formazione@pec.regione.calabria.it',
      subjectPrefix:
        'Comunicazione variazione allievi – Avviso Pubblico n. 4 per l’attuazione del Programma Garanzia Occupabilità dei Lavoratori da finanziare nell’ambito del Piano Nazionale di Ripresa e Resilienza (PNRR), Missione 5 “Inclusione e coesione”, Componente 1 "Politiche per il Lavoro”, Riforma 1.1 “Politiche Attive del Lavoro e Formazione”, finanziato dall’Unione Europea – Next Generation EU e finalizzato all’individuazione dei Soggetti Esecutori per la realizzazione della “Formazione per la creazione di impresa”.',
    }
  }
  return {
    recipient: GOL_RECIPIENT,
    pecTo: 'gol@pec.regione.calabria.it, accreditamento.formazione@pec.regione.calabria.it',
    subjectPrefix:
      'Comunicazione variazione allievi – Linee guida n. 4_ Avviso Pubblico n. 2 per la presentazione di proposte di Intervento per la Costituzione del Catalogo dell’Offerta Formativa Regionale per l’attuazione del Programma Garanzia Occupabilità dei Lavoratori da finanziare nell’ambito del Piano Nazionale di Ripresa e Resilienza (PNRR) Missione 5 “Inclusione e coesione” – Componente 1 "Politiche per il Lavoro” Riforma 1.1 “Politiche Attive del Lavoro e Formazione”.',
  }
}

export function editionNumber(edition: string | null | undefined): string {
  const m = /ED\.?\s*(\d+)/i.exec(edition ?? '')
  return m ? m[1] : (edition ?? '').trim()
}

/** «PERCORSO FORMATIVO “Nome” COD./ID N 673.7 EDIZIONE 1» */
export function courseTitle(c: { name: string; code: string; edition: string | null }): string {
  const parts = [`PERCORSO FORMATIVO “${c.name}”`]
  if (c.code) parts.push(`COD./ID N ${c.code}`)
  const ed = editionNumber(c.edition)
  if (ed) parts.push(`EDIZIONE ${ed}`)
  return parts.join(' ')
}

function itDay(day: string | null | undefined): string {
  if (!day) return ''
  const [y, m, d] = day.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

function esc(s: string | number | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function upperName(p: Person): string {
  return `${p.last_name} ${p.first_name}`.toUpperCase()
}

/** Frase della comunicazione per una variazione. */
export function variationSentence(v: StudentVariation): string {
  const f = v.person.gender === 'F'
  const who = `${f ? 'l’allieva' : 'l’allievo'} ${upperName(v.person)}${v.person.tax_code ? ` (C.F. ${v.person.tax_code})` : ''}`
  const day = itDay(v.day)
  const note = v.note.trim() ? ` (${v.note.trim().replace(/\.$/, '')})` : ''
  switch (v.kind) {
    case 'ritiro':
      return `${who} ha comunicato la propria rinuncia a seguire il corso e non lo frequenta a decorrere dal ${day}${note};`
    case 'trasferimento_uscita':
      return `${who} è stat${f ? 'a' : 'o'} trasferit${f ? 'a' : 'o'}, a decorrere dal ${day}, al ${
        v.otherCourse ? courseTitle(v.otherCourse) : 'percorso indicato'
      }${note};`
    case 'trasferimento_entrata':
      return `${who}, proveniente dal ${
        v.otherCourse ? courseTitle(v.otherCourse) : 'percorso indicato'
      }, è inserit${f ? 'a' : 'o'} nel presente percorso e frequenta in aula a decorrere dal ${day}${note};`
    case 'inserimento':
      return `${who} è inserit${f ? 'a' : 'o'} nel percorso e frequenta in aula a decorrere dal ${day}${note};`
  }
}

/**
 * Comunicazione alla Regione (lettera su carta intestata) con il Mod. 1/B
 * «Elenco allievi» aggiornato, pronta da stampare o salvare in PDF e firmare.
 */
export function variationLetterHtml(input: {
  course: Course
  variations: StudentVariation[]
  /** Alunni del corso dopo le variazioni, per il Mod. 1/B. */
  students: Person[]
  protocol: string
  date: string
  address: RegionAddress
  logoUrl: string
}): string {
  const { course, variations, students, protocol, date, address, logoUrl } = input
  const title = courseTitle(course)
  const rep = school.legalRepresentativeDetails
  const sentences = variations
    .map((v, i) => {
      const text = variationSentence(v)
      return `<li>${esc(i === variations.length - 1 ? text.replace(/;$/, '.') : text)}</li>`
    })
    .join('')
  const rows = [...students]
    .sort((a, b) => upperName(a).localeCompare(upperName(b), 'it'))
    .map(
      (p, i) =>
        `<tr><td class="n">${i + 1}</td><td>${esc(p.last_name.toUpperCase())}</td><td>${esc(
          p.first_name.toUpperCase(),
        )}</td><td>${esc(itDay(p.birth_date))}<br>${esc(p.birth_place)}</td><td>NON PREVISTO</td><td>${esc(
          p.tax_code,
        )}</td></tr>`,
    )
    .join('')
  const head = `<div class="head"><img src="${esc(logoUrl)}" alt="Cambia-Menti Formazione"></div>`

  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Comunicazione variazione allievi – ${esc(
    course.code,
  )} ${esc(course.edition)}</title><style>
body{font-family:Calibri,Arial,sans-serif;font-size:12.5px;line-height:1.45;color:#111;margin:0}
.page{max-width:760px;margin:24px auto;padding:0 28px}
.head{text-align:center;margin-bottom:14px}.head img{height:64px}
.prot{margin-bottom:14px}.to{margin-left:52%;white-space:pre-line;margin-bottom:18px}
.subj{text-align:justify;margin-bottom:14px}p{text-align:justify;margin:0 0 10px}
h2{text-align:center;font-size:14px;margin:12px 0}ul{margin:4px 0 12px 18px;padding:0}li{margin-bottom:6px;text-align:justify}
.sign{display:flex;justify-content:space-between;margin-top:34px}
table{border-collapse:collapse;width:100%;font-size:11.5px}th,td{border:1px solid #444;padding:4px 6px;vertical-align:top}
th{background:#eee}.n{text-align:right;width:28px}.break{page-break-before:always;break-before:page}
.mod{display:flex;justify-content:space-between;align-items:baseline}
@media print{.page{margin:0 auto;padding:10mm 12mm}}
</style></head><body>
<div class="page">
${head}
<div class="prot">Prot. ${esc(protocol || '____')} del ${esc(itDay(date))}</div>
<div class="to">${esc(address.recipient)}</div>
<div class="subj"><b>Oggetto:</b> ${esc(address.subjectPrefix)} ${esc(title)}.</div>
<p>Il sottoscritto ${esc(rep.name)} nato a ${esc(rep.birthPlace)} prov. (${esc(rep.birthProvince)}) il ${esc(
    rep.birthDate,
  )} Codice Fiscale ${esc(rep.taxCode)} in qualità di Legale rappresentante o soggetto con potere di firma dell’organismo di formazione denominato: ${esc(
    school.companyName.toUpperCase(),
  )} Codice Fiscale: ${esc(school.taxCode)} Partita IVA: ${esc(school.vatNumber)} con sede legale in ${esc(
    school.officialSeat,
  )} con sede operativa in ${esc(school.officialSeat)}, tel ${esc(school.phone.replace(/^\+39\s*/, '').replace(/\s/g, ''))}, mail ${esc(
    school.email,
  )}, pec ${esc(school.pec)}, accreditata ai sensi del Regolamento Regionale di cui alla DGR n. 335/2021 con ${esc(
    school.accreditation,
  )}, in riferimento al corso in oggetto,</p>
<h2>COMUNICA</h2>
<p>che:</p>
<ul>${sentences}</ul>
<p>Viene allegato alla presente:<br>– Mod. 1/B – Elenco nominativo allievi aggiornato al ${esc(itDay(date))}.</p>
<p>Cordiali Saluti</p>
<div class="sign"><div>${esc(school.city)}, ${esc(itDay(date))}</div><div>Il Legale rappresentante<br>${esc(
    rep.name,
  )}<br><br>______________________________</div></div>
</div>
<div class="page break">
${head}
<div class="mod"><b>Mod. 1/B</b><span>aggiornato al ${esc(itDay(date))}</span></div>
<h2>ELENCO ALLIEVI</h2>
<p style="text-align:center"><b>${esc(title)}</b></p>
<table><thead><tr><th>N.</th><th>Cognome</th><th>Nome</th><th>Data e luogo di nascita</th><th>Titolo di studio</th><th>Cod. Fiscale</th></tr></thead><tbody>${rows}</tbody></table>
<div class="sign"><div>${esc(school.city)}, ${esc(itDay(date))}</div><div>Timbro e firma<br><br>______________________________</div></div>
</div>
</body></html>`
}

/** Variazioni ricavate dallo stato delle iscrizioni del corso. */
export function courseVariations(people: Person[], enrollments: Map<string, EnrollmentInfo>): StudentVariation[] {
  const out: StudentVariation[] = []
  for (const person of people) {
    const e = enrollments.get(person.id)
    if (!e) continue
    if (e.status === 'ritirato' && e.left_on) {
      out.push({ person, kind: 'ritiro', day: e.left_on, note: e.status_note, otherCourse: null })
    } else if (e.status === 'trasferito' && e.left_on) {
      out.push({ person, kind: 'trasferimento_uscita', day: e.left_on, note: '', otherCourse: e.to_course })
    } else if (e.status === 'attivo' && e.enrolled_on) {
      out.push({
        person,
        kind: e.from_course ? 'trasferimento_entrata' : 'inserimento',
        day: e.enrolled_on,
        note: '',
        otherCourse: e.from_course,
      })
    }
  }
  return out.sort((a, b) => b.day.localeCompare(a.day))
}

