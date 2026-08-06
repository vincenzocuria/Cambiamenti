// Archivio ABI -> banca e BIC/SWIFT (sede centrale) delle principali banche italiane.
// Estendibile: aggiungere una riga per ogni nuova banca (fonte: Albo Banca d'Italia / sito banca).
export interface BankInfo {
  name: string
  bic: string
}

export const ABI_BANKS: Record<string, BankInfo> = {
  '01005': { name: 'Banca Nazionale del Lavoro (BNP Paribas)', bic: 'BNLIITRR' },
  '01030': { name: 'Banca Monte dei Paschi di Siena', bic: 'PASCITM1' },
  '02008': { name: 'UniCredit', bic: 'UNCRITMM' },
  '03015': { name: 'FinecoBank', bic: 'FEBIITM1' },
  '03032': { name: 'Credem — Credito Emiliano', bic: 'BACRIT22' },
  '03062': { name: 'Banca Mediolanum', bic: 'MEDBITMM' },
  '03069': { name: 'Intesa Sanpaolo', bic: 'BCITITMM' },
  '03104': { name: 'Deutsche Bank S.p.A.', bic: 'DEUTITMM' },
  '03268': { name: 'Banca Sella', bic: 'SELBIT2B' },
  '03475': { name: 'ING Bank Italia', bic: 'INGBITMM' },
  '05034': { name: 'Banco BPM', bic: 'BAPPIT22' },
  '05387': { name: 'BPER Banca', bic: 'BPMOIT22' },
  '05696': { name: 'Banca Popolare di Sondrio', bic: 'POSOIT22' },
  '06230': { name: 'Crédit Agricole Italia', bic: 'CRPPIT2P' },
  '07601': { name: 'Poste Italiane — BancoPosta', bic: 'BPPIITRR' },
}

export function lookupAbi(abi: string): BankInfo | null {
  const exact = ABI_BANKS[abi]
  if (exact) return exact
  // Le BCC (ABI 08xxx) instradano generalmente tramite Iccrea Banca
  if (abi.startsWith('08')) {
    return { name: 'Banca di Credito Cooperativo (verificare denominazione)', bic: 'ICRAITRR' }
  }
  return null
}
