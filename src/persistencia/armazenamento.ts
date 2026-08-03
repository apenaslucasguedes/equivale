/**
 * Camada de persistência desacoplada.
 *
 * A aplicação nunca fala com IndexedDB diretamente: ela usa a interface
 * `Armazenamento`. Isso permite trocar o mecanismo (IndexedDB no navegador,
 * memória nos testes, SQLite numa futura versão nativa) sem tocar nas telas.
 */

export interface Armazenamento {
  ler<T>(chave: string): Promise<T | null>;
  gravar<T>(chave: string, valor: T): Promise<void>;
  remover(chave: string): Promise<void>;
  limpar(): Promise<void>;
  nome(): string;
}

export const CHAVE_ESTADO = 'estado';
