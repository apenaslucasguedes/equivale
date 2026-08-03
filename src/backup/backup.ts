/**
 * Exportação e restauração de backup em JSON.
 *
 * O arquivo guarda TODOS os planos alimentares (cada um com a sua dieta
 * original e o seu estado atual), qual deles estava ativo, os vínculos de
 * alimentos e as configurações. Assim o backup sobrevive mesmo que o usuário
 * tenha vários planos e muitas substituições.
 *
 * Backups do esquema 1 (dieta única) continuam sendo aceitos: a migração os
 * transforma num plano “Plano principal”.
 */

import type {
  Configuracoes,
  EstadoPersistido,
  PlanoAlimentar,
  VinculoDeAlimento,
} from '../domain/types';
import type { Resultado } from '../domain/types';
import { VERSAO_DO_ESQUEMA, estadoInicial, falha, ok } from '../domain/types';
import { contarAlteracoes, restaurarDietaOriginal } from '../domain/blocos';
import { planoAtivo } from '../domain/planos';
import { sanearEstado } from '../persistencia/migracoes';

export const APLICATIVO = 'equivale';

export interface ArquivoDeBackup {
  aplicativo: typeof APLICATIVO;
  versaoDoEsquema: number;
  geradoEm: string;
  /** Todos os planos, cada um com `dietaOriginal` e `dietaAtual`. */
  planos: PlanoAlimentar[];
  /** Plano que estava ativo quando o backup foi gerado. */
  planoAtivoId: string | null;
  vinculos: VinculoDeAlimento[];
  configuracoes: Configuracoes;
}

export interface ResumoDoPlanoNoBackup {
  id: string;
  nome: string;
  quantidadeDeRefeicoes: number;
  quantidadeDeBlocos: number;
  quantidadeDeAlteracoes: number;
  ativo: boolean;
}

export interface PreviaDoBackup {
  geradoEm: string;
  versaoDoEsquema: number;
  versaoMigrada: boolean;
  quantidadeDePlanos: number;
  /** Nome do plano ativo, ou "—" quando o backup não tem nenhum plano. */
  planoAtivo: string;
  planos: ResumoDoPlanoNoBackup[];
  quantidadeDeBlocos: number;
  quantidadeDeAlteracoes: number;
  quantidadeDeVinculos: number;
}

/** Garante que a `dietaOriginal` gravada realmente esteja sem alterações. */
function planoParaBackup(plano: PlanoAlimentar): PlanoAlimentar {
  return { ...plano, dietaOriginal: restaurarDietaOriginal(plano.dietaOriginal) };
}

export function gerarBackup(estado: EstadoPersistido): ArquivoDeBackup {
  return {
    aplicativo: APLICATIVO,
    versaoDoEsquema: VERSAO_DO_ESQUEMA,
    geradoEm: new Date().toISOString(),
    planos: estado.planos.map(planoParaBackup),
    planoAtivoId: estado.planoAtivoId,
    vinculos: estado.vinculos,
    configuracoes: estado.configuracoes,
  };
}

export function serializarBackup(estado: EstadoPersistido): string {
  return JSON.stringify(gerarBackup(estado), null, 2);
}

function comoNomeDeArquivo(bruto: string): string {
  return bruto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

export function nomeDoArquivoDeBackup(estado: EstadoPersistido): string {
  const data = new Date().toISOString().slice(0, 10);
  // Com mais de um plano o backup é da coleção inteira, não de um plano só.
  const rotulo =
    estado.planos.length === 1
      ? comoNomeDeArquivo(estado.planos[0]?.nome ?? 'planos')
      : estado.planos.length > 1
        ? 'planos'
        : 'equivale';
  return `equivale-backup-${rotulo || 'planos'}-${data}.json`;
}

export interface BackupInterpretado {
  estado: EstadoPersistido;
  previa: PreviaDoBackup;
  avisos: string[];
}

function resumirPlanos(estado: EstadoPersistido): ResumoDoPlanoNoBackup[] {
  return estado.planos.map((plano) => ({
    id: plano.id,
    nome: plano.nome,
    quantidadeDeRefeicoes: plano.dietaAtual.refeicoes.length,
    quantidadeDeBlocos: plano.dietaAtual.blocos.length,
    quantidadeDeAlteracoes: contarAlteracoes(plano.dietaAtual),
    ativo: plano.id === estado.planoAtivoId,
  }));
}

/** Lê e valida o conteúdo de um arquivo de backup. Nunca lança. */
export function interpretarBackup(conteudo: string): Resultado<BackupInterpretado> {
  let bruto: unknown;
  try {
    bruto = JSON.parse(conteudo);
  } catch {
    return falha('O arquivo não é um JSON válido.');
  }

  if (typeof bruto !== 'object' || bruto === null || Array.isArray(bruto)) {
    return falha('O arquivo não tem o formato esperado de backup.');
  }

  const arquivo = bruto as Partial<ArquivoDeBackup> & Record<string, unknown>;
  const avisos: string[] = [];

  // Sem nenhuma marca reconhecível, não vale tentar adivinhar o conteúdo.
  const temEstrutura =
    arquivo.aplicativo === APLICATIVO ||
    arquivo.versaoDoEsquema !== undefined ||
    arquivo.planos !== undefined ||
    arquivo.estadoAtual !== undefined ||
    arquivo.dietaOriginal !== undefined;
  if (!temEstrutura) {
    return falha('O arquivo não tem o formato esperado de backup do Equivale.');
  }

  if (arquivo.aplicativo !== APLICATIVO) {
    avisos.push('O arquivo não se identifica como backup do Equivale. Vamos tentar mesmo assim.');
  }

  const versaoOriginal =
    typeof arquivo.versaoDoEsquema === 'number' ? arquivo.versaoDoEsquema : VERSAO_DO_ESQUEMA;
  if (versaoOriginal > VERSAO_DO_ESQUEMA) {
    avisos.push(
      `O backup foi criado por uma versão mais nova (esquema ${versaoOriginal}). Parte dos dados pode não ser lida.`,
    );
  }

  const temPlanos = Array.isArray(arquivo.planos);

  // Backup do esquema 1: dieta única em `estadoAtual` / `dietaOriginal`.
  const dietaDoArquivo = temPlanos
    ? undefined
    : ((arquivo.estadoAtual && typeof arquivo.estadoAtual === 'object'
        ? (arquivo.estadoAtual as { dieta?: unknown }).dieta
        : undefined) ?? arquivo.dietaOriginal);

  if (!temPlanos && versaoOriginal <= 1) {
    avisos.push(
      `Backup no formato antigo (dieta única). Ele vira um plano chamado “Plano principal”.`,
    );
  }

  const saneado = sanearEstado(
    temPlanos
      ? {
          versaoDoEsquema: versaoOriginal,
          planos: arquivo.planos,
          planoAtivoId: arquivo.planoAtivoId ?? null,
          configuracoes: arquivo.configuracoes,
          vinculos: arquivo.vinculos,
          atualizadoEm: arquivo.geradoEm,
        }
      : {
          versaoDoEsquema: 1,
          dieta: dietaDoArquivo ?? null,
          configuracoes: arquivo.configuracoes,
          vinculos: arquivo.vinculos,
          atualizadoEm: arquivo.geradoEm,
        },
  );

  if (!saneado.ok) return falha(saneado.erro);

  const estado: EstadoPersistido = { ...estadoInicial(), ...saneado.valor };

  const trouxeConteudo = temPlanos
    ? (arquivo.planos as unknown[]).length > 0
    : dietaDoArquivo !== undefined && dietaDoArquivo !== null;

  if (trouxeConteudo && estado.planos.length === 0) {
    return falha('Os planos do backup estão incompletos ou corrompidos e não puderam ser lidos.');
  }
  if (!trouxeConteudo) {
    avisos.push('O backup não contém nenhum plano alimentar.');
  }

  const planos = resumirPlanos(estado);

  return ok({
    estado,
    avisos,
    previa: {
      geradoEm: typeof arquivo.geradoEm === 'string' ? arquivo.geradoEm : 'data desconhecida',
      versaoDoEsquema: versaoOriginal,
      versaoMigrada: versaoOriginal !== VERSAO_DO_ESQUEMA,
      quantidadeDePlanos: estado.planos.length,
      planoAtivo: planoAtivo(estado)?.nome ?? '—',
      planos,
      quantidadeDeBlocos: planos.reduce((total, p) => total + p.quantidadeDeBlocos, 0),
      quantidadeDeAlteracoes: planos.reduce((total, p) => total + p.quantidadeDeAlteracoes, 0),
      quantidadeDeVinculos: estado.vinculos.length,
    },
  });
}
