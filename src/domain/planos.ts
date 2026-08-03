/**
 * Operações puras sobre a COLEÇÃO de planos alimentares.
 *
 * Invariantes garantidas aqui (e cobertas por testes):
 * - Cada plano é independente: mexer num plano nunca toca nos outros.
 * - Excluir um plano remove SÓ aquele plano.
 * - `planoAtivoId` sempre aponta para um plano existente, ou é `null` quando
 *   não há nenhum plano.
 * - `dietaOriginal` de um plano nunca é alterada depois da importação.
 */

import type { DiaDaSemana, Dieta, EstadoPersistido, PlanoAlimentar } from './types';
import { DIAS_DA_SEMANA, ROTULO_DIA_CURTO } from './types';
import { restaurarDietaOriginal } from './blocos';
import { novoId } from './identificadores';

// -------------------------------------------------------------- construção

export interface DadosDoNovoPlano {
  /** Quando ausente, um id local é gerado. */
  id?: string;
  nome: string;
  descricao?: string | null;
  diasSugeridos?: DiaDaSemana[];
  importadoEm?: string;
  dieta: Dieta;
}

/**
 * Monta um plano a partir de uma dieta recém-importada. `dietaOriginal` é a
 * dieta com todas as alterações desfeitas — na importação as duas são iguais,
 * mas a distinção mantém a restauração correta depois de restaurar um backup.
 */
export function criarPlano(dados: DadosDoNovoPlano): PlanoAlimentar {
  return {
    id: dados.id ?? novoId('plano'),
    nome: dados.nome.trim() || 'Plano sem nome',
    descricao: dados.descricao?.trim() ? dados.descricao.trim() : null,
    diasSugeridos: ordenarDias(dados.diasSugeridos ?? []),
    importadoEm: dados.importadoEm ?? new Date().toISOString(),
    dietaOriginal: restaurarDietaOriginal(dados.dieta),
    dietaAtual: dados.dieta,
  };
}

/** Ordena e remove repetições, seguindo a ordem natural da semana. */
export function ordenarDias(dias: DiaDaSemana[]): DiaDaSemana[] {
  const presentes = new Set(dias);
  return DIAS_DA_SEMANA.filter((dia) => presentes.has(dia));
}

/** "seg, ter, qua" — usado no seletor do cabeçalho e nos ajustes. */
export function descreverDias(dias: DiaDaSemana[]): string {
  return ordenarDias(dias)
    .map((dia) => ROTULO_DIA_CURTO[dia])
    .join(', ');
}

// ---------------------------------------------------------------- consultas

export function encontrarPlano(
  estado: EstadoPersistido,
  planoId: string | null,
): PlanoAlimentar | null {
  if (!planoId) return null;
  return estado.planos.find((plano) => plano.id === planoId) ?? null;
}

export function planoAtivo(estado: EstadoPersistido): PlanoAlimentar | null {
  return encontrarPlano(estado, estado.planoAtivoId);
}

/** Dieta atual do plano ativo, ou `null` quando não há plano nenhum. */
export function dietaAtiva(estado: EstadoPersistido): Dieta | null {
  return planoAtivo(estado)?.dietaAtual ?? null;
}

export function existePlanoComId(estado: EstadoPersistido, planoId: string): boolean {
  return estado.planos.some((plano) => plano.id === planoId);
}

/**
 * Garante que `planoAtivoId` aponte para um plano existente. Quando o plano
 * ativo some (exclusão, restauração de backup), o primeiro plano assume.
 */
export function comPlanoAtivoValido(estado: EstadoPersistido): EstadoPersistido {
  if (estado.planos.length === 0) {
    return estado.planoAtivoId === null ? estado : { ...estado, planoAtivoId: null };
  }
  if (estado.planos.some((plano) => plano.id === estado.planoAtivoId)) return estado;
  return { ...estado, planoAtivoId: estado.planos[0]?.id ?? null };
}

// -------------------------------------------------------------- alterações

/** Aplica uma transformação SÓ ao plano indicado. Os demais seguem intactos. */
export function mapearPlano(
  estado: EstadoPersistido,
  planoId: string | null,
  transformar: (plano: PlanoAlimentar) => PlanoAlimentar,
): EstadoPersistido {
  if (!planoId) return estado;
  let encontrou = false;
  const planos = estado.planos.map((plano) => {
    if (plano.id !== planoId) return plano;
    encontrou = true;
    return transformar(plano);
  });
  return encontrou ? { ...estado, planos } : estado;
}

/** Aplica uma transformação à dieta atual do plano indicado. */
export function mapearDietaDoPlano(
  estado: EstadoPersistido,
  planoId: string | null,
  transformar: (dieta: Dieta) => Dieta,
): EstadoPersistido {
  return mapearPlano(estado, planoId, (plano) => ({
    ...plano,
    dietaAtual: transformar(plano.dietaAtual),
  }));
}

/** Acrescenta um plano à coleção e o torna ativo. Nenhum plano é removido. */
export function adicionarPlano(
  estado: EstadoPersistido,
  plano: PlanoAlimentar,
): EstadoPersistido {
  return {
    ...estado,
    planos: [...estado.planos, plano],
    planoAtivoId: plano.id,
  };
}

/**
 * Substitui o conteúdo de UM plano existente, preservando a posição dele na
 * lista. Se o id não existir, o plano é adicionado — nunca se apaga a coleção.
 */
export function substituirPlano(
  estado: EstadoPersistido,
  plano: PlanoAlimentar,
): EstadoPersistido {
  if (!existePlanoComId(estado, plano.id)) return adicionarPlano(estado, plano);
  return {
    ...estado,
    planos: estado.planos.map((atual) => (atual.id === plano.id ? plano : atual)),
    planoAtivoId: plano.id,
  };
}

export function renomearPlano(
  estado: EstadoPersistido,
  planoId: string,
  nome: string,
): EstadoPersistido {
  const limpo = nome.trim();
  if (!limpo) return estado;
  return mapearPlano(estado, planoId, (plano) => ({ ...plano, nome: limpo }));
}

/** Remove SÓ o plano indicado. Os outros planos e seus dados continuam. */
export function excluirPlano(estado: EstadoPersistido, planoId: string): EstadoPersistido {
  if (!existePlanoComId(estado, planoId)) return estado;
  return comPlanoAtivoValido({
    ...estado,
    planos: estado.planos.filter((plano) => plano.id !== planoId),
  });
}

export function ativarPlano(estado: EstadoPersistido, planoId: string): EstadoPersistido {
  if (!existePlanoComId(estado, planoId)) return estado;
  return { ...estado, planoAtivoId: planoId };
}

/** Desfaz todas as alterações do plano indicado, sem tocar nos outros. */
export function restaurarPlano(
  estado: EstadoPersistido,
  planoId: string | null,
): EstadoPersistido {
  return mapearDietaDoPlano(estado, planoId, restaurarDietaOriginal);
}
