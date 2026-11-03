import { McpServer } from '@modelcontextprotocol/server'
import type { McpAuth } from '../auth/session'
import type { Env } from '../env'
import { userClient } from './db'
import type { McpCtx } from './context'
import { registerCourseTools } from './tools/corsi'
import { registerLookupTools } from './tools/consultazione'
import { registerDocumentTools } from './tools/documenti'
import { registerWriteTools } from './tools/modifiche'
import { registerMailTools } from './tools/posta'
import { registerProposalTools } from './tools/proposte'

const INSTRUCTIONS = `Gestionale dei corsi di formazione di Cambia-Menti S.r.l. (Regione Calabria, GOL e altri avvisi).
Ciclo di un corso: bando/avviso e decreto di finanziamento → creazione e attivazione (organico, allievi, calendario) → svolgimento → fine → rendicontazione (verbale della Regione con importi riconosciuti, anticipo e saldo) → incasso del saldo e delle indennità (note di debito su Aruba) → esito chiuso.
Usa scheda_corso per vedere l'iter completo e il prossimo passo. Per gli aggiornamenti da PEC: cerca il corso (ID corso es. 673.7 + edizione es. "ED2 - 2025", oppure CUP), poi aggiorna i dati, cambia lo stato con il motivo e carica il documento. Il CUP non sempre c'è.
PEC: il servizio sul PC copia le PEC nel gestionale una volta al giorno. Elaborale così: posta_da_elaborare → leggi_pec → per ogni dato nuovo o diverso usa proponi_modifica (MAI gli strumenti di scrittura diretta: la persona accetta o rifiuta nella pagina «Proposte») → segna_pec con stato elaborata e una nota che riassume la PEC e le proposte fatte. Prima di proporre controlla scheda_corso ed elenco_proposte per evitare doppioni; un corso nuovo solo se cerca_corsi non lo trova (ID corso + edizione). Ricevute, pubblicità e PEC non sui corsi: ignorata. Se non sei sicuro del corso: da_verificare senza proposte. Le PEC inviate (direction out) sono di Cambia-Menti: utili per date di avvio, vidimazioni, calendari.
Gli strumenti di scrittura diretta (crea_corso, aggiorna_corso, ...) solo quando la persona lo chiede esplicitamente in chat.
Non esistono strumenti di cancellazione. Ogni modifica finisce nel registro (registro_modifiche).`

export function createGestionaleMcp(env: Env, auth: McpAuth): McpServer {
  const server = new McpServer({ name: 'cambiamenti-gestionale', version: '0.1.0' }, { instructions: INSTRUCTIONS })
  const ctx: McpCtx = { server, db: userClient(env, auth.supabaseJwt), auth }
  registerCourseTools(ctx)
  registerLookupTools(ctx)
  registerDocumentTools(ctx)
  registerWriteTools(ctx)
  registerMailTools(ctx)
  registerProposalTools(ctx)
  return server
}
