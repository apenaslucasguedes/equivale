/** Formatações compartilhadas pela interface. */

import type { BlocoCalorico, Configuracoes } from '../domain/types';
import { formatarQuantidade } from '../domain/equivalencia';
import { formatarNumero } from '../domain/texto';

/** "120 g", "1 unidade", "85 g · ≈ 1,5 fatia". */
export function descreverQuantidade(bloco: BlocoCalorico, configuracoes: Configuracoes): string {
  const { quantidade, unidade, medidaCaseira } = bloco.atual;
  const unidadeExibida = bloco.atual.descricaoMedidaOriginal ?? unidade;
  const base =
    unidade === 'g' || unidade === 'ml'
      ? `${formatarQuantidade(quantidade, configuracoes.arredondamento)} ${unidade}`
      : `${formatarNumero(quantidade, 2)} ${unidadeExibida}`;
  return medidaCaseira ? `${base} · ${medidaCaseira}` : base;
}

/** Medida, peso (quando distinto) e energia, sem esconder dados da prescrição. */
export function descreverResumoDoBloco(bloco: BlocoCalorico, configuracoes: Configuracoes): string {
  const partes = [descreverQuantidade(bloco, configuracoes)];
  const peso = bloco.atual.pesoGramas;
  if (peso && bloco.atual.unidade !== 'g') partes.push(`${formatarNumero(peso, 2)} g`);
  partes.push(descreverEnergia(bloco.kcal));
  return partes.join(' · ');
}

export function descreverQuantidadeOriginal(bloco: BlocoCalorico): string {
  const { quantidade, unidade } = bloco.original;
  return `${formatarNumero(quantidade, 2)} ${bloco.original.descricaoMedidaOriginal ?? unidade}`;
}

/** Energia do bloco. Informação de referência — nunca uma meta. */
export function descreverEnergia(kcal: number): string {
  return `${formatarNumero(kcal, 0)} kcal`;
}

export function descreverData(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
