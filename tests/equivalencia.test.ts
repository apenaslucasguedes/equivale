import { describe, expect, it } from 'vitest';
import {
  ERROS,
  arredondarParaExibicao,
  calcularCaloriasDaQuantidade,
  calcularQuantidadeEquivalente,
  formatarQuantidade,
  sugerirMedidasCaseiras,
} from '../src/domain/equivalencia';

describe('calcularQuantidadeEquivalente', () => {
  it('aplica a fórmula kcal do bloco × 100 ÷ kcal por 100 g', () => {
    const resultado = calcularQuantidadeEquivalente(150, 300);
    expect(resultado).toEqual({ ok: true, valor: 50 });
  });

  it('mantém a precisão decimal completa', () => {
    const resultado = calcularQuantidadeEquivalente(150, 390);
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.valor).toBeCloseTo(38.46153846153846, 10);
  });

  it('devolve zero quando o bloco vale zero kcal', () => {
    expect(calcularQuantidadeEquivalente(0, 128)).toEqual({ ok: true, valor: 0 });
  });

  it('recusa divisão por zero', () => {
    expect(calcularQuantidadeEquivalente(150, 0)).toEqual({
      ok: false,
      erro: ERROS.DENSIDADE_ZERO,
    });
  });

  it('recusa densidade ausente', () => {
    expect(calcularQuantidadeEquivalente(150, null)).toEqual({
      ok: false,
      erro: ERROS.DENSIDADE_AUSENTE,
    });
    expect(calcularQuantidadeEquivalente(150, undefined)).toEqual({
      ok: false,
      erro: ERROS.DENSIDADE_AUSENTE,
    });
  });

  it('recusa números inválidos', () => {
    expect(calcularQuantidadeEquivalente(Number.NaN, 100).ok).toBe(false);
    expect(calcularQuantidadeEquivalente(Number.POSITIVE_INFINITY, 100).ok).toBe(false);
    expect(calcularQuantidadeEquivalente(150, Number.NaN).ok).toBe(false);
    expect(calcularQuantidadeEquivalente(150, 'abc' as unknown as number).ok).toBe(false);
  });

  it('recusa valores negativos', () => {
    expect(calcularQuantidadeEquivalente(-1, 100)).toEqual({
      ok: false,
      erro: ERROS.KCAL_BLOCO_NEGATIVA,
    });
    expect(calcularQuantidadeEquivalente(150, -100)).toEqual({
      ok: false,
      erro: ERROS.DENSIDADE_NEGATIVA,
    });
  });

  it('é reversível: converter de volta devolve as calorias do bloco', () => {
    const equivalente = calcularQuantidadeEquivalente(237, 88.5);
    expect(equivalente.ok).toBe(true);
    if (!equivalente.ok) return;
    const volta = calcularCaloriasDaQuantidade(equivalente.valor, 88.5);
    expect(volta.ok).toBe(true);
    if (!volta.ok) return;
    expect(volta.valor).toBeCloseTo(237, 10);
  });
});

describe('calcularCaloriasDaQuantidade', () => {
  it('calcula gramas × kcal/100 g ÷ 100', () => {
    expect(calcularCaloriasDaQuantidade(80, 76)).toEqual({ ok: true, valor: 60.8 });
  });

  it('aceita alimento com 0 kcal por 100 g', () => {
    expect(calcularCaloriasDaQuantidade(200, 0)).toEqual({ ok: true, valor: 0 });
  });

  it('recusa quantidade inválida', () => {
    expect(calcularCaloriasDaQuantidade(Number.NaN, 100)).toEqual({
      ok: false,
      erro: ERROS.QUANTIDADE_INVALIDA,
    });
  });
});

describe('arredondarParaExibicao', () => {
  const valor = 38.46153846153846;

  it('modo exato mantém duas casas', () => {
    expect(arredondarParaExibicao(valor, 'exato')).toEqual({ ok: true, valor: 38.46 });
  });

  it('modo grama arredonda para inteiro', () => {
    expect(arredondarParaExibicao(valor, 'grama')).toEqual({ ok: true, valor: 38 });
  });

  it('modo múltiplos de 5 arredonda para o múltiplo mais próximo', () => {
    expect(arredondarParaExibicao(valor, 'multiplo5')).toEqual({ ok: true, valor: 40 });
    expect(arredondarParaExibicao(12, 'multiplo5')).toEqual({ ok: true, valor: 10 });
    expect(arredondarParaExibicao(13, 'multiplo5')).toEqual({ ok: true, valor: 15 });
  });

  it('modo múltiplos de 5 nunca zera uma quantidade existente', () => {
    expect(arredondarParaExibicao(1.2, 'multiplo5')).toEqual({ ok: true, valor: 5 });
    expect(arredondarParaExibicao(0, 'multiplo5')).toEqual({ ok: true, valor: 0 });
  });

  it('modo caseira mantém o cálculo principal em gramas inteiras', () => {
    expect(arredondarParaExibicao(valor, 'caseira')).toEqual({ ok: true, valor: 38 });
  });

  it('arredonda meio para cima de forma estável', () => {
    expect(arredondarParaExibicao(2.5, 'grama')).toEqual({ ok: true, valor: 3 });
    expect(arredondarParaExibicao(2.675, 'exato')).toEqual({ ok: true, valor: 2.68 });
  });

  it('recusa números inválidos e negativos', () => {
    expect(arredondarParaExibicao(Number.NaN, 'grama').ok).toBe(false);
    expect(arredondarParaExibicao(-5, 'grama').ok).toBe(false);
  });
});

describe('formatarQuantidade', () => {
  it('usa o separador decimal do português', () => {
    expect(formatarQuantidade(38.46153846, 'exato')).toBe('38,46');
    expect(formatarQuantidade(38.46153846, 'grama')).toBe('38');
    expect(formatarQuantidade(1234.5, 'grama')).toBe('1.235');
  });

  it('devolve travessão para valores impossíveis', () => {
    expect(formatarQuantidade(Number.NaN, 'grama')).toBe('—');
  });
});

describe('sugerirMedidasCaseiras', () => {
  const porcoes = [
    { medida: 'fatia', quantidade: 1, gramas: 25 },
    { medida: 'unidade', quantidade: 1, gramas: 50 },
  ];

  it('sugere medidas em passos de meia unidade', () => {
    const sugestoes = sugerirMedidasCaseiras(60, porcoes);
    expect(sugestoes.map((s) => s.texto)).toContain('≈ 2,5 fatia');
  });

  it('ordena pela aproximação mais próxima das gramas calculadas', () => {
    const sugestoes = sugerirMedidasCaseiras(50, [
      { medida: 'fatia', quantidade: 1, gramas: 30 },
      { medida: 'unidade', quantidade: 1, gramas: 50 },
    ]);
    expect(sugestoes[0]?.medida).toBe('unidade');
    expect(sugestoes[0]?.gramasEquivalentes).toBe(50);
  });

  it('ignora porções com dados inválidos', () => {
    const sugestoes = sugerirMedidasCaseiras(50, [
      { medida: 'quebrada', quantidade: 0, gramas: 10 },
      { medida: 'invalida', quantidade: 1, gramas: 0 },
    ]);
    expect(sugestoes).toEqual([]);
  });

  it('devolve lista vazia sem porções ou com gramas não positivas', () => {
    expect(sugerirMedidasCaseiras(50, [])).toEqual([]);
    expect(sugerirMedidasCaseiras(50, null)).toEqual([]);
    expect(sugerirMedidasCaseiras(0, porcoes)).toEqual([]);
  });

  it('nunca sugere menos de meia medida', () => {
    const sugestoes = sugerirMedidasCaseiras(2, porcoes);
    expect(sugestoes.every((s) => s.quantidade >= 0.5)).toBe(true);
  });
});
