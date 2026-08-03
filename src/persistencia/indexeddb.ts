/** Implementação de `Armazenamento` sobre IndexedDB, sem dependências. */

import type { Armazenamento } from './armazenamento';

const NOME_DO_BANCO = 'equivale';
const NOME_DA_LOJA = 'estado';
const VERSAO_DO_BANCO = 1;

function promessaDaRequisicao<T>(requisicao: IDBRequest<T>): Promise<T> {
  return new Promise((resolver, rejeitar) => {
    requisicao.onsuccess = () => resolver(requisicao.result);
    requisicao.onerror = () => rejeitar(requisicao.error ?? new Error('Falha no IndexedDB.'));
  });
}

export class ArmazenamentoIndexedDB implements Armazenamento {
  private banco: Promise<IDBDatabase> | null = null;

  static disponivel(): boolean {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  }

  nome(): string {
    return 'IndexedDB';
  }

  private abrir(): Promise<IDBDatabase> {
    if (this.banco) return this.banco;
    this.banco = new Promise((resolver, rejeitar) => {
      const requisicao = indexedDB.open(NOME_DO_BANCO, VERSAO_DO_BANCO);
      requisicao.onupgradeneeded = () => {
        const banco = requisicao.result;
        if (!banco.objectStoreNames.contains(NOME_DA_LOJA)) {
          banco.createObjectStore(NOME_DA_LOJA);
        }
      };
      requisicao.onsuccess = () => resolver(requisicao.result);
      requisicao.onerror = () =>
        rejeitar(requisicao.error ?? new Error('Não foi possível abrir o banco local.'));
    });
    return this.banco;
  }

  private async transacao<T>(
    modo: IDBTransactionMode,
    operacao: (loja: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const banco = await this.abrir();
    return new Promise<T>((resolver, rejeitar) => {
      const transacao = banco.transaction(NOME_DA_LOJA, modo);
      const requisicao = operacao(transacao.objectStore(NOME_DA_LOJA));
      let resultado: T;
      requisicao.onsuccess = () => {
        resultado = requisicao.result;
      };
      transacao.oncomplete = () => resolver(resultado);
      transacao.onerror = () =>
        rejeitar(transacao.error ?? new Error('Falha na transação local.'));
      transacao.onabort = () =>
        rejeitar(transacao.error ?? new Error('Transação local cancelada.'));
    });
  }

  async ler<T>(chave: string): Promise<T | null> {
    const valor = await this.transacao<T | undefined>('readonly', (loja) => loja.get(chave));
    return valor ?? null;
  }

  async gravar<T>(chave: string, valor: T): Promise<void> {
    // structuredClone garante que só dados serializáveis cheguem ao banco.
    await this.transacao('readwrite', (loja) => loja.put(structuredClone(valor), chave));
  }

  async remover(chave: string): Promise<void> {
    await this.transacao('readwrite', (loja) => loja.delete(chave));
  }

  async limpar(): Promise<void> {
    await this.transacao('readwrite', (loja) => loja.clear());
  }

  /** Fecha e apaga o banco inteiro (usado por "Apagar todos os dados"). */
  async destruir(): Promise<void> {
    if (this.banco) {
      const banco = await this.banco;
      banco.close();
      this.banco = null;
    }
    await promessaDaRequisicao(
      indexedDB.deleteDatabase(NOME_DO_BANCO) as unknown as IDBRequest<undefined>,
    ).catch(() => undefined);
  }
}
