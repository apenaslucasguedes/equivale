import { beforeAll, describe, expect, it } from 'vitest';
import { RepositorioEmMemoria, validarBase } from '../src/data/alimentos/repositorio';
import { TEST_ONLY_BASE_DE_ALIMENTOS } from '../src/data/alimentos/TEST_ONLY.fixtures';
import { normalizar, lerNumero } from '../src/domain/texto';
import { criarRepositorioDeTeste } from './apoio/fabricas';

let repositorio: RepositorioEmMemoria;

beforeAll(async () => {
  repositorio = await criarRepositorioDeTeste();
});

describe('normalização de texto', () => {
  it('remove acentos, pontuação e caixa', () => {
    expect(normalizar('Pão Francês')).toBe('pao frances');
    expect(normalizar('Grão-de-bico, cozido')).toBe('grao de bico cozido');
    expect(normalizar('  Maçã   ')).toBe('maca');
  });

  it('lê números em português', () => {
    expect(lerNumero('1,5')).toBe(1.5);
    expect(lerNumero('1.234,5')).toBe(1234.5);
    expect(lerNumero('120')).toBe(120);
    expect(lerNumero('1.5')).toBe(1.5);
    expect(lerNumero('abc')).toBeNull();
    expect(lerNumero('')).toBeNull();
    expect(lerNumero('12abc')).toBeNull();
  });
});

describe('repositório de alimentos', () => {
  it('carrega as fixtures e as identifica como TEST_ONLY', () => {
    expect(repositorio.pronto()).toBe(true);
    expect(repositorio.total()).toBe(TEST_ONLY_BASE_DE_ALIMENTOS.alimentos.length);
    expect(repositorio.somenteParaTeste()).toBe(true);
    expect(repositorio.fonte()).toContain('TEST_ONLY');
  });

  it('busca sem acentos', () => {
    const comAcento = repositorio.buscar('maçã');
    const semAcento = repositorio.buscar('maca');
    expect(comAcento[0]?.alimento.id).toBe('TEST_ONLY_maca');
    expect(semAcento[0]?.alimento.id).toBe('TEST_ONLY_maca');
  });

  it('busca por prefixo', () => {
    const resultados = repositorio.buscar('bana');
    expect(resultados.some((r) => r.alimento.id === 'TEST_ONLY_banana_prata')).toBe(true);
  });

  it('busca por alias', () => {
    const resultados = repositorio.buscar('aipim');
    expect(resultados[0]?.alimento.id).toBe('TEST_ONLY_mandioca_cozida');
  });

  it('exige que todos os termos casem (busca "E")', () => {
    const resultados = repositorio.buscar('arroz integral');
    expect(resultados).toHaveLength(1);
    expect(resultados[0]?.alimento.id).toBe('TEST_ONLY_arroz_integral_cozido');
  });

  it('prioriza a correspondência exata do nome', () => {
    expect(repositorio.buscar('tofu')[0]?.alimento.nome).toBe('Tofu');
  });

  it('filtra por categoria sem alterar o resto da base', () => {
    const frutas = repositorio.buscar('', { categoria: 'frutas', limite: 100 });
    expect(frutas.length).toBeGreaterThan(0);
    expect(frutas.every((r) => r.alimento.categoria === 'frutas')).toBe(true);
    // A mesma consulta sem filtro continua devolvendo todas as categorias.
    const todas = repositorio.buscar('', { limite: 100 });
    expect(new Set(todas.map((r) => r.alimento.categoria)).size).toBeGreaterThan(1);
  });

  it('lista em ordem alfabética quando não há consulta', () => {
    const resultados = repositorio.buscar('', { limite: 5 });
    const nomes = resultados.map((r) => r.alimento.nome);
    expect([...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR'))).toEqual(nomes);
  });

  it('respeita o limite', () => {
    expect(repositorio.buscar('', { limite: 3 })).toHaveLength(3);
  });

  it('devolve lista vazia para consulta sem correspondência', () => {
    expect(repositorio.buscar('xyzabc')).toEqual([]);
  });

  it('encontra por id', () => {
    expect(repositorio.porId('TEST_ONLY_azeite')?.nome).toBe('Azeite de oliva');
    expect(repositorio.porId('nao-existe')).toBeUndefined();
  });

  it('lista somente as categorias presentes na base', () => {
    const categorias = repositorio.categoriasDisponiveis();
    expect(categorias).toContain('frutas');
    expect(categorias).toContain('gorduras');
    expect(categorias).not.toContain('receitas');
  });

  it('aguenta uma base grande com desempenho razoável', async () => {
    const muitos = Array.from({ length: 5000 }, (_, i) => ({
      id: `sintetico_${i}`,
      nome: `Alimento sintético ${i}`,
      aliases: [`apelido${i}`],
      categoria: 'industrializados' as const,
      preparo: null,
      kcalPor100g: 100 + (i % 300),
      porcoesCaseiras: [],
      fonte: 'TEST_ONLY',
      codigoDaFonte: null,
      atualizadoEm: '2026-01-01',
    }));

    const grande = new RepositorioEmMemoria(async () => ({
      versao: 1,
      fonte: 'TEST_ONLY sintético',
      somenteParaTeste: true,
      alimentos: muitos,
    }));
    await grande.carregar();

    const inicio = performance.now();
    for (let i = 0; i < 50; i++) grande.buscar('sintetico 123');
    const duracao = performance.now() - inicio;

    expect(grande.total()).toBe(5000);
    expect(grande.buscar('apelido4999')[0]?.alimento.id).toBe('sintetico_4999');
    expect(duracao).toBeLessThan(3000);
  });
});

describe('validarBase', () => {
  it('aceita uma base bem formada', () => {
    const base = validarBase(JSON.parse(JSON.stringify(TEST_ONLY_BASE_DE_ALIMENTOS)));
    expect(base.alimentos).toHaveLength(TEST_ONLY_BASE_DE_ALIMENTOS.alimentos.length);
    expect(base.somenteParaTeste).toBe(true);
  });

  it('descarta registros sem id, nome ou kcal válidas', () => {
    const base = validarBase({
      versao: 1,
      alimentos: [
        { nome: 'Sem id', kcalPor100g: 10 },
        { id: 'sem-nome', kcalPor100g: 10 },
        { id: 'sem-kcal', nome: 'X' },
        { id: 'kcal-invalida', nome: 'Y', kcalPor100g: 'muito' },
        { id: 'ok', nome: 'Bom', kcalPor100g: 50 },
      ],
    });
    expect(base.alimentos.map((a) => a.id)).toEqual(['ok']);
  });

  it('preenche campos ausentes com padrões seguros', () => {
    const base = validarBase({ alimentos: [{ id: 'a', nome: 'A', kcalPor100g: 1 }] });
    expect(base.alimentos[0]).toMatchObject({
      aliases: [],
      preparo: null,
      porcoesCaseiras: [],
      codigoDaFonte: null,
      fonte: 'não informada',
    });
    expect(base.somenteParaTeste).toBe(false);
  });

  it('rejeita conteúdo que não é base', () => {
    expect(() => validarBase(null)).toThrow();
    expect(() => validarBase({ semAlimentos: true })).toThrow();
  });
});
