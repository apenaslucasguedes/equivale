/** Armazenamento em memória: usado nos testes e como reserva se o IndexedDB
 *  não estiver disponível (aba anônima com armazenamento bloqueado, por ex.). */

import type { Armazenamento } from './armazenamento';

export class ArmazenamentoEmMemoria implements Armazenamento {
  private dados = new Map<string, string>();

  nome(): string {
    return 'memória (temporário)';
  }

  async ler<T>(chave: string): Promise<T | null> {
    const bruto = this.dados.get(chave);
    return bruto === undefined ? null : (JSON.parse(bruto) as T);
  }

  async gravar<T>(chave: string, valor: T): Promise<void> {
    this.dados.set(chave, JSON.stringify(valor));
  }

  async remover(chave: string): Promise<void> {
    this.dados.delete(chave);
  }

  async limpar(): Promise<void> {
    this.dados.clear();
  }
}
