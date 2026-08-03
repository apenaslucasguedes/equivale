/**
 * Origem dos dados de alimentos.
 *
 * Produção: tenta carregar `public/data/alimentos.json`. Enquanto não houver
 * uma base real validada, esse arquivo vem vazio de propósito — o Equivale não
 * inventa números nutricionais.
 *
 * Demonstração: carrega as fixtures TEST_ONLY por importação dinâmica, de modo
 * que elas nem entrem no pacote principal.
 */

import type { BaseDeAlimentos } from '../../domain/types';
import { BASE_VAZIA, RepositorioEmMemoria, validarBase } from './repositorio';

export async function carregarBaseDeProducao(): Promise<BaseDeAlimentos> {
  const url = `${import.meta.env.BASE_URL}data/alimentos.json`;
  try {
    const resposta = await fetch(url);
    if (!resposta.ok) return BASE_VAZIA;
    return validarBase(await resposta.json());
  } catch {
    // Arquivo ausente ou inválido: seguimos com a base vazia, sem inventar dados.
    return BASE_VAZIA;
  }
}

export async function carregarBaseDeDemonstracao(): Promise<BaseDeAlimentos> {
  const modulo = await import('./TEST_ONLY.fixtures');
  return modulo.TEST_ONLY_BASE_DE_ALIMENTOS;
}

export function criarRepositorio(modoDemonstracao: boolean): RepositorioEmMemoria {
  return new RepositorioEmMemoria(
    modoDemonstracao ? carregarBaseDeDemonstracao : carregarBaseDeProducao,
  );
}
