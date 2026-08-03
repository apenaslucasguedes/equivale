/** Geração de identificadores locais (nenhum dado sai do aparelho). */

let contador = 0;

export function novoId(prefixo = 'id'): string {
  const cripto = globalThis.crypto;
  if (cripto && typeof cripto.randomUUID === 'function') {
    return `${prefixo}_${cripto.randomUUID()}`;
  }
  contador += 1;
  return `${prefixo}_${Date.now().toString(36)}_${contador.toString(36)}`;
}
