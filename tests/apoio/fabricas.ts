/** Fábricas de dados para os testes. Usam SOMENTE fixtures TEST_ONLY. */

import type {
  BlocoCalorico,
  DiaDaSemana,
  Dieta,
  EstadoPersistido,
  PlanoAlimentar,
  Unidade,
} from '../../src/domain/types';
import { estadoInicial } from '../../src/domain/types';
import { restaurarDietaOriginal } from '../../src/domain/blocos';
import { ordenarDias } from '../../src/domain/planos';
import { RepositorioEmMemoria } from '../../src/data/alimentos/repositorio';
import { TEST_ONLY_BASE_DE_ALIMENTOS } from '../../src/data/alimentos/TEST_ONLY.fixtures';

export async function criarRepositorioDeTeste(): Promise<RepositorioEmMemoria> {
  const repositorio = new RepositorioEmMemoria(async () => TEST_ONLY_BASE_DE_ALIMENTOS);
  await repositorio.carregar();
  return repositorio;
}

export function criarRepositorioSincrono(): RepositorioEmMemoria {
  const repositorio = new RepositorioEmMemoria(async () => TEST_ONLY_BASE_DE_ALIMENTOS);
  repositorio.definirBase(TEST_ONLY_BASE_DE_ALIMENTOS);
  return repositorio;
}

export interface OpcoesDeBloco {
  id?: string;
  nome?: string;
  alimentoId?: string | null;
  quantidade?: number;
  unidade?: Unidade;
  refeicaoId?: string;
  kcal?: number;
  ordem?: number;
}

export function criarBloco(opcoes: OpcoesDeBloco = {}): BlocoCalorico {
  const nome = opcoes.nome ?? 'Pão francês';
  const quantidade = opcoes.quantidade ?? 50;
  const unidade = opcoes.unidade ?? 'g';
  const refeicaoId = opcoes.refeicaoId ?? 'cafe-da-manha';
  return {
    id: opcoes.id ?? 'bloco_1',
    original: {
      alimentoNome: nome,
      alimentoId: opcoes.alimentoId ?? null,
      quantidade,
      unidade,
      refeicaoId,
    },
    atual: {
      alimentoNome: nome,
      alimentoId: opcoes.alimentoId ?? null,
      quantidade,
      unidade,
      refeicaoId,
      medidaCaseira: null,
    },
    kcal: opcoes.kcal ?? 150,
    origemDasCalorias: 'informada',
    observacao: null,
    ordem: opcoes.ordem ?? 0,
  };
}

export function criarDieta(blocos: BlocoCalorico[] = [criarBloco()]): Dieta {
  return {
    id: 'dieta_teste',
    titulo: 'Dieta de teste',
    importadaEm: '2026-01-01T00:00:00.000Z',
    refeicoes: [
      { id: 'cafe-da-manha', nome: 'Café da manhã', ordem: 0 },
      { id: 'almoco', nome: 'Almoço', ordem: 1 },
      { id: 'jantar', nome: 'Jantar', ordem: 2 },
    ],
    blocos,
  };
}

export interface OpcoesDePlano {
  id?: string;
  nome?: string;
  descricao?: string | null;
  diasSugeridos?: DiaDaSemana[];
  dieta?: Dieta;
}

export function criarPlanoDeTeste(opcoes: OpcoesDePlano = {}): PlanoAlimentar {
  const dieta = opcoes.dieta ?? criarDieta();
  return {
    id: opcoes.id ?? 'plano_teste',
    nome: opcoes.nome ?? 'Plano de teste',
    descricao: opcoes.descricao ?? null,
    diasSugeridos: ordenarDias(opcoes.diasSugeridos ?? []),
    importadoEm: '2026-01-01T00:00:00.000Z',
    dietaOriginal: restaurarDietaOriginal(dieta),
    dietaAtual: dieta,
  };
}

/** Estado com os planos informados; o primeiro nasce ativo. */
export function criarEstadoComPlanos(
  planos: PlanoAlimentar[] = [criarPlanoDeTeste()],
): EstadoPersistido {
  return {
    ...estadoInicial(),
    planos,
    planoAtivoId: planos[0]?.id ?? null,
  };
}
