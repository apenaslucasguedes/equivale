/**
 * Cálculo de equivalência calórica e arredondamento.
 *
 * Todas as funções deste arquivo são PURAS e testáveis isoladamente.
 *
 * Regra central:
 *   quantidadeEquivalente(g) = (kcal fixas do bloco × 100) ÷ kcal por 100 g do alimento
 *
 * A precisão decimal completa é mantida internamente; o arredondamento é
 * aplicado SOMENTE na apresentação (ver `arredondarParaExibicao`).
 */

import type { ModoDeArredondamento, PorcaoCaseira, Resultado } from './types';
import { falha, ok } from './types';
import { formatarNumero } from './texto';

export const ERROS = {
  KCAL_BLOCO_INVALIDA: 'As calorias do bloco não são um número válido.',
  KCAL_BLOCO_NEGATIVA: 'As calorias do bloco não podem ser negativas.',
  DENSIDADE_AUSENTE: 'O alimento escolhido não informa kcal por 100 g.',
  DENSIDADE_INVALIDA: 'As kcal por 100 g do alimento não são um número válido.',
  DENSIDADE_ZERO: 'Não é possível calcular: o alimento tem 0 kcal por 100 g.',
  DENSIDADE_NEGATIVA: 'As kcal por 100 g do alimento não podem ser negativas.',
  QUANTIDADE_INVALIDA: 'A quantidade informada não é um número válido.',
  QUANTIDADE_NEGATIVA: 'A quantidade não pode ser negativa.',
} as const;

function numeroFinito(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor);
}

/**
 * Quantidade, em gramas, do alimento escolhido que entrega exatamente as
 * calorias fixas do bloco. Sem arredondamento.
 */
export function calcularQuantidadeEquivalente(
  kcalDoBloco: number,
  kcalPor100g: number | null | undefined,
): Resultado<number> {
  if (!numeroFinito(kcalDoBloco)) return falha(ERROS.KCAL_BLOCO_INVALIDA);
  if (kcalDoBloco < 0) return falha(ERROS.KCAL_BLOCO_NEGATIVA);
  if (kcalPor100g === null || kcalPor100g === undefined) return falha(ERROS.DENSIDADE_AUSENTE);
  if (!numeroFinito(kcalPor100g)) return falha(ERROS.DENSIDADE_INVALIDA);
  if (kcalPor100g < 0) return falha(ERROS.DENSIDADE_NEGATIVA);
  if (kcalPor100g === 0) return falha(ERROS.DENSIDADE_ZERO);

  return ok((kcalDoBloco * 100) / kcalPor100g);
}

/** Energia de uma quantidade em gramas — usado na importação e nas receitas. */
export function calcularCaloriasDaQuantidade(
  gramas: number,
  kcalPor100g: number | null | undefined,
): Resultado<number> {
  if (!numeroFinito(gramas)) return falha(ERROS.QUANTIDADE_INVALIDA);
  if (gramas < 0) return falha(ERROS.QUANTIDADE_NEGATIVA);
  if (kcalPor100g === null || kcalPor100g === undefined) return falha(ERROS.DENSIDADE_AUSENTE);
  if (!numeroFinito(kcalPor100g)) return falha(ERROS.DENSIDADE_INVALIDA);
  if (kcalPor100g < 0) return falha(ERROS.DENSIDADE_NEGATIVA);

  return ok((gramas * kcalPor100g) / 100);
}

// --------------------------------------------------------- arredondamento

/** Arredonda meio para cima de forma estável (evita o viés do `toFixed`). */
function arredondarMeioParaCima(valor: number, casas = 0): number {
  const fator = 10 ** casas;
  const escalado = valor * fator;
  // Correção de erro binário antes de arredondar (ex.: 2.675 * 100 = 267.49999…).
  const corrigido = Number(escalado.toPrecision(12));
  return Math.round(corrigido) / fator;
}

/**
 * Aplica o modo de arredondamento escolhido pelo usuário.
 * O modo `caseira` não muda o número em gramas: a aproximação caseira é uma
 * informação adicional, exibida ao lado (ver `sugerirMedidasCaseiras`).
 */
export function arredondarParaExibicao(
  gramas: number,
  modo: ModoDeArredondamento,
): Resultado<number> {
  if (!numeroFinito(gramas)) return falha(ERROS.QUANTIDADE_INVALIDA);
  if (gramas < 0) return falha(ERROS.QUANTIDADE_NEGATIVA);

  switch (modo) {
    case 'exato':
      return ok(arredondarMeioParaCima(gramas, 2));
    case 'grama':
      return ok(arredondarMeioParaCima(gramas, 0));
    case 'multiplo5': {
      const arredondado = Math.round(Number((gramas / 5).toPrecision(12))) * 5;
      // Nunca zerar um bloco que tem quantidade: o mínimo vira 5 g.
      return ok(gramas > 0 && arredondado === 0 ? 5 : arredondado);
    }
    case 'caseira':
      return ok(arredondarMeioParaCima(gramas, 0));
    default:
      return falha(`Modo de arredondamento desconhecido: ${String(modo)}`);
  }
}

/** Texto pronto para a interface, já arredondado conforme a preferência. */
export function formatarQuantidade(gramas: number, modo: ModoDeArredondamento): string {
  const resultado = arredondarParaExibicao(gramas, modo);
  if (!resultado.ok) return '—';
  return formatarNumero(resultado.valor, modo === 'exato' ? 2 : 0);
}

// -------------------------------------------------------- medidas caseiras

export interface MedidaCaseiraSugerida {
  medida: string;
  /** Quantidade aproximada de medidas (ex.: 1,5 fatia). */
  quantidade: number;
  /** Texto pronto: "≈ 1,5 fatia". */
  texto: string;
  /** Gramas exatas que a sugestão representa (para transparência). */
  gramasEquivalentes: number;
}

/**
 * Converte uma quantidade em gramas para medidas caseiras aproximadas.
 * As medidas são SEMPRE aproximações; o cálculo principal continua em gramas.
 */
export function sugerirMedidasCaseiras(
  gramas: number,
  porcoes: PorcaoCaseira[] | null | undefined,
  opcoes: { limite?: number } = {},
): MedidaCaseiraSugerida[] {
  if (!numeroFinito(gramas) || gramas <= 0) return [];
  if (!porcoes || porcoes.length === 0) return [];

  const limite = opcoes.limite ?? 3;
  const sugestoes: MedidaCaseiraSugerida[] = [];

  for (const porcao of porcoes) {
    if (!numeroFinito(porcao.gramas) || porcao.gramas <= 0) continue;
    if (!numeroFinito(porcao.quantidade) || porcao.quantidade <= 0) continue;

    const gramasPorMedida = porcao.gramas / porcao.quantidade;
    const bruto = gramas / gramasPorMedida;
    // Aproxima para 1/2 medida — granularidade que faz sentido na cozinha.
    const quantidade = Math.max(0.5, Math.round(bruto * 2) / 2);

    sugestoes.push({
      medida: porcao.medida,
      quantidade,
      texto: `≈ ${formatarNumero(quantidade, 1)} ${porcao.medida}`,
      gramasEquivalentes: arredondarMeioParaCima(quantidade * gramasPorMedida, 2),
    });
  }

  // Prioriza a medida cuja aproximação menos se afasta das gramas calculadas.
  sugestoes.sort(
    (a, b) => Math.abs(a.gramasEquivalentes - gramas) - Math.abs(b.gramasEquivalentes - gramas),
  );
  return sugestoes.slice(0, limite);
}

export { arredondarMeioParaCima };
