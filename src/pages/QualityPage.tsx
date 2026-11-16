import { useSearchParams } from 'react-router-dom'
import { SegmentedControl } from '../components/SegmentedControl'
import { QualityDocumentsTab } from '../components/quality/QualityDocumentsTab'
import { CertificatesTab } from '../components/quality/CertificatesTab'
import { SurveysTab } from '../components/quality/SurveysTab'

type Tab = 'documenti' | 'attestati' | 'gradimento'

const tabs: { value: Tab; label: string }[] = [
  { value: 'documenti', label: 'Documenti di sistema' },
  { value: 'attestati', label: 'Registro attestati' },
  { value: 'gradimento', label: 'Gradimento e docenti' },
]

/** Sistema qualità ISO 9001: elenco master, registro attestati, questionari e valutazione docenti. */
export function QualityPage() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab')
  const tab: Tab = tabs.some((t) => t.value === raw) ? (raw as Tab) : 'documenti'

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Qualità ISO 9001</h1>
        <p className="text-sm text-slate-500">
          Le evidenze per l'audit: documenti di sistema, attestati rilasciati, gradimento dei corsi e valutazione dei docenti.
          Il fascicolo di ogni corso si scarica dalla sua scheda.
        </p>
      </div>
      <SegmentedControl ariaLabel="Sezione" value={tab} onChange={(t) => setParams({ tab: t }, { replace: true })} options={tabs} />
      {tab === 'documenti' && <QualityDocumentsTab />}
      {tab === 'attestati' && <CertificatesTab />}
      {tab === 'gradimento' && <SurveysTab />}
    </div>
  )
}
