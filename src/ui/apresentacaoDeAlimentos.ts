import type { Alimento } from '../domain/types';
import { normalizar } from '../domain/texto';

function ehOvoDeGalinha(alimento: Alimento): boolean {
  return normalizar(alimento.nome).startsWith('ovo de galinha');
}

function ehOvoDeGalinhaPrincipal(alimento: Alimento): boolean {
  return alimento.codigoDaFonte === '488' || alimento.id === 'TEST_ONLY_ovo_cozido';
}

/** Evita repetir no seletor preparações de ovo que confundem a escolha cotidiana. */
export function alimentoVisivelNoSeletor(alimento: Alimento): boolean {
  return !ehOvoDeGalinha(alimento) || ehOvoDeGalinhaPrincipal(alimento);
}

export function nomeDoAlimentoNoSeletor(alimento: Alimento): string {
  return ehOvoDeGalinhaPrincipal(alimento) ? 'Ovo de galinha' : alimento.nome;
}

export function preparoDoAlimentoNoSeletor(alimento: Alimento): string | null {
  return ehOvoDeGalinhaPrincipal(alimento) ? null : alimento.preparo;
}

/** Mantém ID, fonte e densidade do registro validado, simplificando apenas o rótulo. */
export function alimentoEscolhidoNoSeletor(alimento: Alimento): Alimento {
  const nome = nomeDoAlimentoNoSeletor(alimento);
  return nome === alimento.nome ? alimento : { ...alimento, nome };
}