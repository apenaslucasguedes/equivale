export interface ErroCatalogo { mensagem: string; linha: number | null }
export interface ResultadoCatalogo {
  catalogo: {
    grupos: Array<{ opcoes: Array<Record<string, unknown>> }>;
    reviewRequired: Array<{ linha: number; texto: string }>;
    [campo: string]: unknown;
  };
  erros: ErroCatalogo[];
  avisos: ErroCatalogo[];
}
export function compilarCatalogo(markdown: string, origem?: string): ResultadoCatalogo;
export function sanitizarCatalogo(catalogo: ResultadoCatalogo['catalogo']): Record<string, unknown>;
export function gerarRelatorio(resultado: ResultadoCatalogo): string;
