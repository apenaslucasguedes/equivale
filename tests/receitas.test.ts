/** Estrutura técnica de receitas — recurso futuro, já coberto por testes. */

import { describe, expect, it } from 'vitest';
import { receitaComoAlimento, resumirReceita } from '../src/domain/receitas';
import { calcularQuantidadeEquivalente } from '../src/domain/equivalencia';
import type { Receita } from '../src/domain/types';

const receita: Receita = {
  id: 'receita_1',
  nome: 'Bolo de banana da vovó',
  ingredientes: [
    { alimentoId: 'TEST_ONLY_banana_prata', nome: 'Banana prata', gramas: 300, kcal: 294 },
    { alimentoId: 'TEST_ONLY_aveia_flocos', nome: 'Aveia em flocos', gramas: 150, kcal: 585 },
    { alimentoId: 'TEST_ONLY_ovo_cozido', nome: 'Ovo', gramas: 100, kcal: 146 },
  ],
  pesoFinalGramas: 500,
  porcoesCaseiras: [{ medida: 'fatia', quantidade: 1, gramas: 60 }],
  criadaEm: '2026-01-01T00:00:00.000Z',
};

describe('resumirReceita', () => {
  it('soma as calorias e calcula kcal por 100 g pelo peso final', () => {
    const resultado = resumirReceita(receita);
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.valor.caloriasTotais).toBe(1025);
    expect(resultado.valor.pesoFinalGramas).toBe(500);
    expect(resultado.valor.kcalPor100g).toBe(205);
  });

  it('recusa receita sem ingredientes', () => {
    expect(resumirReceita({ ...receita, ingredientes: [] }).ok).toBe(false);
  });

  it('recusa peso final inválido', () => {
    expect(resumirReceita({ ...receita, pesoFinalGramas: 0 }).ok).toBe(false);
    expect(resumirReceita({ ...receita, pesoFinalGramas: Number.NaN }).ok).toBe(false);
  });

  it('recusa ingrediente com calorias inválidas', () => {
    const quebrada = {
      ...receita,
      ingredientes: [{ alimentoId: null, nome: 'X', gramas: 10, kcal: Number.NaN }],
    };
    expect(resumirReceita(quebrada).ok).toBe(false);
  });
});

describe('receitaComoAlimento', () => {
  it('produz um alimento utilizável na substituição', () => {
    const resultado = receitaComoAlimento(receita);
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    expect(resultado.valor.categoria).toBe('receitas');
    expect(resultado.valor.kcalPor100g).toBe(205);
    expect(resultado.valor.porcoesCaseiras).toHaveLength(1);

    const equivalente = calcularQuantidadeEquivalente(410, resultado.valor.kcalPor100g);
    expect(equivalente).toEqual({ ok: true, valor: 200 });
  });

  it('propaga o erro de uma receita inválida', () => {
    expect(receitaComoAlimento({ ...receita, pesoFinalGramas: -1 }).ok).toBe(false);
  });
});
