import { describe, expect, it } from 'vitest'
import { decodeContent, panelDate } from '../../scripts/aruba-sync/panelApi'

describe('pannello Aruba', () => {
  it('legge le date del pannello come giorno italiano', () => {
    expect(panelDate('2026-10-21')).toBe('2026-10-21')
    expect(panelDate('2026-10-21T00:00:00')).toBe('2026-10-21')
    // Mezzanotte italiana scritta in UTC: resta il 21
    expect(panelDate('2026-10-20T22:00:00Z')).toBe('2026-10-21')
    expect(panelDate('')).toBe('')
  })

  it('decodifica il contenuto base64 o XML in chiaro', () => {
    const xml = '<?xml version="1.0"?><a/>'
    const b64 = Buffer.from(xml).toString('base64')
    expect(new TextDecoder().decode(decodeContent(b64))).toBe(xml)
    expect(new TextDecoder().decode(decodeContent(`data:application/octet-stream;base64,${b64}`))).toBe(xml)
    expect(new TextDecoder().decode(decodeContent(xml))).toBe(xml)
  })
})
