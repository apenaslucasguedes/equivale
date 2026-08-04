import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validarBase } from '../src/data/alimentos/repositorio';
import { RepositorioEmMemoria } from '../src/data/alimentos/repositorio';
import { resolverItens } from '../src/importacao/resolucao';
import { analisarMarkdown } from '../src/importacao/analisadorMarkdown';

const caminho = path.resolve(process.cwd(), 'public/data/alimentos.json');
const base = validarBase(JSON.parse(fs.readFileSync(caminho, 'utf8')));

const repositorio = new RepositorioEmMemoria(async () => base);
repositorio.definirBase(base);

describe('base nutricional de produção v1', () => {
  it('carrega uma base real rastreável, não vazia e sem valores calóricos inválidos', () => {
    expect(base.somenteParaTeste).toBe(false);
    expect(base.alimentos.length).toBeGreaterThan(50);
    expect(base.alimentos.every((item) => Number.isFinite(item.kcalPor100g) && item.kcalPor100g >= 0)).toBe(true);
    expect(base.alimentos.every((item) => item.fonte && item.codigoDaFonte && item.atualizadoEm)).toBe(true);
  });

  it('mantém aliases confiáveis e preparos diferentes em registros distintos', () => {
    const arroz = base.alimentos.find((item) => item.aliases.includes('Arroz branco cozido'));
    expect(arroz?.codigoDaFonte).toBe('3');
    expect(arroz?.preparo).toBe('cozido');

    const patinho = base.alimentos.find((item) => item.aliases.includes('Patinho, sem gordura, grelhado'));
    expect(patinho?.codigoDaFonte).toBe('377');
    expect(patinho?.preparo).toBe('grelhado');

    const crus = base.alimentos.filter((item) => item.nome.includes('Batata, doce'));
    expect(new Set(crus.map((item) => item.preparo))).toContain('cozido');
    expect(new Set(crus.map((item) => item.preparo))).not.toContain('assada');
  });

  it('preserva medidas caseiras somente quando há peso documentado', () => {
    const patinho = base.alimentos.find((item) => item.codigoDaFonte === '377');
    expect(patinho?.porcoesCaseiras).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ medida: 'bife pequeno', quantidade: 1, gramas: 60 }),
      ]),
    );
  });

  it('não possui ids duplicados nem aliases normalizados conflitantes', () => {
    const ids = base.alimentos.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    const chaves = new Map<string, string>();
    for (const alimento of base.alimentos) {
      for (const texto of [alimento.nome, ...alimento.aliases]) {
        const chave = texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        const anterior = chaves.get(chave);
        expect(anterior === undefined || anterior === alimento.id).toBe(true);
        chaves.set(chave, alimento.id);
      }
    }
  });

  it('resolve alimentos reais por alias e porção prescrita documentada', () => {
    const importacao = analisarMarkdown(`Dieta: Teste\n\n## Almoço\n- Arroz branco cozido | 100 g\n- Patinho sem gordura grelhado | 1 bife pequeno\n`);
    expect(importacao.erros).toEqual([]);
    const itens = resolverItens(importacao.itens, repositorio, []);
    expect(itens.map((item) => item.motivo)).toEqual([null, null]);
    expect(itens.every((item) => typeof item.kcal === 'number' && item.kcal > 0)).toBe(true);
  });

  it('importa o recorte auditável dos planos sem forçar as pendências', () => {
    const markdown = fs.readFileSync(
      path.resolve(process.cwd(), 'tests/fixtures/plano-real-recorte.md'),
      'utf8',
    );
    const importacao = analisarMarkdown(markdown);
    expect(importacao.erros).toEqual([]);
    const itens = resolverItens(importacao.itens, repositorio, []);
    const resolvidos = itens.filter((item) => item.motivo === null);
    const pendentes = itens.filter((item) => item.motivo !== null);
    expect(resolvidos.map((item) => item.item.nomeAlimento)).toEqual([
      'Pão francês',
      'Banana, maçã, crua',
      'Mamão, Papaia, cru',
      'Patinho, sem gordura, grelhado',
      'Peito de frango sem pele, grelhado',
    ]);
    expect(pendentes.map((item) => [item.item.nomeAlimento, item.motivo])).toEqual([
      ['Atum sólido ao natural conservado', 'Alimento não encontrado na base'],
      ['Batata doce assada', 'Alimento não encontrado na base'],
    ]);
  });
});

describe('validação nutricional', () => {
  it('rejeita kcalPor100g negativa, infinita ou textual sem carregar o registro', () => {
    for (const kcalPor100g of [-1, Number.POSITIVE_INFINITY, '100']) {
      const resultado = validarBase({
        ...base,
        alimentos: [{ ...base.alimentos[0], kcalPor100g }],
      });
      expect(resultado.alimentos).toEqual([]);
    }
  });
});
