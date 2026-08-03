/** Leitura e gravação do estado da aplicação, sobre qualquer `Armazenamento`. */

import type { EstadoPersistido } from '../domain/types';
import { estadoInicial } from '../domain/types';
import type { Armazenamento } from './armazenamento';
import { CHAVE_ESTADO } from './armazenamento';
import { ArmazenamentoIndexedDB } from './indexeddb';
import { ArmazenamentoEmMemoria } from './memoria';
import { sanearEstado } from './migracoes';

export class RepositorioDeEstado {
  private readonly armazenamento: Armazenamento;

  constructor(armazenamento: Armazenamento) {
    this.armazenamento = armazenamento;
  }

  nomeDoArmazenamento(): string {
    return this.armazenamento.nome();
  }

  /** Recupera o estado ao reabrir o app. Nunca lança: em caso de dado
   *  corrompido devolve o estado inicial e sinaliza o problema. */
  async carregar(): Promise<{ estado: EstadoPersistido; aviso: string | null }> {
    try {
      const bruto = await this.armazenamento.ler<unknown>(CHAVE_ESTADO);
      if (bruto === null) return { estado: estadoInicial(), aviso: null };

      const saneado = sanearEstado(bruto);
      if (!saneado.ok) {
        return {
          estado: estadoInicial(),
          aviso: `Não foi possível ler os dados salvos (${saneado.erro}). O app começou vazio; seus dados anteriores não foram apagados.`,
        };
      }
      return { estado: saneado.valor, aviso: null };
    } catch (erro) {
      return {
        estado: estadoInicial(),
        aviso: `Falha ao acessar o armazenamento local: ${(erro as Error).message}`,
      };
    }
  }

  async salvar(estado: EstadoPersistido): Promise<void> {
    await this.armazenamento.gravar(CHAVE_ESTADO, {
      ...estado,
      atualizadoEm: new Date().toISOString(),
    });
  }

  async apagarTudo(): Promise<void> {
    await this.armazenamento.limpar();
    if (this.armazenamento instanceof ArmazenamentoIndexedDB) {
      await this.armazenamento.destruir();
    }
  }
}

/** Escolhe o melhor armazenamento disponível no ambiente atual. */
export function criarArmazenamentoPadrao(): Armazenamento {
  if (ArmazenamentoIndexedDB.disponivel()) return new ArmazenamentoIndexedDB();
  return new ArmazenamentoEmMemoria();
}

export function criarRepositorioDeEstadoPadrao(): RepositorioDeEstado {
  return new RepositorioDeEstado(criarArmazenamentoPadrao());
}
