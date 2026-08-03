/** Reconhecimento dos nomes de refeição vindos do Markdown importado. */

import type { Refeicao } from '../domain/types';
import { REFEICOES_CANONICAS } from '../domain/types';
import { normalizar } from '../domain/texto';

const APELIDOS: Record<string, string> = {
  'cafe da manha': 'cafe-da-manha',
  cafe: 'cafe-da-manha',
  desjejum: 'cafe-da-manha',
  'primeira refeicao': 'cafe-da-manha',
  'lanche da manha': 'lanche-da-manha',
  colacao: 'lanche-da-manha',
  'lanche manha': 'lanche-da-manha',
  almoco: 'almoco',
  'lanche da tarde': 'lanche-da-tarde',
  lanche: 'lanche-da-tarde',
  merenda: 'lanche-da-tarde',
  jantar: 'jantar',
  janta: 'jantar',
  ceia: 'ceia',
  'antes de dormir': 'ceia',
};

const ORDEM_CANONICA = new Map<string, number>(
  REFEICOES_CANONICAS.map((r, i) => [r.id as string, i]),
);
const NOME_CANONICO = new Map(REFEICOES_CANONICAS.map((r) => [r.id as string, r.nome as string]));

export interface RefeicaoReconhecida {
  id: string;
  nome: string;
  canonica: boolean;
}

/** Casa o título de uma seção com uma refeição canônica, quando possível. */
export function reconhecerRefeicao(titulo: string): RefeicaoReconhecida {
  const limpo = titulo.replace(/\(.*?\)/g, '').trim();
  const chave = normalizar(limpo);

  const idCanonico = APELIDOS[chave];
  if (idCanonico) {
    return { id: idCanonico, nome: NOME_CANONICO.get(idCanonico) ?? limpo, canonica: true };
  }

  // Refeição fora da lista canônica (ex.: "Pré-treino"): preservada como está.
  const id = chave ? `personalizada-${chave.replace(/\s+/g, '-')}` : 'personalizada-sem-nome';
  return { id, nome: limpo || 'Refeição sem nome', canonica: false };
}

/**
 * Ordena as refeições: canônicas na ordem natural do dia, personalizadas
 * depois, na ordem em que apareceram no arquivo.
 */
export function ordenarRefeicoes(reconhecidas: RefeicaoReconhecida[]): Refeicao[] {
  return reconhecidas
    .map((r, indice) => ({
      refeicao: r,
      chave: r.canonica ? (ORDEM_CANONICA.get(r.id) ?? 99) : 100 + indice,
    }))
    .sort((a, b) => a.chave - b.chave)
    .map((item, ordem) => ({ id: item.refeicao.id, nome: item.refeicao.nome, ordem }));
}
