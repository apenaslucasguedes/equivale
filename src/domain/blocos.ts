/**
 * Operações puras sobre blocos calóricos e sobre a dieta.
 *
 * Invariantes garantidas aqui (e cobertas por testes):
 * - `id`, `kcal` e `original` NUNCA mudam depois da importação.
 * - Substituir altera só `atual.alimento*`, `atual.quantidade`, `atual.unidade`
 *   e `atual.medidaCaseira`.
 * - Mover altera só `atual.refeicaoId`.
 * - Restaurar copia `original` de volta para `atual`.
 */

import type { Alimento, BlocoCalorico, Dieta, Refeicao, Unidade } from './types';

// ------------------------------------------------------------- consultas

export function blocosDaRefeicao(dieta: Dieta, refeicaoId: string): BlocoCalorico[] {
  return dieta.blocos
    .filter((bloco) => bloco.atual.refeicaoId === refeicaoId)
    .sort((a, b) => a.ordem - b.ordem);
}

export function refeicoesOrdenadas(dieta: Dieta): Refeicao[] {
  return [...dieta.refeicoes].sort((a, b) => a.ordem - b.ordem);
}

/** Somatório informativo. Nunca apresentado como meta de consumo. */
export function somaDeCalorias(blocos: BlocoCalorico[]): number {
  return blocos.reduce((total, bloco) => total + (Number.isFinite(bloco.kcal) ? bloco.kcal : 0), 0);
}

export function foiSubstituido(bloco: BlocoCalorico): boolean {
  return (
    bloco.atual.alimentoNome !== bloco.original.alimentoNome ||
    bloco.atual.alimentoId !== bloco.original.alimentoId ||
    bloco.atual.quantidade !== bloco.original.quantidade ||
    bloco.atual.unidade !== bloco.original.unidade
  );
}

export function foiMovido(bloco: BlocoCalorico): boolean {
  return bloco.atual.refeicaoId !== bloco.original.refeicaoId;
}

export function foiAlterado(bloco: BlocoCalorico): boolean {
  return foiSubstituido(bloco) || foiMovido(bloco);
}

export function contarAlteracoes(dieta: Dieta): number {
  return dieta.blocos.filter(foiAlterado).length;
}

// ------------------------------------------------------------ substituição

export interface DadosDaSubstituicao {
  alimento: Pick<Alimento, 'id' | 'nome'>;
  /** Quantidade em precisão total; o arredondamento fica na apresentação. */
  quantidade: number;
  unidade: Unidade;
  medidaCaseira?: string | null;
}

export interface DadosDoConsumo {
  alimento: Pick<Alimento, 'id' | 'nome'>;
  quantidade: number;
  kcal: number;
}

export interface DadosDoNovoConsumo extends DadosDoConsumo {
  id: string;
  refeicaoId: string;
}

/**
 * Devolve um NOVO bloco com o alimento trocado. Preserva id, kcal e original.
 * Não valida a categoria de propósito: qualquer alimento pode substituir
 * qualquer outro.
 */
export function substituirAlimentoDoBloco(
  bloco: BlocoCalorico,
  dados: DadosDaSubstituicao,
): BlocoCalorico {
  return {
    ...bloco,
    atual: {
      ...bloco.atual,
      alimentoId: dados.alimento.id,
      alimentoNome: dados.alimento.nome,
      quantidade: dados.quantidade,
      unidade: dados.unidade,
      pesoGramas: dados.unidade === 'g' ? dados.quantidade : null,
      descricaoMedidaOriginal: null,
      medidaCaseira: dados.medidaCaseira ?? null,
    },
  };
}

// ------------------------------------------------------------ movimentação

/** Devolve um NOVO bloco na refeição de destino, com as mesmas calorias. */
export function moverBlocoPara(bloco: BlocoCalorico, refeicaoDestinoId: string): BlocoCalorico {
  if (bloco.atual.refeicaoId === refeicaoDestinoId) return bloco;
  return { ...bloco, atual: { ...bloco.atual, refeicaoId: refeicaoDestinoId } };
}

// -------------------------------------------------------------- restauração

export function restaurarBloco(bloco: BlocoCalorico): BlocoCalorico {
  const { adicionado: _adicionado, removido: _removido, kcalOriginal, ...resto } = bloco;
  return {
    ...resto,
    atual: {
      alimentoId: bloco.original.alimentoId,
      alimentoNome: bloco.original.alimentoNome,
      quantidade: bloco.original.quantidade,
      unidade: bloco.original.unidade,
      pesoGramas: bloco.original.pesoGramas ?? null,
      descricaoMedidaOriginal: bloco.original.descricaoMedidaOriginal ?? null,
      refeicaoId: bloco.original.refeicaoId,
      medidaCaseira: null,
    },
    kcal: kcalOriginal ?? bloco.kcal,
  };
}

// ------------------------------------------------------- operações na dieta

function mapearBloco(
  dieta: Dieta,
  blocoId: string,
  transformar: (bloco: BlocoCalorico) => BlocoCalorico,
): Dieta {
  let encontrou = false;
  const blocos = dieta.blocos.map((bloco) => {
    if (bloco.id !== blocoId) return bloco;
    encontrou = true;
    return transformar(bloco);
  });
  if (!encontrou) return dieta;
  return { ...dieta, blocos };
}

export function substituirAlimentoNaDieta(
  dieta: Dieta,
  blocoId: string,
  dados: DadosDaSubstituicao,
): Dieta {
  return mapearBloco(dieta, blocoId, (bloco) => substituirAlimentoDoBloco(bloco, dados));
}

/** Registra a quantidade realmente consumida, sem apagar a prescrição. */
export function ajustarAlimentoNaDieta(dieta: Dieta, blocoId: string, dados: DadosDoConsumo): Dieta {
  if (!Number.isFinite(dados.quantidade) || dados.quantidade <= 0 || !Number.isFinite(dados.kcal) || dados.kcal < 0) return dieta;
  return mapearBloco(dieta, blocoId, (bloco) => ({
    ...bloco,
    kcalOriginal: bloco.kcalOriginal ?? bloco.kcal,
    kcal: dados.kcal,
    removido: undefined,
    atual: {
      ...bloco.atual,
      alimentoId: dados.alimento.id,
      alimentoNome: dados.alimento.nome,
      quantidade: dados.quantidade,
      unidade: 'g',
      pesoGramas: dados.quantidade,
      descricaoMedidaOriginal: null,
      medidaCaseira: null,
    },
  }));
}

export function adicionarAlimentoNaDieta(dieta: Dieta, dados: DadosDoNovoConsumo): Dieta {
  if (!dieta.refeicoes.some((refeicao) => refeicao.id === dados.refeicaoId)) return dieta;
  if (!Number.isFinite(dados.quantidade) || dados.quantidade <= 0 || !Number.isFinite(dados.kcal) || dados.kcal < 0) return dieta;
  const ordem = blocosDaRefeicao(dieta, dados.refeicaoId).length;
  const estado = { alimentoId: dados.alimento.id, alimentoNome: dados.alimento.nome, quantidade: dados.quantidade, unidade: 'g' as const, pesoGramas: dados.quantidade, refeicaoId: dados.refeicaoId };
  return { ...dieta, blocos: [...dieta.blocos, {
    id: dados.id, adicionado: true, kcalOriginal: 0,
    original: estado, atual: { ...estado, medidaCaseira: null },
    kcal: dados.kcal, origemDasCalorias: 'calculada',
    observacao: 'Adicionado ao registro do dia.', ordem,
  }] };
}

export function removerBlocoDaDieta(dieta: Dieta, blocoId: string): Dieta {
  const bloco = dieta.blocos.find((item) => item.id === blocoId);
  if (!bloco) return dieta;
  if (bloco.adicionado) return { ...dieta, blocos: dieta.blocos.filter((item) => item.id !== blocoId) };
  return mapearBloco(dieta, blocoId, (item) => ({
    ...item, kcalOriginal: item.kcalOriginal ?? item.kcal, kcal: 0, removido: true,
    atual: { ...item.atual, quantidade: 0, pesoGramas: 0 },
  }));
}

/**
 * Move um bloco para outra refeição. `posicao` é opcional e serve ao arrastar
 * e soltar: define em que lugar da refeição de destino o cartão fica.
 */
export function moverBlocoNaDieta(
  dieta: Dieta,
  blocoId: string,
  refeicaoDestinoId: string,
  posicao?: number,
): Dieta {
  const existeDestino = dieta.refeicoes.some((r) => r.id === refeicaoDestinoId);
  if (!existeDestino) return dieta;

  const alvo = dieta.blocos.find((b) => b.id === blocoId);
  if (!alvo) return dieta;

  const movido = moverBlocoPara(alvo, refeicaoDestinoId);
  const destino = dieta.blocos
    .filter((b) => b.id !== blocoId && b.atual.refeicaoId === refeicaoDestinoId)
    .sort((a, b) => a.ordem - b.ordem);

  const indice = posicao === undefined ? destino.length : Math.max(0, Math.min(posicao, destino.length));
  destino.splice(indice, 0, movido);

  const reordenados = new Map(destino.map((bloco, i) => [bloco.id, i]));
  const blocos = dieta.blocos.map((bloco) => {
    if (bloco.id === blocoId) return { ...movido, ordem: reordenados.get(blocoId) ?? movido.ordem };
    const nova = reordenados.get(bloco.id);
    return nova === undefined ? bloco : { ...bloco, ordem: nova };
  });

  return { ...dieta, blocos };
}

export function restaurarBlocoNaDieta(dieta: Dieta, blocoId: string): Dieta {
  return mapearBloco(dieta, blocoId, restaurarBloco);
}

/**
 * Desfaz TODAS as movimentações e substituições. A dieta importada continua
 * intacta — nenhum bloco é apagado.
 */
export function restaurarDietaOriginal(dieta: Dieta): Dieta {
  return { ...dieta, blocos: dieta.blocos.filter((bloco) => !bloco.adicionado).map(restaurarBloco) };
}
