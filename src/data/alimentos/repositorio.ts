/**
 * Camada de dados de alimentos.
 *
 * A aplicação conversa apenas com a interface `RepositorioDeAlimentos`. Trocar
 * as fixtures de desenvolvimento por uma base real e extensa em JSON não exige
 * mudança em nenhuma tela — basta outra implementação/fonte.
 */

import type { Alimento, BaseDeAlimentos, Categoria } from '../../domain/types';
import { fatiarEmTermos, normalizar } from '../../domain/texto';

export interface FiltroDeBusca {
  /** Filtro organizacional. Nunca impede substituição entre categorias. */
  categoria?: Categoria | null;
  limite?: number;
}

export interface ResultadoDeBusca {
  alimento: Alimento;
  pontuacao: number;
}

export interface RepositorioDeAlimentos {
  carregar(): Promise<void>;
  pronto(): boolean;
  total(): number;
  /** `true` quando os dados carregados são fixtures TEST_ONLY. */
  somenteParaTeste(): boolean;
  fonte(): string;
  porId(id: string): Alimento | undefined;
  buscar(consulta: string, filtro?: FiltroDeBusca): ResultadoDeBusca[];
  categoriasDisponiveis(): Categoria[];
  todos(): Alimento[];
}

interface Entrada {
  alimento: Alimento;
  nomeNormalizado: string;
  aliasesNormalizados: string[];
  termos: string[];
}

const LIMITE_PADRAO = 50;

/**
 * Implementação em memória com índice invertido simples.
 * Dimensionada para milhares de alimentos: o índice é montado uma única vez no
 * carregamento e cada busca percorre apenas as postagens dos termos da consulta.
 */
export class RepositorioEmMemoria implements RepositorioDeAlimentos {
  private entradas: Entrada[] = [];
  private porIdMapa = new Map<string, Alimento>();
  /** token → índices em `entradas` */
  private indice = new Map<string, number[]>();
  /** tokens ordenados, para busca por prefixo */
  private tokensOrdenados: string[] = [];
  private carregado = false;
  private base: BaseDeAlimentos | null = null;
  private readonly obterBase: () => Promise<BaseDeAlimentos>;

  constructor(obterBase: () => Promise<BaseDeAlimentos>) {
    this.obterBase = obterBase;
  }

  async carregar(): Promise<void> {
    if (this.carregado) return;
    const base = await this.obterBase();
    this.definirBase(base);
  }

  /** Permite injetar dados já resolvidos (usado em testes e no modo demo). */
  definirBase(base: BaseDeAlimentos): void {
    this.base = base;
    this.entradas = base.alimentos.map((alimento) => {
      const nomeNormalizado = normalizar(alimento.nome);
      const aliasesNormalizados = (alimento.aliases ?? []).map(normalizar);
      const termos = Array.from(
        new Set([
          ...fatiarEmTermos(alimento.nome),
          ...(alimento.aliases ?? []).flatMap(fatiarEmTermos),
          ...(alimento.preparo ? fatiarEmTermos(alimento.preparo) : []),
        ]),
      );
      return { alimento, nomeNormalizado, aliasesNormalizados, termos };
    });

    this.porIdMapa = new Map(this.entradas.map((e) => [e.alimento.id, e.alimento]));

    this.indice = new Map();
    this.entradas.forEach((entrada, i) => {
      for (const termo of entrada.termos) {
        const lista = this.indice.get(termo);
        if (lista) lista.push(i);
        else this.indice.set(termo, [i]);
      }
    });
    this.tokensOrdenados = [...this.indice.keys()].sort();
    this.carregado = true;
  }

  pronto(): boolean {
    return this.carregado;
  }

  total(): number {
    return this.entradas.length;
  }

  somenteParaTeste(): boolean {
    return this.base?.somenteParaTeste ?? false;
  }

  fonte(): string {
    return this.base?.fonte ?? 'desconhecida';
  }

  porId(id: string): Alimento | undefined {
    return this.porIdMapa.get(id);
  }

  todos(): Alimento[] {
    return this.entradas.map((e) => e.alimento);
  }

  categoriasDisponiveis(): Categoria[] {
    const encontradas = new Set<Categoria>();
    for (const entrada of this.entradas) encontradas.add(entrada.alimento.categoria);
    return [...encontradas];
  }

  /** Índices cujas entradas contêm algum termo começando por `prefixo`. */
  private postagensPorPrefixo(prefixo: string): number[] {
    const exato = this.indice.get(prefixo);
    if (prefixo.length < 3 && exato) return exato;

    const resultado = new Set<number>(exato ?? []);
    let inicio = 0;
    let fim = this.tokensOrdenados.length;
    while (inicio < fim) {
      const meio = (inicio + fim) >> 1;
      if ((this.tokensOrdenados[meio] as string) < prefixo) inicio = meio + 1;
      else fim = meio;
    }
    for (let i = inicio; i < this.tokensOrdenados.length; i++) {
      const token = this.tokensOrdenados[i] as string;
      if (!token.startsWith(prefixo)) break;
      for (const indice of this.indice.get(token) ?? []) resultado.add(indice);
    }
    return [...resultado];
  }

  buscar(consulta: string, filtro: FiltroDeBusca = {}): ResultadoDeBusca[] {
    const limite = filtro.limite ?? LIMITE_PADRAO;
    const categoria = filtro.categoria ?? null;
    const termos = fatiarEmTermos(consulta);
    const consultaNormalizada = normalizar(consulta);

    // Sem consulta: lista alfabética (opcionalmente filtrada por categoria).
    if (termos.length === 0) {
      return this.entradas
        .filter((e) => !categoria || e.alimento.categoria === categoria)
        .sort((a, b) => a.nomeNormalizado.localeCompare(b.nomeNormalizado, 'pt-BR'))
        .slice(0, limite)
        .map((e) => ({ alimento: e.alimento, pontuacao: 0 }));
    }

    const pontos = new Map<number, number>();
    for (const termo of termos) {
      for (const indice of this.postagensPorPrefixo(termo)) {
        pontos.set(indice, (pontos.get(indice) ?? 0) + 1);
      }
    }

    const resultados: ResultadoDeBusca[] = [];
    for (const [indice, acertos] of pontos) {
      const entrada = this.entradas[indice];
      if (!entrada) continue;
      if (categoria && entrada.alimento.categoria !== categoria) continue;

      // Exige que todos os termos da consulta tenham casado (busca "E").
      if (acertos < termos.length) continue;

      let pontuacao = acertos * 10;
      if (entrada.nomeNormalizado === consultaNormalizada) pontuacao += 100;
      else if (entrada.nomeNormalizado.startsWith(consultaNormalizada)) pontuacao += 50;
      else if (entrada.nomeNormalizado.includes(consultaNormalizada)) pontuacao += 25;
      if (entrada.aliasesNormalizados.includes(consultaNormalizada)) pontuacao += 40;
      // Nomes curtos tendem a ser o alimento "básico" procurado.
      pontuacao -= Math.min(entrada.nomeNormalizado.length / 20, 5);

      resultados.push({ alimento: entrada.alimento, pontuacao });
    }

    resultados.sort(
      (a, b) =>
        b.pontuacao - a.pontuacao || a.alimento.nome.localeCompare(b.alimento.nome, 'pt-BR'),
    );
    return resultados.slice(0, limite);
  }
}

/** Base vazia — estado honesto enquanto não houver uma base real validada. */
export const BASE_VAZIA: BaseDeAlimentos = {
  versao: 1,
  fonte: 'nenhuma base carregada',
  somenteParaTeste: false,
  alimentos: [],
};

/**
 * Valida o formato de uma base carregada de JSON. Rejeita registros incompletos
 * em vez de deixar números inválidos chegarem ao cálculo.
 */
export function validarBase(dados: unknown): BaseDeAlimentos {
  if (!dados || typeof dados !== 'object') throw new Error('Base de alimentos inválida.');
  const bruto = dados as Partial<BaseDeAlimentos>;
  if (!Array.isArray(bruto.alimentos)) throw new Error('Base sem a lista "alimentos".');

  const alimentos: Alimento[] = [];
  for (const item of bruto.alimentos) {
    if (!item || typeof item !== 'object') continue;
    const a = item as Partial<Alimento>;
    if (typeof a.id !== 'string' || typeof a.nome !== 'string') continue;
    if (
      typeof a.kcalPor100g !== 'number' ||
      !Number.isFinite(a.kcalPor100g) ||
      a.kcalPor100g < 0
    ) {
      continue;
    }
    const porcoesCaseiras = Array.isArray(a.porcoesCaseiras) ? a.porcoesCaseiras : [];
    const porcoesValidas = porcoesCaseiras.filter(
      (p) =>
          !p ||
          (typeof p.medida === 'string' &&
            typeof p.gramas === 'number' &&
            Number.isFinite(p.gramas) &&
            p.gramas > 0 &&
            typeof p.quantidade === 'number' &&
            Number.isFinite(p.quantidade) &&
            p.quantidade > 0),
    ).filter((p): p is NonNullable<typeof p> => Boolean(p));
    alimentos.push({
      id: a.id,
      nome: a.nome,
      aliases: Array.isArray(a.aliases) ? a.aliases.filter((x) => typeof x === 'string') : [],
      categoria: (a.categoria ?? 'industrializados') as Categoria,
      preparo: typeof a.preparo === 'string' ? a.preparo : null,
      kcalPor100g: a.kcalPor100g,
      porcoesCaseiras: porcoesValidas,
      fonte: typeof a.fonte === 'string' ? a.fonte : 'não informada',
      codigoDaFonte: typeof a.codigoDaFonte === 'string' ? a.codigoDaFonte : null,
      atualizadoEm: typeof a.atualizadoEm === 'string' ? a.atualizadoEm : '',
    });
  }

  return {
    versao: typeof bruto.versao === 'number' ? bruto.versao : 1,
    fonte: typeof bruto.fonte === 'string' ? bruto.fonte : 'não informada',
    somenteParaTeste: bruto.somenteParaTeste === true,
    alimentos,
  };
}
