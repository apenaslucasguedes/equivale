/** Ações e redutor do estado do aplicativo — puros e testáveis. */

import type {
  BlocoCalorico,
  Dieta,
  EstadoPersistido,
  ModoDeArredondamento,
  PlanoAlimentar,
  VinculoDeAlimento,
} from '../domain/types';
import { estadoInicial } from '../domain/types';
import type { DadosDaSubstituicao } from '../domain/blocos';
import type { DadosDoConsumo, DadosDoNovoConsumo } from '../domain/blocos';
import {
  adicionarAlimentoNaDieta,
  ajustarAlimentoNaDieta,
  moverBlocoNaDieta,
  removerBlocoDaDieta,
  restaurarBlocoNaDieta,
  substituirAlimentoNaDieta,
} from '../domain/blocos';
import {
  adicionarPlano,
  ativarPlano,
  comPlanoAtivoValido,
  excluirPlano,
  mapearDietaDoPlano,
  mapearPlano,
  renomearPlano,
  restaurarPlano,
  substituirPlano,
} from '../domain/planos';

export type Acao =
  | { tipo: 'estadoCarregado'; estado: EstadoPersistido }
  /** Importação: acrescenta um plano à coleção, sem tocar nos existentes. */
  | { tipo: 'planoAdicionado'; plano: PlanoAlimentar }
  /** Importação: substitui SÓ o plano de mesmo id. */
  | { tipo: 'planoSubstituido'; plano: PlanoAlimentar }
  | { tipo: 'planoAtivado'; planoId: string }
  | { tipo: 'planoRenomeado'; planoId: string; nome: string }
  | { tipo: 'planoExcluido'; planoId: string }
  | { tipo: 'substituirAlimento'; blocoId: string; dados: DadosDaSubstituicao }
  | { tipo: 'moverBloco'; blocoId: string; refeicaoId: string; posicao?: number }
  | { tipo: 'restaurarBloco'; blocoId: string }
  | { tipo: 'ajustarConsumo'; blocoId: string; dados: DadosDoConsumo }
  | { tipo: 'adicionarConsumo'; dados: DadosDoNovoConsumo }
  | { tipo: 'removerConsumo'; blocoId: string }
  /** Desfaz as alterações do plano ativo (ou do plano indicado). */
  | { tipo: 'restaurarDieta'; planoId?: string }
  | { tipo: 'resolverPendencia'; blocoId: string; alimentoId: string; nome: string; kcal: number }
  | { tipo: 'definirCalorias'; blocoId: string; kcal: number }
  | { tipo: 'registrarVinculo'; vinculo: VinculoDeAlimento }
  | { tipo: 'definirArredondamento'; modo: ModoDeArredondamento }
  | { tipo: 'definirModoDemonstracao'; ativo: boolean }
  | { tipo: 'substituirEstado'; estado: EstadoPersistido }
  | { tipo: 'apagarTudo' };

/** Aplica uma transformação à dieta do plano ATIVO. Os outros planos ficam intactos. */
function comDietaAtiva(
  estado: EstadoPersistido,
  transformar: (dieta: Dieta) => Dieta,
): EstadoPersistido {
  return mapearDietaDoPlano(estado, estado.planoAtivoId, transformar);
}

/**
 * Resolve um item que entrou pendente: passa a ter alimento vinculado e
 * calorias fixas. O estado ORIGINAL do bloco também recebe o vínculo, porque
 * é a prescrição que estava incompleta — não uma escolha do usuário.
 */
function resolverBloco(
  bloco: BlocoCalorico,
  alimentoId: string,
  nome: string,
  kcal: number,
): BlocoCalorico {
  const eraOriginal =
    bloco.atual.alimentoNome === bloco.original.alimentoNome &&
    bloco.atual.alimentoId === bloco.original.alimentoId;

  return {
    ...bloco,
    kcal,
    origemDasCalorias: 'calculada',
    original: { ...bloco.original, alimentoId },
    atual: eraOriginal ? { ...bloco.atual, alimentoId, alimentoNome: nome } : bloco.atual,
  };
}

/**
 * Resolver uma pendência corrige a PRESCRIÇÃO, então precisa valer também para
 * a dieta original guardada no plano — senão restaurar traria o item pendente
 * de volta.
 */
function resolverPendenciaNoPlano(
  plano: PlanoAlimentar,
  blocoId: string,
  alimentoId: string,
  nome: string,
  kcal: number,
): PlanoAlimentar {
  const aplicar = (dieta: Dieta): Dieta => ({
    ...dieta,
    blocos: dieta.blocos.map((bloco) =>
      bloco.id === blocoId ? resolverBloco(bloco, alimentoId, nome, kcal) : bloco,
    ),
  });

  return {
    ...plano,
    dietaOriginal: aplicar(plano.dietaOriginal),
    dietaAtual: aplicar(plano.dietaAtual),
  };
}

/** Informar as calorias de um bloco também corrige a prescrição guardada. */
function definirCaloriasNoPlano(
  plano: PlanoAlimentar,
  blocoId: string,
  kcal: number,
): PlanoAlimentar {
  if (!Number.isFinite(kcal) || kcal < 0) return plano;

  const aplicar = (dieta: Dieta): Dieta => ({
    ...dieta,
    blocos: dieta.blocos.map((bloco) =>
      bloco.id === blocoId ? { ...bloco, kcal, origemDasCalorias: 'informada' as const } : bloco,
    ),
  });

  return {
    ...plano,
    dietaOriginal: aplicar(plano.dietaOriginal),
    dietaAtual: aplicar(plano.dietaAtual),
  };
}

export function redutor(estado: EstadoPersistido, acao: Acao): EstadoPersistido {
  switch (acao.tipo) {
    case 'estadoCarregado':
    case 'substituirEstado':
      return comPlanoAtivoValido(acao.estado);

    case 'planoAdicionado':
      return adicionarPlano(estado, acao.plano);

    case 'planoSubstituido':
      return substituirPlano(estado, acao.plano);

    case 'planoAtivado':
      return ativarPlano(estado, acao.planoId);

    case 'planoRenomeado':
      return renomearPlano(estado, acao.planoId, acao.nome);

    case 'planoExcluido':
      return excluirPlano(estado, acao.planoId);

    case 'substituirAlimento':
      return comDietaAtiva(estado, (dieta) =>
        substituirAlimentoNaDieta(dieta, acao.blocoId, acao.dados),
      );

    case 'moverBloco':
      return comDietaAtiva(estado, (dieta) =>
        moverBlocoNaDieta(dieta, acao.blocoId, acao.refeicaoId, acao.posicao),
      );

    case 'restaurarBloco':
      return comDietaAtiva(estado, (dieta) => restaurarBlocoNaDieta(dieta, acao.blocoId));

    case 'ajustarConsumo':
      return comDietaAtiva(estado, (dieta) => ajustarAlimentoNaDieta(dieta, acao.blocoId, acao.dados));

    case 'adicionarConsumo':
      return comDietaAtiva(estado, (dieta) => adicionarAlimentoNaDieta(dieta, acao.dados));

    case 'removerConsumo':
      return comDietaAtiva(estado, (dieta) => removerBlocoDaDieta(dieta, acao.blocoId));

    case 'restaurarDieta':
      return restaurarPlano(estado, acao.planoId ?? estado.planoAtivoId);

    case 'resolverPendencia':
      return mapearPlano(estado, estado.planoAtivoId, (plano) =>
        resolverPendenciaNoPlano(plano, acao.blocoId, acao.alimentoId, acao.nome, acao.kcal),
      );

    case 'definirCalorias':
      return mapearPlano(estado, estado.planoAtivoId, (plano) =>
        definirCaloriasNoPlano(plano, acao.blocoId, acao.kcal),
      );

    case 'registrarVinculo': {
      const outros = estado.vinculos.filter(
        (v) => v.textoNormalizado !== acao.vinculo.textoNormalizado,
      );
      return { ...estado, vinculos: [...outros, acao.vinculo] };
    }

    case 'definirArredondamento':
      return {
        ...estado,
        configuracoes: { ...estado.configuracoes, arredondamento: acao.modo },
      };

    case 'definirModoDemonstracao':
      return {
        ...estado,
        configuracoes: { ...estado.configuracoes, modoDemonstracao: acao.ativo },
      };

    case 'apagarTudo':
      return estadoInicial();

    default:
      return estado;
  }
}
