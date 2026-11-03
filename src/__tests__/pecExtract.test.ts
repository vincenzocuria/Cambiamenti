// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { cleanSubject, isReceiptSubject, parsePec, storageMime } from '../../scripts/pec-sync/extract'

function b64(buf: Buffer): string {
  return buf.toString('base64').replace(/.{76}/g, '$&\r\n')
}

/** PEC come la consegna Aruba: busta con daticert.xml + postacert.eml che contiene l'originale. */
function pecEml(pdf: Buffer): string {
  const inner = [
    'From: dipartimento.lavoro.imprese@pec.regione.calabria.it',
    'To: cambiamentisrl@pec.it',
    'Subject: Invio protocollo n. 526230 del 23/06/2026',
    'Date: Tue, 23 Jun 2026 10:00:00 +0200',
    'Message-ID: <orig-1@regione>',
    'MIME-Version: 1.0',
    'Content-Type: multipart/mixed; boundary="IN"',
    '',
    '--IN',
    'Content-Type: text/plain; charset=utf-8',
    '',
    'Si trasmette la nota in allegato.',
    '--IN',
    'Content-Type: application/pdf; name="nota.pdf"',
    'Content-Disposition: attachment; filename="nota.pdf"',
    'Content-Transfer-Encoding: base64',
    '',
    b64(pdf),
    '--IN--',
    '',
  ].join('\r\n')
  return [
    'From: "Per conto di: dipartimento" <posta-certificata@pec.aruba.it>',
    'To: cambiamentisrl@pec.it',
    'Subject: POSTA CERTIFICATA: Invio protocollo n. 526230 del 23/06/2026',
    'Date: Tue, 23 Jun 2026 10:00:05 +0200',
    'MIME-Version: 1.0',
    'Content-Type: multipart/mixed; boundary="OUT"',
    '',
    '--OUT',
    'Content-Type: text/plain; charset=utf-8',
    '',
    'Messaggio di posta certificata',
    '--OUT',
    'Content-Type: application/xml; name="daticert.xml"',
    'Content-Disposition: attachment; filename="daticert.xml"',
    '',
    '<postacert/>',
    '--OUT',
    'Content-Type: message/rfc822; name="postacert.eml"',
    'Content-Disposition: attachment; filename="postacert.eml"',
    '',
    inner,
    '--OUT--',
    '',
  ].join('\r\n')
}

describe('lettura PEC', () => {
  it('apre la busta Aruba, pulisce l’oggetto e legge il testo del PDF', async () => {
    const pdf = readFileSync(new URL('./fixtures/minimal.pdf', import.meta.url))
    const pec = await parsePec(Buffer.from(pecEml(pdf)))
    expect(pec.subject).toBe('Invio protocollo n. 526230 del 23/06/2026')
    expect(pec.from).toBe('dipartimento.lavoro.imprese@pec.regione.calabria.it')
    expect(pec.text).toContain('nota in allegato')
    expect(pec.isReceipt).toBe(false)
    expect(pec.attachments.map((a) => a.fileName)).toEqual(['nota.pdf'])
    expect(pec.attachments[0].text).toContain('Adempimenti conclusivi')
  })

  it('riconosce le ricevute e i tipi di file', () => {
    expect(isReceiptSubject('ACCETTAZIONE: Richiesta vidimazione')).toBe(true)
    expect(isReceiptSubject('CONSEGNA: Richiesta vidimazione')).toBe(true)
    expect(isReceiptSubject('POSTA CERTIFICATA: Decreto')).toBe(false)
    expect(cleanSubject('POSTA CERTIFICATA:  Decreto   11091')).toBe('Decreto 11091')
    expect(storageMime('Decreto.PDF')).toBe('application/pdf')
    expect(storageMime('strano.xyz')).toBe('application/octet-stream')
  })
})
