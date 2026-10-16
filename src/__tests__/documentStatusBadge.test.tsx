// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { DocumentStatusBadge } from '../components/DocumentStatusBadge'
import { checkStaffDocuments } from '../lib/studentDocumentStatus'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const person = { doc_type: "Carta d'identità", doc_number: 'CA123', doc_expiry_date: '2099-01-01' }

describe('stato documenti', () => {
  it('cliccando «Documenti mancanti» elenca cosa manca', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    act(() => {
      createRoot(el).render(
        <DocumentStatusBadge check={checkStaffDocuments(person, true, false)} personName="Manuel Basile" />,
      )
    })
    const button = el.querySelector('button')!
    expect(button.textContent).toBe('Documenti mancanti')
    act(() => button.click())
    const dialog = document.querySelector('[role="dialog"]')!
    expect(dialog.textContent).toContain('Cosa manca a Manuel Basile')
    expect(dialog.textContent).toContain('Curriculum assente')
    expect(dialog.textContent).not.toContain('File identità assente')
  })

  it('con i documenti in regola non è cliccabile', () => {
    const el = document.createElement('div')
    act(() => {
      createRoot(el).render(<DocumentStatusBadge check={checkStaffDocuments(person, true, true)} />)
    })
    expect(el.querySelector('button')).toBeNull()
    expect(el.textContent).toBe('Documenti ok')
  })
})
