// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabase', () => ({ supabase: {} }))

import { DashboardPayments } from '../components/DashboardPayments'
import { summarizeCoursePayments } from '../lib/paymentsSummary'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('DashboardPayments', () => {
  it('mostra i quattro KPI e i corsi aperti', () => {
    const rows = summarizeCoursePayments(
      [{ id: 'c1', name: 'Eipass Progressive', edition: 'ED1 - 2025', status: 'rendicontato' }],
      [
        {
          id: 'l1', document_id: 'd1', course_id: 'c1', subject: '', protocol_number: '857399',
          protocol_date: '2026-10-21', report_course_code: '', report_edition: '', membership_act: '',
          students_trained: null, start_date: null, end_date: null, amount_budget: null,
          amount_recognized: 21616.5, amount_advance: null, amount_balance: 21616.5, created_at: '',
        },
      ],
      [],
      [],
    )
    const el = document.createElement('div')
    act(() => {
      createRoot(el).render(
        <MemoryRouter>
          <DashboardPayments data={{ rows, paymentsEnabled: false }} />
        </MemoryRouter>,
      )
    })
    const text = el.textContent ?? ''
    for (const label of ['Saldi Regione', 'Da ricevere', 'Erogati', 'Da erogare', 'migrazione 0025']) {
      expect(text).toContain(label)
    }
    expect(text).toContain('€ 21.616,50')
    expect(text).toContain('Eipass Progressive')
  })
})
