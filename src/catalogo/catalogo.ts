export interface OpcaoCatalogo {
  id: string;
  nomePadronizado: string;
  nomeOriginal: string;
  aliases?: string[];
  quantidadeNumerica?: number | null;
  unidadePrincipal?: string | null;
  pesoGramas?: number | null;
  medidaCaseira?: string | null;
  quantidadeMedidaCaseira?: number | null;
  observacoes?: string | null;
  [campo: string]: unknown;
}

export interface GrupoCatalogo {
  id: string;
  nome: string;
  opcoes: OpcaoCatalogo[];
  [campo: string]: unknown;
}

export interface CatalogoEquivalencias {
  schemaVersion: number;
  documentType: string;
  grupos: GrupoCatalogo[];
  [campo: string]: unknown;
}

export type CorrespondenciaCatalogo =
  | { tipo: 'nenhuma' }
  | { tipo: 'unica'; opcao: OpcaoCatalogo }
  | { tipo: 'ambiguo'; opcoes: OpcaoCatalogo[] };

export function normalizarNome(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, ' ').trim();
}

export function criarIndiceCatalogo(catalogo: CatalogoEquivalencias) {
  const porChave = new Map<string, OpcaoCatalogo[]>();
  const chavesPorOpcao = new Map<OpcaoCatalogo, string[]>();
  for (const grupo of catalogo.grupos) for (const opcao of grupo.opcoes) {
    const chaves = [...new Set([opcao.nomePadronizado, opcao.nomeOriginal, ...(opcao.aliases ?? [])].map(normalizarNome).filter(Boolean))];
    chavesPorOpcao.set(opcao, chaves);
    for (const chave of chaves) porChave.set(chave, [...(porChave.get(chave) ?? []), opcao]);
  }
  return {
    grupoDaOpcao(opcaoId: string): GrupoCatalogo | null {
      return catalogo.grupos.find((grupo) => grupo.opcoes.some((opcao) => opcao.id === opcaoId)) ?? null;
    },
    correspondenciaExata(nome: string): CorrespondenciaCatalogo {
      const opcoes = porChave.get(normalizarNome(nome)) ?? [];
      if (!opcoes.length) return { tipo: 'nenhuma' };
      if (opcoes.length > 1) return { tipo: 'ambiguo', opcoes };
      return { tipo: 'unica', opcao: opcoes[0]! };
    },
    sugerir(termo: string, limite = 20): OpcaoCatalogo[] {
      const busca = normalizarNome(termo);
      if (!busca) return [];
      return [...chavesPorOpcao.entries()]
        .filter(([, chaves]) => chaves.some((chave) => chave.includes(busca)))
        .sort(([a, ac], [b, bc]) => Number(!ac.includes(busca)) - Number(!bc.includes(busca)) || a.nomePadronizado.localeCompare(b.nomePadronizado, 'pt-BR'))
        .slice(0, limite).map(([opcao]) => opcao);
    },
  };
}

export async function carregarCatalogo(url = `${import.meta.env.BASE_URL}data/catalogo-equivalencias.json`, fetcher: typeof fetch = fetch): Promise<CatalogoEquivalencias> {
  const resposta = await fetcher(url);
  if (!resposta.ok) throw new Error(`Não foi possível carregar o catálogo (${resposta.status})`);
  const catalogo: unknown = await resposta.json();
  if (!catalogo || typeof catalogo !== 'object' || !Array.isArray((catalogo as CatalogoEquivalencias).grupos)) throw new Error('Catálogo inválido: grupos ausentes');
  return catalogo as CatalogoEquivalencias;
}
