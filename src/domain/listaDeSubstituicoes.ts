/**
 * Lista de substituições da nutricionista — CAMADA PREPARADA, RECURSO FUTURO.
 *
 * Algumas prescrições vêm acompanhadas de uma lista própria de trocas, no
 * formato “no grupo dos cereais, 1 fatia de pão (50 g) equivale a 2 colheres de
 * arroz (50 g)”. Esta camada existe para receber esse material mais adiante.
 *
 * O que esta versão entrega:
 * - o modelo de dados (grupos, alimentos, quantidades e medidas caseiras);
 * - funções puras de consulta e o saneamento de dados não confiáveis.
 *
 * O que esta versão NÃO faz, de propósito:
 * - não existe importação desta lista (nem Markdown, nem JSON, nem tela);
 * - a lista não é persistida no estado do aplicativo;
 * - ela NÃO restringe a substituição atual. Continua valendo a regra do
 *   Equivale: qualquer alimento pode substituir qualquer outro pela
 *   equivalência calórica, e categorias/grupos jamais bloqueiam uma troca.
 *   Quando a importação existir, esta lista será uma SUGESTÃO adicional.
 */

import type { Unidade } from './types';
import { normalizar } from './texto';

/** Um alimento dentro de um grupo, com a porção que a nutricionista definiu. */
export interface AlimentoDaLista {
  id: string;
  nome: string;
  /** Vínculo com a base nutricional, quando houver. */
  alimentoId: string | null;
  quantidade: number;
  unidade: Unidade;
  /** Medida caseira equivalente, como escrita no material (“2 colheres de sopa”). */
  medidaCaseira: string | null;
  /** Calorias da porção, quando o material informar. */
  kcal: number | null;
  observacao: string | null;
}

/** Grupo de trocas: dentro dele, as porções são consideradas equivalentes. */
export interface GrupoDeSubstituicoes {
  id: string;
  nome: string;
  descricao: string | null;
  alimentos: AlimentoDaLista[];
}

export interface ListaDeSubstituicoes {
  id: string;
  nome: string;
  /** Quem forneceu a lista (nutricionista, clínica, material impresso…). */
  origem: string | null;
  criadaEm: string;
  grupos: GrupoDeSubstituicoes[];
}

export function listaVazia(id: string, nome: string): ListaDeSubstituicoes {
  return { id, nome, origem: null, criadaEm: new Date().toISOString(), grupos: [] };
}

// ---------------------------------------------------------------- consultas

export function contarAlimentos(lista: ListaDeSubstituicoes): number {
  return lista.grupos.reduce((total, grupo) => total + grupo.alimentos.length, 0);
}

/** Grupos em que um alimento aparece, procurando por nome normalizado ou id. */
export function gruposDoAlimento(
  lista: ListaDeSubstituicoes,
  nomeOuId: string,
): GrupoDeSubstituicoes[] {
  const chave = normalizar(nomeOuId);
  if (!chave) return [];
  return lista.grupos.filter((grupo) =>
    grupo.alimentos.some(
      (alimento) => alimento.alimentoId === nomeOuId || normalizar(alimento.nome) === chave,
    ),
  );
}

/**
 * Alternativas sugeridas para um alimento: os demais itens dos grupos em que
 * ele aparece. É apenas uma sugestão — nada aqui limita as trocas do aplicativo.
 */
export function alternativasSugeridas(
  lista: ListaDeSubstituicoes,
  nomeOuId: string,
): AlimentoDaLista[] {
  const chave = normalizar(nomeOuId);
  if (!chave) return [];
  const vistos = new Set<string>();
  const resultado: AlimentoDaLista[] = [];

  for (const grupo of gruposDoAlimento(lista, nomeOuId)) {
    for (const alimento of grupo.alimentos) {
      const ehOMesmo = alimento.alimentoId === nomeOuId || normalizar(alimento.nome) === chave;
      if (ehOMesmo || vistos.has(alimento.id)) continue;
      vistos.add(alimento.id);
      resultado.push(alimento);
    }
  }
  return resultado;
}

// -------------------------------------------------------------- saneamento

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function texto(valor: unknown, padrao = ''): string {
  return typeof valor === 'string' ? valor : padrao;
}

function numeroOuNulo(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= 0 ? valor : null;
}

function sanearAlimento(valor: unknown, indice: number): AlimentoDaLista | null {
  if (!ehObjeto(valor)) return null;
  const nome = texto(valor.nome).trim();
  if (!nome) return null;
  return {
    id: texto(valor.id) || `alimento-${indice}`,
    nome,
    alimentoId: typeof valor.alimentoId === 'string' ? valor.alimentoId : null,
    quantidade: numeroOuNulo(valor.quantidade) ?? 0,
    unidade: (typeof valor.unidade === 'string' ? valor.unidade : 'g') as Unidade,
    medidaCaseira: typeof valor.medidaCaseira === 'string' ? valor.medidaCaseira : null,
    kcal: numeroOuNulo(valor.kcal),
    observacao: typeof valor.observacao === 'string' ? valor.observacao : null,
  };
}

function sanearGrupo(valor: unknown, indice: number): GrupoDeSubstituicoes | null {
  if (!ehObjeto(valor)) return null;
  const nome = texto(valor.nome).trim();
  if (!nome) return null;
  const alimentos = Array.isArray(valor.alimentos)
    ? valor.alimentos
        .map((item, i) => sanearAlimento(item, i))
        .filter((item): item is AlimentoDaLista => item !== null)
    : [];
  return {
    id: texto(valor.id) || `grupo-${indice}`,
    nome,
    descricao: typeof valor.descricao === 'string' ? valor.descricao : null,
    alimentos,
  };
}

/**
 * Valida uma lista vinda de fora (arquivo, backup futuro). Nunca lança:
 * grupos e alimentos irreconhecíveis são descartados, o resto é preservado.
 */
export function sanearListaDeSubstituicoes(valor: unknown): ListaDeSubstituicoes | null {
  if (!ehObjeto(valor)) return null;
  const grupos = Array.isArray(valor.grupos)
    ? valor.grupos
        .map((item, i) => sanearGrupo(item, i))
        .filter((item): item is GrupoDeSubstituicoes => item !== null)
    : [];

  return {
    id: texto(valor.id) || 'lista',
    nome: texto(valor.nome).trim() || 'Lista de substituições',
    origem: typeof valor.origem === 'string' ? valor.origem : null,
    criadaEm: texto(valor.criadaEm, new Date().toISOString()),
    grupos,
  };
}
