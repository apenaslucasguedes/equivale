/**
 * Estrutura técnica de receitas caseiras — RECURSO FUTURO.
 *
 * Esta versão do Equivale traz apenas o modelo, os cálculos puros e os testes.
 * Não existe editor completo de receitas; a interface mostra só uma seção
 * discreta "Minhas receitas" identificada como recurso futuro.
 */

import type { Alimento, Receita, Resultado } from './types';
import { falha, ok } from './types';

export interface ResumoDaReceita {
  pesoFinalGramas: number;
  caloriasTotais: number;
  kcalPor100g: number;
}

export function resumirReceita(receita: Receita): Resultado<ResumoDaReceita> {
  if (!receita.ingredientes || receita.ingredientes.length === 0) {
    return falha('A receita não tem ingredientes.');
  }

  let caloriasTotais = 0;
  for (const ingrediente of receita.ingredientes) {
    if (!Number.isFinite(ingrediente.kcal) || ingrediente.kcal < 0) {
      return falha(`Ingrediente com calorias inválidas: ${ingrediente.nome}`);
    }
    caloriasTotais += ingrediente.kcal;
  }

  const pesoFinalGramas = receita.pesoFinalGramas;
  if (!Number.isFinite(pesoFinalGramas)) return falha('O peso final da receita é inválido.');
  if (pesoFinalGramas <= 0) return falha('O peso final da receita precisa ser maior que zero.');

  return ok({
    pesoFinalGramas,
    caloriasTotais,
    kcalPor100g: (caloriasTotais * 100) / pesoFinalGramas,
  });
}

/**
 * Converte uma receita em `Alimento`, para que ela possa ser usada como
 * qualquer outro item na substituição (categoria "receitas").
 */
export function receitaComoAlimento(receita: Receita): Resultado<Alimento> {
  const resumo = resumirReceita(receita);
  if (!resumo.ok) return falha(resumo.erro);

  return ok({
    id: receita.id,
    nome: receita.nome,
    aliases: [],
    categoria: 'receitas',
    preparo: null,
    kcalPor100g: resumo.valor.kcalPor100g,
    porcoesCaseiras: receita.porcoesCaseiras ?? [],
    fonte: 'Receita do usuário',
    codigoDaFonte: null,
    atualizadoEm: receita.criadaEm,
  });
}
