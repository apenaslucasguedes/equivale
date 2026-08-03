/**
 * Da lista analisada para blocos calóricos.
 *
 * Cada item precisa de um valor energético fixo. Ele pode vir:
 *  1. informado no arquivo (`| 150 kcal`) — sempre tem prioridade;
 *  2. calculado pela base, quando há correspondência CONFIÁVEL (nome ou alias
 *     idêntico após normalização, ou vínculo manual já registrado) e dá para
 *     determinar as gramas;
 *  3. de lugar nenhum — o item fica PENDENTE e vai para a etapa de conferência.
 *     Nada é descartado.
 */

import type {
  BlocoCalorico,
  Dieta,
  OrigemDasCalorias,
  PlanoAlimentar,
  VinculoDeAlimento,
} from '../domain/types';
import type { RepositorioDeAlimentos } from '../data/alimentos/repositorio';
import type { ItemImportado, ResultadoDaAnalise } from './analisadorMarkdown';
import { calcularCaloriasDaQuantidade } from '../domain/equivalencia';
import { normalizar } from '../domain/texto';
import { novoId } from '../domain/identificadores';
import { criarPlano } from '../domain/planos';

export interface ItemResolvido {
  item: ItemImportado;
  alimentoId: string | null;
  alimentoNome: string;
  kcal: number;
  origem: OrigemDasCalorias;
  /** Explicação curta de por que o item ficou pendente. */
  motivo: string | null;
}

function indexarPorNome(repositorio: RepositorioDeAlimentos): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const alimento of repositorio.todos()) {
    const chaves = [alimento.nome, ...(alimento.aliases ?? [])];
    for (const chave of chaves) {
      const normalizado = normalizar(chave);
      if (normalizado && !mapa.has(normalizado)) mapa.set(normalizado, alimento.id);
    }
  }
  return mapa;
}

/** Gramas do item, a partir do peso explícito, da unidade ou da medida caseira. */
export function determinarGramas(
  item: ItemImportado,
  repositorio: RepositorioDeAlimentos,
  alimentoId: string | null,
): number | null {
  if (item.gramas !== null) return item.gramas;
  if (item.unidade === 'g' || item.unidade === 'ml') return item.quantidade;
  if (!alimentoId) return null;

  const alimento = repositorio.porId(alimentoId);
  if (!alimento) return null;

  const unidadeNormalizada = normalizar(item.unidade);
  for (const porcao of alimento.porcoesCaseiras ?? []) {
    const medida = normalizar(porcao.medida);
    if (!medida.startsWith(unidadeNormalizada)) continue;
    if (!Number.isFinite(porcao.gramas) || !Number.isFinite(porcao.quantidade)) continue;
    if (porcao.quantidade <= 0) continue;
    return (item.quantidade * porcao.gramas) / porcao.quantidade;
  }
  return null;
}

export function resolverItens(
  itens: ItemImportado[],
  repositorio: RepositorioDeAlimentos,
  vinculos: VinculoDeAlimento[] = [],
): ItemResolvido[] {
  const porNome = indexarPorNome(repositorio);
  const porVinculo = new Map(vinculos.map((v) => [v.textoNormalizado, v.alimentoId]));

  return itens.map((item) => {
    const chave = normalizar(item.nomeAlimento);
    const idVinculado = porVinculo.get(chave) ?? null;
    const idPorNome = porNome.get(chave) ?? null;
    const alimentoId = idVinculado ?? idPorNome;

    if (item.kcalInformada !== null) {
      return {
        item,
        alimentoId,
        alimentoNome: item.nomeAlimento,
        kcal: item.kcalInformada,
        origem: 'informada' as OrigemDasCalorias,
        motivo: null,
      };
    }

    if (!alimentoId) {
      return {
        item,
        alimentoId: null,
        alimentoNome: item.nomeAlimento,
        kcal: 0,
        origem: 'pendente' as OrigemDasCalorias,
        motivo:
          repositorio.total() === 0
            ? 'Sem calorias no arquivo e não há base de alimentos carregada.'
            : 'Sem calorias no arquivo e sem correspondência exata na base.',
      };
    }

    const gramas = determinarGramas(item, repositorio, alimentoId);
    if (gramas === null) {
      return {
        item,
        alimentoId,
        alimentoNome: item.nomeAlimento,
        kcal: 0,
        origem: 'pendente' as OrigemDasCalorias,
        motivo: `Não dá para converter "${item.quantidade} ${item.unidade}" em gramas. Informe as calorias ou o peso.`,
      };
    }

    const alimento = repositorio.porId(alimentoId);
    const calculo = calcularCaloriasDaQuantidade(gramas, alimento?.kcalPor100g);
    if (!calculo.ok) {
      return {
        item,
        alimentoId,
        alimentoNome: item.nomeAlimento,
        kcal: 0,
        origem: 'pendente' as OrigemDasCalorias,
        motivo: calculo.erro,
      };
    }

    return {
      item,
      alimentoId,
      alimentoNome: item.nomeAlimento,
      kcal: calculo.valor,
      origem: 'calculada' as OrigemDasCalorias,
      motivo: null,
    };
  });
}

export function contarPendentes(resolvidos: ItemResolvido[]): number {
  return resolvidos.filter((r) => r.origem === 'pendente').length;
}

export function montarDieta(analise: ResultadoDaAnalise, resolvidos: ItemResolvido[]): Dieta {
  const contadorPorRefeicao = new Map<string, number>();

  const blocos: BlocoCalorico[] = resolvidos.map((resolvido) => {
    const { item } = resolvido;
    const ordem = contadorPorRefeicao.get(item.refeicaoId) ?? 0;
    contadorPorRefeicao.set(item.refeicaoId, ordem + 1);

    return {
      id: novoId('bloco'),
      original: {
        alimentoNome: item.nomeAlimento,
        alimentoId: resolvido.alimentoId,
        quantidade: item.quantidade,
        unidade: item.unidade,
        refeicaoId: item.refeicaoId,
      },
      atual: {
        alimentoNome: item.nomeAlimento,
        alimentoId: resolvido.alimentoId,
        quantidade: item.quantidade,
        unidade: item.unidade,
        refeicaoId: item.refeicaoId,
        medidaCaseira: null,
      },
      kcal: resolvido.kcal,
      origemDasCalorias: resolvido.origem,
      observacao: item.observacao,
      ordem,
    };
  });

  return {
    id: novoId('dieta'),
    titulo: analise.titulo,
    importadaEm: new Date().toISOString(),
    refeicoes: analise.refeicoes.filter((refeicao) =>
      blocos.some((bloco) => bloco.original.refeicaoId === refeicao.id),
    ),
    blocos,
  };
}

export interface OpcoesDoPlanoImportado {
  /**
   * Quando informado, o plano nasce com este id — é o caso de SUBSTITUIR um
   * plano existente. Sem ele, o id do front matter é usado; sem os dois, um id
   * local novo é gerado (plano novo).
   */
  id?: string;
  /** Sobrescreve o nome vindo do arquivo (título ou `planName`). */
  nome?: string;
}

/**
 * Monta o PLANO a ser adicionado ou substituído, juntando a dieta lida com os
 * metadados do front matter.
 */
export function montarPlano(
  analise: ResultadoDaAnalise,
  resolvidos: ItemResolvido[],
  opcoes: OpcoesDoPlanoImportado = {},
): PlanoAlimentar {
  return criarPlano({
    id: opcoes.id ?? analise.metadados.planId ?? undefined,
    nome: opcoes.nome ?? analise.metadados.planName ?? analise.titulo,
    diasSugeridos: analise.metadados.suggestedDays,
    dieta: montarDieta(analise, resolvidos),
  });
}
