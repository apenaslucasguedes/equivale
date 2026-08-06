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
  Alimento,
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
  opcoesCorrespondencia: Alimento[];
}

function indexarPorNome(repositorio: RepositorioDeAlimentos): Map<string, string[]> {
  const mapa = new Map<string, string[]>();
  for (const alimento of repositorio.todos()) {
    const chaves = [alimento.nome, ...(alimento.aliases ?? [])];
    for (const chave of chaves) {
      const normalizado = normalizar(chave);
      if (!normalizado) continue;
      const ids = mapa.get(normalizado) ?? [];
      if (!ids.includes(alimento.id)) ids.push(alimento.id);
      mapa.set(normalizado, ids);
    }
  }
  return mapa;
}

const SINGULARES_DE_MEDIDA: Record<string, string> = {
  colheres: 'colher', conchas: 'concha', copos: 'copo', escumadeiras: 'escumadeira',
  fatias: 'fatia', unidades: 'unidade', porcoes: 'porcao', pedacos: 'pedaco', bifes: 'bife',
  files: 'file', potes: 'pote', saches: 'sache', pacotes: 'pacote', xicaras: 'xicara',
  pequenas: 'pequena', pequenos: 'pequeno', cheias: 'cheia', cheios: 'cheio',
};

export function normalizarMedida(medida: string): string {
  const partes = normalizar(medida).split(' ').filter(Boolean);
  partes.forEach((parte, indice) => {
    if (SINGULARES_DE_MEDIDA[parte]) partes[indice] = SINGULARES_DE_MEDIDA[parte];
  });
  return partes.join(' ');
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

  const unidadeNormalizada = normalizarMedida(item.descricaoMedidaOriginal ?? item.unidade);
  for (const porcao of alimento.porcoesCaseiras ?? []) {
    const medida = normalizarMedida(porcao.medida);
    // A base pode qualificar a mesma medida ("colher de sopa cheia"); a
    // prescrição nunca pode ser mais específica do que a porção cadastrada.
    if (medida !== unidadeNormalizada && !medida.startsWith(`${unidadeNormalizada} `)) continue;
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
    const alimentoPorId = item.alimentoIdInformado
      ? repositorio.porId(item.alimentoIdInformado)
      : undefined;
    const idsCorrespondentes = alimentoPorId
      ? [alimentoPorId.id]
      : idVinculado ? [idVinculado] : (porNome.get(chave) ?? []);
    const opcoesCorrespondencia = idsCorrespondentes
      .map((id) => repositorio.porId(id))
      .filter((alimento): alimento is Alimento => alimento !== undefined);
    const alimentoId = idsCorrespondentes.length === 1 ? (idsCorrespondentes[0] ?? null) : null;

    if (item.livre) {
      return {
        item,
        alimentoId,
        alimentoNome: item.nomeAlimento,
        kcal: 0,
        origem: 'livre' as OrigemDasCalorias,
        motivo: null,
        opcoesCorrespondencia,
      };
    }

    if (item.kcalInformada !== null) {
      return {
        item,
        alimentoId,
        alimentoNome: item.nomeAlimento,
        kcal: item.kcalInformada,
        origem: 'informada' as OrigemDasCalorias,
        motivo: null,
        opcoesCorrespondencia,
      };
    }

    if (idsCorrespondentes.length > 1) {
      return {
        item,
        alimentoId: null,
        alimentoNome: item.nomeAlimento,
        kcal: 0,
        origem: 'pendente' as OrigemDasCalorias,
        motivo: 'Mais de uma correspondência encontrada',
        opcoesCorrespondencia,
      };
    }

    if (!alimentoId) {
      return {
        item,
        alimentoId: null,
        alimentoNome: item.nomeAlimento,
        kcal: 0,
        origem: 'pendente' as OrigemDasCalorias,
        motivo: repositorio.total() === 0 ? 'Base nutricional não carregada' : 'Alimento não encontrado na base',
        opcoesCorrespondencia: [],
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
        motivo: 'Medida sem peso conhecido',
        opcoesCorrespondencia,
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
        opcoesCorrespondencia,
      };
    }

    return {
      item,
      alimentoId,
      alimentoNome: item.nomeAlimento,
      kcal: calculo.valor,
      origem: 'calculada' as OrigemDasCalorias,
      motivo: null,
      opcoesCorrespondencia,
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
      ...(item.livre ? { livre: true } : {}),
      original: {
        alimentoNome: item.nomeAlimento,
        alimentoId: resolvido.alimentoId,
        quantidade: item.quantidade,
        unidade: item.unidade,
        pesoGramas: item.gramas,
        descricaoMedidaOriginal: item.descricaoMedidaOriginal,
        refeicaoId: item.refeicaoId,
      },
      atual: {
        alimentoNome: item.nomeAlimento,
        alimentoId: resolvido.alimentoId,
        quantidade: item.quantidade,
        unidade: item.unidade,
        pesoGramas: item.gramas,
        descricaoMedidaOriginal: item.descricaoMedidaOriginal,
        refeicaoId: item.refeicaoId,
        medidaCaseira: null,
      },
      kcal: resolvido.kcal,
      origemDasCalorias: resolvido.origem,
      motivoPendencia: resolvido.motivo,
      opcoesCorrespondencia: resolvido.opcoesCorrespondencia.map(({ id, nome }) => ({ id, nome })),
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
