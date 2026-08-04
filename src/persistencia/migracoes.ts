/**
 * Validação e migração do estado persistido.
 *
 * O mesmo código serve para o que vem do IndexedDB e para o que vem de um
 * arquivo de backup enviado pelo usuário — ambos são dados não confiáveis.
 *
 * Versões do esquema:
 *   1 → dieta única (`dieta: Dieta | null`)
 *   2 → coleção de planos (`planos: PlanoAlimentar[]` + `planoAtivoId`)
 */

import type {
  BlocoCalorico,
  Configuracoes,
  DiaDaSemana,
  Dieta,
  EstadoPersistido,
  ModoDeArredondamento,
  PlanoAlimentar,
  Refeicao,
  Resultado,
  Unidade,
  VinculoDeAlimento,
} from '../domain/types';
import {
  CONFIGURACOES_PADRAO,
  DIAS_DA_SEMANA,
  NOME_DO_PLANO_MIGRADO,
  VERSAO_DO_ESQUEMA,
  estadoInicial,
  falha,
  ok,
} from '../domain/types';
import { restaurarDietaOriginal } from '../domain/blocos';
import { comPlanoAtivoValido } from '../domain/planos';
import { novoId } from '../domain/identificadores';

const MODOS: ModoDeArredondamento[] = ['exato', 'grama', 'multiplo5', 'caseira'];

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function texto(valor: unknown, padrao = ''): string {
  return typeof valor === 'string' ? valor : padrao;
}

function numero(valor: unknown, padrao = 0): number {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : padrao;
}

function unidade(valor: unknown): Unidade {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : 'g';
}

function descricaoMedida(valor: Record<string, unknown>): { descricaoMedidaOriginal?: string | null } {
  if (!('descricaoMedidaOriginal' in valor)) return {};
  const descricao = valor.descricaoMedidaOriginal;
  return typeof descricao === 'string' || descricao === null
    ? { descricaoMedidaOriginal: descricao as string | null }
    : {};
}

function sanearRefeicao(valor: unknown, indice: number): Refeicao | null {
  if (!ehObjeto(valor)) return null;
  const id = texto(valor.id);
  if (!id) return null;
  return { id, nome: texto(valor.nome, id), ordem: numero(valor.ordem, indice) };
}

function sanearBloco(valor: unknown, indice: number): BlocoCalorico | null {
  if (!ehObjeto(valor)) return null;
  const id = texto(valor.id);
  if (!id) return null;

  const original = ehObjeto(valor.original) ? valor.original : {};
  const atual = ehObjeto(valor.atual) ? valor.atual : {};

  const refeicaoOriginal = texto(original.refeicaoId);
  if (!refeicaoOriginal) return null;

  const origem = texto(valor.origemDasCalorias, 'informada');

  return {
    id,
    original: {
      alimentoNome: texto(original.alimentoNome, 'Item sem nome'),
      alimentoId: typeof original.alimentoId === 'string' ? original.alimentoId : null,
      quantidade: numero(original.quantidade, 0),
      unidade: unidade(original.unidade),
      ...descricaoMedida(original),
      refeicaoId: refeicaoOriginal,
    },
    atual: {
      alimentoNome: texto(atual.alimentoNome, texto(original.alimentoNome, 'Item sem nome')),
      alimentoId: typeof atual.alimentoId === 'string' ? atual.alimentoId : null,
      quantidade: numero(atual.quantidade, numero(original.quantidade, 0)),
      unidade: unidade(atual.unidade ?? original.unidade),
      ...(Object.prototype.hasOwnProperty.call(atual, 'descricaoMedidaOriginal')
        ? descricaoMedida(atual)
        : typeof original.descricaoMedidaOriginal === 'string'
          ? { descricaoMedidaOriginal: original.descricaoMedidaOriginal }
          : {}),
      refeicaoId: texto(atual.refeicaoId, refeicaoOriginal),
      medidaCaseira: typeof atual.medidaCaseira === 'string' ? atual.medidaCaseira : null,
    },
    kcal: Math.max(0, numero(valor.kcal, 0)),
    origemDasCalorias:
      origem === 'calculada' || origem === 'pendente' || origem === 'informada'
        ? origem
        : 'informada',
    ...(typeof valor.motivoPendencia === 'string' ? { motivoPendencia: valor.motivoPendencia } : {}),
    ...(Array.isArray(valor.opcoesCorrespondencia)
      ? {
          opcoesCorrespondencia: valor.opcoesCorrespondencia
            .filter(ehObjeto)
            .map((opcao) => ({ id: texto(opcao.id), nome: texto(opcao.nome) }))
            .filter((opcao) => opcao.id && opcao.nome),
        }
      : {}),
    observacao: typeof valor.observacao === 'string' ? valor.observacao : null,
    ordem: numero(valor.ordem, indice),
  };
}

export function sanearDieta(valor: unknown): Dieta | null {
  if (!ehObjeto(valor)) return null;

  const refeicoes = Array.isArray(valor.refeicoes)
    ? valor.refeicoes.map(sanearRefeicao).filter((r): r is Refeicao => r !== null)
    : [];
  const blocos = Array.isArray(valor.blocos)
    ? valor.blocos.map(sanearBloco).filter((b): b is BlocoCalorico => b !== null)
    : [];

  if (refeicoes.length === 0) return null;

  // Um bloco só pode apontar para refeições que existem.
  const idsDeRefeicao = new Set(refeicoes.map((r) => r.id));
  const blocosValidos = blocos
    .filter((b) => idsDeRefeicao.has(b.original.refeicaoId))
    .map((b) =>
      idsDeRefeicao.has(b.atual.refeicaoId)
        ? b
        : { ...b, atual: { ...b.atual, refeicaoId: b.original.refeicaoId } },
    );

  return {
    id: texto(valor.id, 'dieta'),
    titulo: texto(valor.titulo, 'Dieta importada'),
    importadaEm: texto(valor.importadaEm, new Date().toISOString()),
    refeicoes,
    blocos: blocosValidos,
  };
}

function sanearDias(valor: unknown): DiaDaSemana[] {
  if (!Array.isArray(valor)) return [];
  const presentes = new Set(valor.filter((dia): dia is string => typeof dia === 'string'));
  return DIAS_DA_SEMANA.filter((dia) => presentes.has(dia));
}

/**
 * Saneia um plano. Devolve `null` quando não sobra dieta utilizável — assim um
 * plano corrompido não derruba os demais.
 */
function sanearPlano(valor: unknown, indice: number): PlanoAlimentar | null {
  if (!ehObjeto(valor)) return null;

  const dietaAtual = sanearDieta(valor.dietaAtual);
  if (!dietaAtual) return null;

  // Sem original guardado (ou com original ilegível), a prescrição é
  // reconstruída bloco a bloco — que é exatamente o que `original` significa.
  const dietaOriginal = sanearDieta(valor.dietaOriginal) ?? restaurarDietaOriginal(dietaAtual);

  return {
    id: texto(valor.id) || `plano-${indice + 1}`,
    nome: texto(valor.nome).trim() || dietaAtual.titulo || `Plano ${indice + 1}`,
    descricao: typeof valor.descricao === 'string' && valor.descricao.trim()
      ? valor.descricao.trim()
      : null,
    diasSugeridos: sanearDias(valor.diasSugeridos),
    importadoEm: texto(valor.importadoEm, dietaAtual.importadaEm),
    dietaOriginal,
    dietaAtual,
  };
}

/** Remove planos ilegíveis e garante ids únicos. */
function sanearPlanos(valor: unknown): PlanoAlimentar[] {
  if (!Array.isArray(valor)) return [];
  const vistos = new Set<string>();
  const resultado: PlanoAlimentar[] = [];

  valor.forEach((item, indice) => {
    const plano = sanearPlano(item, indice);
    if (!plano) return;
    // Dois planos com o mesmo id se sobrescreveriam na substituição.
    const id = vistos.has(plano.id) ? novoId('plano') : plano.id;
    vistos.add(id);
    resultado.push(id === plano.id ? plano : { ...plano, id });
  });

  return resultado;
}

function sanearConfiguracoes(valor: unknown): Configuracoes {
  if (!ehObjeto(valor)) return { ...CONFIGURACOES_PADRAO };
  const arredondamento = texto(valor.arredondamento);
  return {
    arredondamento: MODOS.includes(arredondamento as ModoDeArredondamento)
      ? (arredondamento as ModoDeArredondamento)
      : CONFIGURACOES_PADRAO.arredondamento,
    modoDemonstracao: valor.modoDemonstracao === true,
  };
}

function sanearVinculos(valor: unknown): VinculoDeAlimento[] {
  if (!Array.isArray(valor)) return [];
  const vistos = new Set<string>();
  const resultado: VinculoDeAlimento[] = [];
  for (const item of valor) {
    if (!ehObjeto(item)) continue;
    const textoNormalizado = texto(item.textoNormalizado);
    const alimentoId = texto(item.alimentoId);
    if (!textoNormalizado || !alimentoId || vistos.has(textoNormalizado)) continue;
    vistos.add(textoNormalizado);
    resultado.push({
      textoNormalizado,
      textoOriginal: texto(item.textoOriginal, textoNormalizado),
      alimentoId,
      criadoEm: texto(item.criadoEm, new Date().toISOString()),
    });
  }
  return resultado;
}

/**
 * Esquema 1 → 2: a dieta única guardada vira um plano chamado “Plano principal”.
 *
 * Todos os itens e todas as alterações (substituições, movimentações) são
 * preservados: a dieta salva passa a ser a `dietaAtual` do plano, e a
 * `dietaOriginal` é reconstruída a partir do `original` de cada bloco.
 */
export function migrarDeUmaDietaParaPlanos(dados: Record<string, unknown>): Record<string, unknown> {
  const { dieta, ...resto } = dados;
  const dietaSaneada = sanearDieta(dieta);

  if (!dietaSaneada) {
    return { ...resto, planos: [], planoAtivoId: null };
  }

  const plano: PlanoAlimentar = {
    id: novoId('plano'),
    nome: NOME_DO_PLANO_MIGRADO,
    descricao: null,
    diasSugeridos: [],
    importadoEm: dietaSaneada.importadaEm,
    dietaOriginal: restaurarDietaOriginal(dietaSaneada),
    dietaAtual: dietaSaneada,
  };

  return { ...resto, planos: [plano], planoAtivoId: plano.id };
}

/** Migra um estado de versão anterior para a versão corrente. */
function aplicarMigracoes(dados: Record<string, unknown>): Record<string, unknown> {
  let atual = dados;
  let versao = numero(atual.versaoDoEsquema, 1);

  // Um arquivo que já traz `planos` não é migrado, mesmo que a versão esteja
  // desatualizada por engano — migrar apagaria a coleção existente.
  if (versao <= 1 && !Array.isArray(atual.planos)) {
    atual = migrarDeUmaDietaParaPlanos(atual);
  }
  if (versao <= 1) versao = 2;

  if (versao > VERSAO_DO_ESQUEMA) {
    // Backup criado por uma versão mais nova: seguimos com o que dá para ler.
    versao = VERSAO_DO_ESQUEMA;
  }

  return { ...atual, versaoDoEsquema: versao };
}

export function sanearEstado(dados: unknown): Resultado<EstadoPersistido> {
  if (!ehObjeto(dados)) return falha('Conteúdo não reconhecido: não é um objeto JSON.');
  if (dados.versaoDoEsquema === undefined) {
    return falha('Arquivo sem "versaoDoEsquema": não parece um backup do Equivale.');
  }

  const migrado = aplicarMigracoes(dados);
  const base = estadoInicial();

  const planos = sanearPlanos(migrado.planos);
  const planoAtivoId = typeof migrado.planoAtivoId === 'string' ? migrado.planoAtivoId : null;

  return ok(
    comPlanoAtivoValido({
      versaoDoEsquema: VERSAO_DO_ESQUEMA,
      planos,
      planoAtivoId,
      configuracoes: sanearConfiguracoes(migrado.configuracoes),
      vinculos: sanearVinculos(migrado.vinculos),
      atualizadoEm: texto(migrado.atualizadoEm, base.atualizadoEm),
    }),
  );
}
