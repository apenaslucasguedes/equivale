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
import { RepositorioEmMemoria, validarBase } from './repositorio';

export async function carregarBaseDeProducao(): Promise<BaseDeAlimentos> {
  const url = `${import.meta.env.BASE_URL}data/alimentos.json`;
  let ultimaFalha: unknown;
  for (let tentativa = 0; tentativa < 3; tentativa += 1) {
    try {
      const resposta = await fetch(url, { cache: tentativa === 0 ? 'default' : 'reload' });
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
      const base = validarBase(await resposta.json());
      if (base.alimentos.length === 0) throw new Error('base vazia');
      return base;
    } catch (erro) {
      ultimaFalha = erro;
    }
  }
  const detalhe = ultimaFalha instanceof Error ? `: ${ultimaFalha.message}` : '';
  throw new Error(`Não foi possível carregar a base de alimentos${detalhe}`);
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
