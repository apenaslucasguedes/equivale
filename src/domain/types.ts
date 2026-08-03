/**
 * Modelos centrais do Equivale.
 *
 * Princípios que o modelo precisa sustentar:
 * - Cada item importado é um BLOCO CALÓRICO independente com energia FIXA.
 * - O bloco guarda simultaneamente o estado ORIGINAL (prescrito) e o ATUAL.
 * - Substituir ou mover NUNCA altera `kcal`, nem o `id`, nem os campos originais.
 * - Categorias existem só para busca/organização; jamais restringem substituição.
 */

// ---------------------------------------------------------------- alimentos

export const CATEGORIAS = [
  'cereais-paes-massas-tuberculos',
  'leguminosas',
  'proteinas',
  'laticinios',
  'frutas',
  'hortalicas',
  'gorduras',
  'acucares-e-doces',
  'bebidas',
  'industrializados',
  'receitas',
] as const;

export type Categoria = (typeof CATEGORIAS)[number];

export const ROTULO_CATEGORIA: Record<Categoria, string> = {
  'cereais-paes-massas-tuberculos': 'Cereais, pães, massas e tubérculos',
  leguminosas: 'Leguminosas',
  proteinas: 'Proteínas',
  laticinios: 'Laticínios',
  frutas: 'Frutas',
  hortalicas: 'Hortaliças',
  gorduras: 'Gorduras',
  'acucares-e-doces': 'Açúcares e doces',
  bebidas: 'Bebidas',
  industrializados: 'Industrializados',
  receitas: 'Receitas',
};

/** Medida caseira aproximada de um alimento (ex.: 1 fatia = 25 g). */
export interface PorcaoCaseira {
  /** Nome da medida: unidade, fatia, colher de sopa, concha, copo, porção... */
  medida: string;
  /** Quantidade da medida que corresponde a `gramas` (normalmente 1). */
  quantidade: number;
  /** Peso em gramas correspondente a `quantidade` medidas. */
  gramas: number;
}

/**
 * Alimento da base nutricional. O formato é estável para permitir substituir as
 * fixtures de desenvolvimento por uma base real, extensa e validada, sem mexer
 * na aplicação.
 */
export interface Alimento {
  id: string;
  nome: string;
  aliases: string[];
  categoria: Categoria;
  /** Forma de preparo/apresentação: cru, cozido, grelhado, assado... */
  preparo: string | null;
  kcalPor100g: number;
  porcoesCaseiras: PorcaoCaseira[];
  /** Origem do dado (ex.: "TACO 4ª edição"). */
  fonte: string;
  /** Código do alimento na fonte, quando existir. */
  codigoDaFonte: string | null;
  /** ISO 8601 (data em que o registro foi atualizado na fonte). */
  atualizadoEm: string;
}

export interface BaseDeAlimentos {
  versao: number;
  fonte: string;
  /** Marca fixtures de desenvolvimento; a base real deve trazer `false`. */
  somenteParaTeste: boolean;
  alimentos: Alimento[];
}

// ---------------------------------------------------------------- refeições

/** Refeições canônicas, apenas para ordenar e reconhecer nomes na importação. */
export const REFEICOES_CANONICAS = [
  { id: 'cafe-da-manha', nome: 'Café da manhã' },
  { id: 'lanche-da-manha', nome: 'Lanche da manhã' },
  { id: 'almoco', nome: 'Almoço' },
  { id: 'lanche-da-tarde', nome: 'Lanche da tarde' },
  { id: 'jantar', nome: 'Jantar' },
  { id: 'ceia', nome: 'Ceia' },
] as const;

export interface Refeicao {
  id: string;
  nome: string;
  ordem: number;
}

// ------------------------------------------------------------------ blocos

export type Unidade = 'g' | 'ml' | 'unidade' | 'fatia' | 'colher' | 'concha' | 'copo' | 'porção';

export const UNIDADES: Unidade[] = [
  'g',
  'ml',
  'unidade',
  'fatia',
  'colher',
  'concha',
  'copo',
  'porção',
];

/** Como as calorias do bloco foram determinadas na importação. */
export type OrigemDasCalorias = 'informada' | 'calculada' | 'pendente';

/**
 * Bloco calórico: a unidade indivisível do Equivale.
 * `kcal` é fixo — trocar alimento ou mudar de refeição não o altera.
 */
export interface BlocoCalorico {
  id: string;

  /** Estado prescrito, imutável depois da importação. */
  original: {
    alimentoNome: string;
    alimentoId: string | null;
    quantidade: number;
    unidade: Unidade;
    refeicaoId: string;
  };

  /** Estado atual, alterado por substituições e movimentações. */
  atual: {
    alimentoNome: string;
    alimentoId: string | null;
    quantidade: number;
    unidade: Unidade;
    refeicaoId: string;
    /** Medida caseira aproximada exibida junto à quantidade, quando houver. */
    medidaCaseira: string | null;
  };

  /** Energia fixa do bloco, em kcal. */
  kcal: number;
  origemDasCalorias: OrigemDasCalorias;
  observacao: string | null;
  /** Ordem dentro da refeição (apenas apresentação). */
  ordem: number;
}

export interface Dieta {
  id: string;
  titulo: string;
  importadaEm: string;
  refeicoes: Refeicao[];
  blocos: BlocoCalorico[];
}

// ------------------------------------------------------------------- planos

/**
 * Dias da semana sugeridos para um plano. São apenas uma ANOTAÇÃO vinda da
 * nutricionista: nesta versão a troca de plano é sempre manual. Nenhuma
 * automação por dia da semana é aplicada.
 */
export const DIAS_DA_SEMANA = [
  'domingo',
  'segunda',
  'terca',
  'quarta',
  'quinta',
  'sexta',
  'sabado',
] as const;

export type DiaDaSemana = (typeof DIAS_DA_SEMANA)[number];

export const ROTULO_DIA: Record<DiaDaSemana, string> = {
  domingo: 'Domingo',
  segunda: 'Segunda-feira',
  terca: 'Terça-feira',
  quarta: 'Quarta-feira',
  quinta: 'Quinta-feira',
  sexta: 'Sexta-feira',
  sabado: 'Sábado',
};

export const ROTULO_DIA_CURTO: Record<DiaDaSemana, string> = {
  domingo: 'dom',
  segunda: 'seg',
  terca: 'ter',
  quarta: 'qua',
  quinta: 'qui',
  sexta: 'sex',
  sabado: 'sáb',
};

/**
 * Plano alimentar: uma dieta prescrita completa e INDEPENDENTE.
 *
 * Vários planos coexistem (“Dias úteis”, “Fim de semana”, …). Cada plano guarda
 * as suas próprias refeições, itens, movimentações, substituições e a sua
 * própria restauração original. Configurações e base de alimentos são
 * compartilhadas por todos os planos.
 */
export interface PlanoAlimentar {
  id: string;
  nome: string;
  /** Texto livre opcional (ex.: “semana de treino pesado”). */
  descricao: string | null;
  /** Dias sugeridos pela nutricionista. Informativo — não troca o plano sozinho. */
  diasSugeridos: DiaDaSemana[];
  /** ISO 8601 do momento da importação. */
  importadoEm: string;
  /** Dieta EXATAMENTE como foi importada. Nunca muda depois da importação. */
  dietaOriginal: Dieta;
  /** Estado atual do plano, com substituições e movimentações aplicadas. */
  dietaAtual: Dieta;
}

// ------------------------------------------------------------ configurações

export type ModoDeArredondamento = 'exato' | 'grama' | 'multiplo5' | 'caseira';

export const ROTULO_ARREDONDAMENTO: Record<ModoDeArredondamento, string> = {
  exato: 'Valor exato',
  grama: 'Grama inteira',
  multiplo5: 'Múltiplos de 5 g',
  caseira: 'Medida caseira aproximada',
};

export interface Configuracoes {
  arredondamento: ModoDeArredondamento;
  /** Modo de demonstração usa fixtures TEST_ONLY e é sinalizado na tela. */
  modoDemonstracao: boolean;
}

export const CONFIGURACOES_PADRAO: Configuracoes = {
  arredondamento: 'grama',
  modoDemonstracao: false,
};

/**
 * Vínculo manual entre um texto vindo da dieta importada e um alimento da base.
 * Fica guardado para reaproveitar em importações futuras.
 */
export interface VinculoDeAlimento {
  /** Texto normalizado do alimento como veio na dieta. */
  textoNormalizado: string;
  /** Texto exibido ao usuário. */
  textoOriginal: string;
  alimentoId: string;
  criadoEm: string;
}

// ------------------------------------------------------------ estado do app

/**
 * 1 → dieta única (`dieta: Dieta | null`).
 * 2 → coleção de planos (`planos: PlanoAlimentar[]` + `planoAtivoId`).
 *
 * A migração de 1 para 2 está em `persistencia/migracoes.ts` e transforma a
 * dieta única já guardada num plano chamado “Plano principal”.
 */
export const VERSAO_DO_ESQUEMA = 2;

/** Nome dado ao plano criado pela migração da dieta única. */
export const NOME_DO_PLANO_MIGRADO = 'Plano principal';

export interface EstadoPersistido {
  versaoDoEsquema: number;
  /** Todos os planos alimentares, independentes entre si. */
  planos: PlanoAlimentar[];
  /** Plano exibido agora. Persistido para reabrir o app onde o usuário parou. */
  planoAtivoId: string | null;
  /** Compartilhadas por todos os planos. */
  configuracoes: Configuracoes;
  /** Compartilhados por todos os planos. */
  vinculos: VinculoDeAlimento[];
  atualizadoEm: string;
}

export function estadoInicial(): EstadoPersistido {
  return {
    versaoDoEsquema: VERSAO_DO_ESQUEMA,
    planos: [],
    planoAtivoId: null,
    configuracoes: { ...CONFIGURACOES_PADRAO },
    vinculos: [],
    atualizadoEm: new Date().toISOString(),
  };
}

// -------------------------------------------------------------- receitas

/**
 * Estrutura técnica preparada para "Minhas receitas" (recurso futuro).
 * Nenhum editor completo é oferecido nesta versão; existe apenas o modelo,
 * a conversão para `Alimento` e os testes correspondentes.
 */
export interface IngredienteDeReceita {
  alimentoId: string | null;
  nome: string;
  gramas: number;
  kcal: number;
}

export interface Receita {
  id: string;
  nome: string;
  ingredientes: IngredienteDeReceita[];
  /** Peso final depois do preparo (pode diferir da soma dos ingredientes). */
  pesoFinalGramas: number;
  porcoesCaseiras: PorcaoCaseira[];
  criadaEm: string;
}

// ----------------------------------------------------------------- Resultado

/** Resultado explícito para cálculos que podem falhar, sem lançar exceções. */
export type Resultado<T> = { ok: true; valor: T } | { ok: false; erro: string };

export function ok<T>(valor: T): Resultado<T> {
  return { ok: true, valor };
}

export function falha<T = never>(erro: string): Resultado<T> {
  return { ok: false, erro };
}
