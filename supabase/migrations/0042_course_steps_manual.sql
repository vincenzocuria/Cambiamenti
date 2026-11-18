-- Iter del corso, fase 2: lo stato segnato a mano vince sul riconoscimento automatico,
-- e Claude può proporre l'aggiornamento di un passo (dalle PEC) nella pagina «Proposte».

alter table public.course_steps add column if not exists manual boolean not null default false;

alter table public.proposals drop constraint if exists proposals_kind_check;
alter table public.proposals add constraint proposals_kind_check check (
  kind in (
    'crea_corso', 'aggiorna_corso', 'cambia_stato_corso', 'aggiungi_nota_corso',
    'registra_pagamento', 'allega_documento', 'aggiungi_lezione', 'aggiorna_passo'
  )
);
