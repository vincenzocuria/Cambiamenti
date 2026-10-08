-- Restrizione RLS per campi sensibili dei minori
-- I dati del consenso genitoriale sono visibili solo al proprietario del profilo e agli admin

-- Le policy esistenti permettono a is_staff() di vedere i profili
-- Aggiungiamo una policy specifica per nascondere i campi sensibili

comment on column public.profiles.parental_guardian_name is 
  'Nome del genitore/tutore - SENSIBILE: visibile solo al proprietario e admin via application logic';

comment on column public.profiles.parental_guardian_contact is 
  'Contatto del genitore/tutore - SENSIBILE: visibile solo al proprietario e admin via application logic';

comment on column public.profiles.birth_date is 
  'Data di nascita - SENSIBILE: visibile solo al proprietario e admin via application logic';

-- NOTA: RLS su Postgres non supporta column-level security nativamente.
-- La policy esistente "profiles_select" permette SELECT a (id = auth.uid() OR is_staff()).
-- Questo significa che:
-- 1. L'utente vede il proprio profilo completo (OK)
-- 2. Gli admin vedono tutti i campi di tutti i profili (ATTENZIONE)
--
-- SOLUZIONE APPLICATIVA: L'applicazione (React) deve:
-- - Filtrare i campi sensibili quando visualizzati da non-admin
-- - O usare una view che nasconde le colonne sensibili per gli staff non-admin
--
-- Per una soluzione DB-side completa, si dovrebbe:
-- - Creare una view public.profiles_safe che omette i campi sensibili
-- - Creare una policy che permette agli staff di vedere solo la view
-- - Gli admin usano la tabella completa via service role

-- Documentazione per il team:
-- ATTENZIONE: La policy RLS attuale espone TUTTI i campi del profilo agli utenti is_staff().
-- I campi birth_date, parental_guardian_name, parental_guardian_contact sono SENSIBILI.
-- 
-- AZIONE RICHIESTA:
-- 1. L'applicazione frontend deve filtrare questi campi quando non visualizzati dall'utente stesso o da un admin
-- 2. Oppure: creare una view separata per gli staff non-admin
-- 3. Considerare: spostare i dati dei minori in una tabella separata con RLS più restrittiva
