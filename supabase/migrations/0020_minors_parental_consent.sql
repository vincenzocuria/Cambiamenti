-- Aggiungi campi per consenso genitori per minori
-- IMPORTANTE: Questa implementazione richiede revisione legale e adattamento
-- al contesto specifico dell'applicazione prima del deploy in produzione.

alter table public.profiles
  add column birth_date date,
  add column is_under_14 boolean default false,
  add column parental_consent_given boolean,
  add column parental_guardian_name text,
  add column parental_guardian_contact text,
  add column parental_consent_timestamp timestamptz;

comment on column public.profiles.birth_date is 
  'Data di nascita dell''utente (opzionale ma raccomandata per verifica età)';

comment on column public.profiles.is_under_14 is 
  'Dichiarazione utente di essere minore di 14 anni';

comment on column public.profiles.parental_consent_given is 
  'Consenso genitoriale/tutore per trattamento dati di minore (richiesto se is_under_14 = true)';

comment on column public.profiles.parental_guardian_name is 
  'Nome del genitore/tutore che fornisce il consenso';

comment on column public.profiles.parental_guardian_contact is 
  'Contatto del genitore/tutore (email o telefono)';

comment on column public.profiles.parental_consent_timestamp is 
  'Timestamp del consenso genitoriale';

-- Constraint: se utente dichiara di essere minore, il consenso genitoriale è obbligatorio
alter table public.profiles
  add constraint parental_consent_required
  check (
    not is_under_14 or (
      parental_consent_given = true and
      parental_guardian_name is not null and
      parental_guardian_name <> '' and
      parental_guardian_contact is not null and
      parental_guardian_contact <> '' and
      parental_consent_timestamp is not null
    )
  );

comment on constraint parental_consent_required on public.profiles is 
  'Richiede consenso genitoriale completo per utenti che dichiarano di essere minori di 14 anni';
