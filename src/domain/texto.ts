/** Normalização de texto para busca: sem acentos, sem pontuação, minúsculo. */

const MARCAS_DE_ACENTO = /[̀-ͯ]/g;

export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(MARCAS_DE_ACENTO, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function fatiarEmTermos(texto: string): string[] {
  const normalizado = normalizar(texto);
  if (!normalizado) return [];
  return normalizado.split(' ').filter((t) => t.length > 0);
}

/**
 * Converte um número escrito em português para `number`.
 * Aceita "1.234,5", "1,5", "1.5" e "120".
 */
export function lerNumero(entrada: string): number | null {
  const bruto = entrada.trim();
  if (!bruto) return null;
  let texto = bruto.replace(/\s/g, '');
  if (texto.includes(',')) {
    // Vírgula é decimal em pt-BR; pontos viram separador de milhar.
    texto = texto.replace(/\./g, '').replace(',', '.');
  }
  if (!/^[+-]?\d*\.?\d+$/.test(texto)) return null;
  const valor = Number(texto);
  return Number.isFinite(valor) ? valor : null;
}

/** Formata número no padrão pt-BR com no máximo `casas` decimais. */
export function formatarNumero(valor: number, casas = 1): string {
  if (!Number.isFinite(valor)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: casas,
  }).format(valor);
}
