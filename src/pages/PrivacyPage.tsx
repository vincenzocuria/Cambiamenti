import { BrandLogo } from '../components/BrandLogo'
import { school } from '../data/school'

export function PrivacyPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <BrandLogo size="lg" />
          <h1 className="text-center text-2xl font-bold text-slate-900">
            Informativa sulla Privacy
          </h1>
        </div>

        <div className="prose prose-sm prose-slate max-w-none">
          <p className="text-slate-700">
            <strong>NOTA: Questa è una bozza di informativa privacy.</strong> Richiede revisione
            legale completa prima dell'uso in produzione.
          </p>

          <h2>Titolare del trattamento</h2>
          <p>{school.name}</p>

          <h2>Dati raccolti</h2>
          <p>
            Raccogliamo e trattiamo i seguenti dati personali necessari per l'erogazione dei
            servizi formativi:
          </p>
          <ul>
            <li>Dati anagrafici (nome, cognome, data di nascita)</li>
            <li>Dati di contatto (email, telefono, indirizzo)</li>
            <li>Credenziali di accesso alla piattaforma</li>
            <li>Documenti di identità (se necessari per l'iscrizione)</li>
            <li>Dati relativi alla partecipazione ai corsi e alle attività formative</li>
          </ul>

          <h2>Trattamento dei dati dei minori</h2>
          <p>
            Per gli utenti di età inferiore ai 14 anni, il trattamento dei dati personali richiede
            il consenso di un genitore o tutore legale, secondo quanto previsto dal GDPR e dalla
            normativa italiana vigente.
          </p>
          <p>
            Al momento della registrazione, per i minori viene raccolto il consenso del
            genitore/tutore, comprensivo di:
          </p>
          <ul>
            <li>Nome e contatto del genitore/tutore</li>
            <li>Dichiarazione di consenso esplicito al trattamento</li>
            <li>Data e ora del consenso</li>
          </ul>

          <h2>Base giuridica del trattamento</h2>
          <p>Il trattamento dei dati si basa su:</p>
          <ul>
            <li>Esecuzione di un contratto (iscrizione ai corsi)</li>
            <li>Consenso dell'interessato (o del genitore/tutore per i minori)</li>
            <li>Adempimento di obblighi di legge</li>
          </ul>

          <h2>Diritti degli interessati</h2>
          <p>Gli utenti hanno diritto a:</p>
          <ul>
            <li>Accedere ai propri dati personali</li>
            <li>Rettificare dati inesatti o incompleti</li>
            <li>Richiedere la cancellazione dei dati</li>
            <li>Opporsi al trattamento</li>
            <li>Richiedere la limitazione del trattamento</li>
            <li>Portabilità dei dati</li>
            <li>Revocare il consenso in qualsiasi momento</li>
          </ul>

          <h2>Conservazione dei dati</h2>
          <p>
            I dati personali sono conservati per il tempo necessario all'erogazione dei servizi e
            agli adempimenti di legge.
          </p>

          <h2>Contatti</h2>
          <p>
            Per esercitare i propri diritti o per maggiori informazioni, contattare il Titolare
            del trattamento tramite i canali indicati sul sito.
          </p>
        </div>

        <div className="mt-8 text-center">
          <a href="/login" className="text-sm text-indigo-600 hover:underline">
            Torna al login
          </a>
        </div>
      </div>
    </div>
  )
}
