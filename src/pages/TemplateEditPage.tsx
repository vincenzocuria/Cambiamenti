import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { DocumentCategory, DocumentTemplateInput, TemplatePersonRole } from '../types/db'
import { createTemplate, getTemplate, updateTemplate } from '../services/templates'
import { templatePlaceholderGroups } from '../data/templatePlaceholders'
import { categoryOptions } from '../data/documentCategories'
import { PrimaryButton, SecondaryButton } from '../components/Buttons'
import { SelectField, TextAreaField, TextField } from '../components/Field'

const empty: DocumentTemplateInput = {
  name: '',
  description: '',
  body: `{{scuola.nome}}
{{scuola.indirizzo}}
P.IVA {{scuola.piva}} · REA {{scuola.rea}}

Oggetto: lettera d'incarico — {{corso.nome}} {{corso.edizione}}

Spett.le {{docente.nome_completo}}
C.F. {{docente.cf}}

Con la presente si conferma l'incarico per il corso "{{corso.nome}}"
(codice {{corso.codice}}, CUP {{corso.cup}})
dal {{corso.data_inizio}} al {{corso.data_fine}}
per complessive {{corso.ore}} ore.

{{scuola.nome}}
{{oggi}}
`,
  requires_course: true,
  person_role: 'teacher',
  default_category: 'appointment',
}

export function TemplateEditPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'nuovo'
  const navigate = useNavigate()
  const [form, setForm] = useState<DocumentTemplateInput>(empty)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(!isNew)

  useEffect(() => {
    if (isNew || !id) return
    getTemplate(id)
      .then((t) => {
        setForm({
          name: t.name,
          description: t.description,
          body: t.body,
          requires_course: t.requires_course,
          person_role: t.person_role,
          default_category: t.default_category,
        })
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Errore'))
      .finally(() => setLoading(false))
  }, [id, isNew])

  function set<K extends keyof DocumentTemplateInput>(key: K, value: DocumentTemplateInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function onFile(file: File | null) {
    if (!file) return
    const text = await file.text()
    set('body', text)
    if (!form.name) set('name', file.name.replace(/\.[^.]+$/, ''))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (isNew) {
        const created = await createTemplate(form)
        navigate(`/template/${created.id}`, { replace: true })
      } else {
        await updateTemplate(id!, form)
        navigate('/template')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Salvataggio fallito')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p className="text-slate-400">Caricamento…</p>

  return (
    <div className="space-y-4">
      <div>
        <Link to="/template" className="text-xs text-indigo-600 hover:underline">
          ← Tutti i template
        </Link>
        <h1 className="text-2xl font-bold text-slate-800">
          {isNew ? 'Nuovo template' : 'Modifica template'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2">
          <TextField
            label="Nome"
            required
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Es. Lettera d'incarico docente"
          />
          <TextField
            label="Descrizione"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
          />
          <TextAreaField
            label="Testo del template"
            required
            value={form.body}
            onChange={(e) => set('body', e.target.value)}
            rows={18}
            hint="Usa segnaposto come {{docente.nome_completo}} o {{corso.nome}}"
          />
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">
              Oppure carica un file di testo (.txt / .html / .md)
            </span>
            <input
              type="file"
              accept=".txt,.html,.htm,.md"
              onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700"
            />
          </label>
        </div>

        <div className="space-y-4">
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <SelectField
              label="Persona richiesta"
              value={form.person_role}
              onChange={(e) => set('person_role', e.target.value as TemplatePersonRole)}
            >
              <option value="none">Nessuna</option>
              <option value="staff">Personale (qualsiasi ruolo)</option>
              <option value="teacher">Docente</option>
              <option value="tutor">Tutor</option>
              <option value="admin_staff">Figura amministrativa</option>
              <option value="student">Alunno</option>
              <option value="any">Qualsiasi persona</option>
            </SelectField>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.requires_course}
                onChange={(e) => set('requires_course', e.target.checked)}
              />
              Richiede un corso collegato
            </label>
            <SelectField
              label="Categoria documento generato"
              value={form.default_category}
              onChange={(e) => set('default_category', e.target.value as DocumentCategory)}
            >
              {categoryOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </SelectField>
            <div className="flex gap-2 pt-2">
              <PrimaryButton type="submit" disabled={busy}>
                {busy ? 'Salvataggio…' : 'Salva'}
              </PrimaryButton>
              <SecondaryButton type="button" onClick={() => navigate('/template')}>
                Annulla
              </SecondaryButton>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Segnaposto disponibili
            </h3>
            <div className="space-y-3 text-xs text-slate-600">
              {templatePlaceholderGroups.map((g) => (
                <div key={g.title}>
                  <p className="font-medium text-slate-700">{g.title}</p>
                  <ul className="mt-1 space-y-0.5 font-mono">
                    {g.items.map((item) => (
                      <li key={item}>{`{{${item}}}`}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
