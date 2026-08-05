import { beforeAll, describe, expect, it } from 'vitest';
import { analisarMarkdown } from '../src/importacao/analisadorMarkdown';
import {
  contarPendentes,
  determinarGramas,
  montarDieta,
  resolverItens,
} from '../src/importacao/resolucao';
import { RepositorioEmMemoria, BASE_VAZIA } from '../src/data/alimentos/repositorio';
import type { BaseDeAlimentos } from '../src/domain/types';
import { criarRepositorioDeTeste } from './apoio/fabricas';

let repositorio: RepositorioEmMemoria;

beforeAll(async () => {
  repositorio = await criarRepositorioDeTeste();
});

function resolverTexto(markdown: string) {
  const analise = analisarMarkdown(markdown);
  return { analise, resolvidos: resolverItens(analise.itens, repositorio) };
}

describe('resolução das calorias do bloco', () => {
  it('usa as calorias informadas no arquivo, mesmo havendo base', () => {
    const { resolvidos } = resolverTexto('# D\n## Almoço\n- Arroz branco cozido | 100 g | 999 kcal');
    expect(resolvidos[0]?.origem).toBe('informada');
    expect(resolvidos[0]?.kcal).toBe(999);
  });

  it('calcula pela base quando o nome casa exatamente', () => {
    const { resolvidos } = resolverTexto('# D\n## Almoço\n- Arroz branco cozido | 150 g');
    expect(resolvidos[0]?.origem).toBe('calculada');
    expect(resolvidos[0]?.kcal).toBeCloseTo(192, 6); // 150 g × 128 kcal/100 g
    expect(resolvidos[0]?.alimentoId).toBe('TEST_ONLY_arroz_branco_cozido');
  });

  it('calcula pela base quando o alias casa exatamente', () => {
    const { resolvidos } = resolverTexto('# D\n## Almoço\n- feijão | 80 g');
    expect(resolvidos[0]?.alimentoId).toBe('TEST_ONLY_feijao_carioca_cozido');
    expect(resolvidos[0]?.kcal).toBeCloseTo(60.8, 6);
  });

  it('usa o ID exato mesmo quando o nome contém outra grafia e vírgulas', () => {
    const { resolvidos } = resolverTexto(
      '# D\n## Almoço\n- Nome escrito livremente | 100 g | id: TEST_ONLY_arroz_branco_cozido',
    );
    expect(resolvidos[0]?.alimentoId).toBe('TEST_ONLY_arroz_branco_cozido');
    expect(resolvidos[0]?.origem).toBe('calculada');
    expect(resolvidos[0]?.kcal).toBeCloseTo(128, 6);
  });

  it('usa medidas caseiras do alimento para converter unidades', () => {
    const { resolvidos } = resolverTexto('# D\n## Café da manhã\n- Pão francês | 2 unidade');
    expect(resolvidos[0]?.origem).toBe('calculada');
    expect(resolvidos[0]?.kcal).toBeCloseTo(300, 6); // 2 × 50 g × 300 kcal/100 g
  });

  it('deixa pendente quando não há correspondência exata', () => {
    const { resolvidos } = resolverTexto('# D\n## Almoço\n- Arroz sete grãos artesanal | 100 g');
    expect(resolvidos[0]?.origem).toBe('pendente');
    expect(resolvidos[0]?.kcal).toBe(0);
    expect(resolvidos[0]?.motivo).toBe('Alimento não encontrado na base');
  });

  it('deixa pendente quando a unidade não converte em gramas', () => {
    const { resolvidos } = resolverTexto('# D\n## Almoço\n- Arroz branco cozido | 1 porção');
    expect(resolvidos[0]?.origem).toBe('pendente');
    expect(resolvidos[0]?.motivo).toBe('Medida sem peso conhecido');
  });

  it('não usa semelhança aproximada de nome', () => {
    const { resolvidos } = resolverTexto('# D\n## Almoço\n- Arroz branc | 100 g');
    expect(resolvidos[0]?.origem).toBe('pendente');
  });

  it('respeita vínculos manuais já registrados', () => {
    const analise = analisarMarkdown('# D\n## Almoço\n- Arrozinho da vovó | 100 g');
    const resolvidos = resolverItens(analise.itens, repositorio, [
      {
        textoNormalizado: 'arrozinho da vovo',
        textoOriginal: 'Arrozinho da vovó',
        alimentoId: 'TEST_ONLY_arroz_branco_cozido',
        criadoEm: '2026-01-01T00:00:00.000Z',
      },
    ]);
    expect(resolvidos[0]?.origem).toBe('calculada');
    expect(resolvidos[0]?.kcal).toBeCloseTo(128, 6);
  });

  it('explica quando não há base carregada', () => {
    const vazio = new RepositorioEmMemoria(async () => BASE_VAZIA);
    vazio.definirBase(BASE_VAZIA);
    const analise = analisarMarkdown('# D\n## Almoço\n- Arroz | 100 g');
    const resolvidos = resolverItens(analise.itens, vazio);
    expect(resolvidos[0]?.motivo).toBe('Base nutricional não carregada');
  });

  it('resolve porção caseira usando toda a descrição original da medida', () => {
    const { resolvidos } = resolverTexto('# D\n## Almoço\n- Arroz branco cozido | 4 colheres de sopa');
    expect(resolvidos[0]?.origem).toBe('calculada');
    expect(resolvidos[0]?.kcal).toBeCloseTo(128, 6);
  });

  it('mantém unidade livre sem peso como pendente, sem descartar o item', () => {
    const { analise, resolvidos } = resolverTexto('# D\n## Almoço\n- Arroz branco cozido | 1 bife');
    expect(analise.itens).toHaveLength(1);
    expect(resolvidos[0]?.origem).toBe('pendente');
    expect(resolvidos[0]?.motivo).toBe('Medida sem peso conhecido');
  });

  it('mantém correspondência ambígua pendente e apresenta as opções', () => {
    const baseAmbigua: BaseDeAlimentos = {
      versao: 1,
      fonte: 'TEST_ONLY',
      somenteParaTeste: true,
      alimentos: [
        { ...repositorio.todos()[0]!, id: 'a', nome: 'Arroz A', aliases: ['arroz da casa'] },
        { ...repositorio.todos()[0]!, id: 'b', nome: 'Arroz B', aliases: ['arroz da casa'] },
      ],
    };
    const ambiguo = new RepositorioEmMemoria(async () => baseAmbigua);
    ambiguo.definirBase(baseAmbigua);
    const analise = analisarMarkdown('# D\n## Almoço\n- Arroz da casa | 100 g');
    const resolvido = resolverItens(analise.itens, ambiguo)[0];
    expect(resolvido?.origem).toBe('pendente');
    expect(resolvido?.motivo).toBe('Mais de uma correspondência encontrada');
    expect(resolvido?.opcoesCorrespondencia.map((a) => a.id)).toEqual(['a', 'b']);
  });

  it.each(['banana-maçã crua', 'patinho sem gordura grelhado'])(
    'resolve a variação controlada cadastrada como alias exato: %s',
    (alias) => {
      const base: BaseDeAlimentos = {
        versao: 1,
        fonte: 'TEST_ONLY',
        somenteParaTeste: true,
        alimentos: [
          {
            ...repositorio.todos()[0]!,
            id: 'controlado',
            nome: 'Alimento controlado',
            aliases: ['banana-maçã crua', 'patinho sem gordura grelhado'],
          },
        ],
      };
      const controlado = new RepositorioEmMemoria(async () => base);
      controlado.definirBase(base);
      const analise = analisarMarkdown(`# D\n## Almoço\n- ${alias} | 100 g`);
      expect(resolverItens(analise.itens, controlado)[0]?.alimentoId).toBe('controlado');
    },
  );

  it('conta os pendentes', () => {
    const { resolvidos } = resolverTexto(
      '# D\n## Almoço\n- Arroz branco cozido | 100 g\n- Xis inventado | 50 g',
    );
    expect(contarPendentes(resolvidos)).toBe(1);
  });
});

describe('determinarGramas', () => {
  it('usa o peso explícito quando existe', () => {
    const analise = analisarMarkdown('# D\n## Almoço\n- Qualquer | 3 fatia | peso 90 g');
    expect(determinarGramas(analise.itens[0]!, repositorio, null)).toBe(90);
  });

  it('devolve null quando não há como converter', () => {
    const analise = analisarMarkdown('# D\n## Almoço\n- Qualquer | 1 copo');
    expect(determinarGramas(analise.itens[0]!, repositorio, null)).toBeNull();
  });
});

describe('montarDieta', () => {
  it('cria blocos com estado original igual ao atual e ids únicos', () => {
    const { analise, resolvidos } = resolverTexto(`# Dieta: Plano
## Café da manhã
- Pão francês | 1 unidade | peso 50 g | 150 kcal
## Almoço
- Arroz branco cozido | 100 g | 128 kcal
- Feijão carioca cozido | 80 g | 61 kcal
`);
    const dieta = montarDieta(analise, resolvidos);

    expect(dieta.titulo).toBe('Plano');
    expect(dieta.blocos).toHaveLength(3);
    expect(new Set(dieta.blocos.map((b) => b.id)).size).toBe(3);
    for (const bloco of dieta.blocos) {
      expect(bloco.atual.alimentoNome).toBe(bloco.original.alimentoNome);
      expect(bloco.atual.refeicaoId).toBe(bloco.original.refeicaoId);
      expect(bloco.atual.quantidade).toBe(bloco.original.quantidade);
    }
  });

  it('numera a ordem dentro de cada refeição', () => {
    const { analise, resolvidos } = resolverTexto(`# D
## Almoço
- Arroz branco cozido | 100 g | 128 kcal
- Feijão carioca cozido | 80 g | 61 kcal
`);
    const dieta = montarDieta(analise, resolvidos);
    expect(dieta.blocos.map((b) => b.ordem)).toEqual([0, 1]);
  });

  it('descarta refeições declaradas sem nenhum item', () => {
    const { analise, resolvidos } = resolverTexto(`# D
## Café da manhã
## Almoço
- Arroz branco cozido | 100 g | 128 kcal
`);
    const dieta = montarDieta(analise, resolvidos);
    expect(dieta.refeicoes.map((r) => r.id)).toEqual(['almoco']);
  });

  it('mantém itens pendentes como blocos (nada é descartado)', () => {
    const { analise, resolvidos } = resolverTexto('# D\n## Almoço\n- Coisa desconhecida | 50 g');
    const dieta = montarDieta(analise, resolvidos);
    expect(dieta.blocos).toHaveLength(1);
    expect(dieta.blocos[0]?.origemDasCalorias).toBe('pendente');
    expect(dieta.blocos[0]?.original.alimentoNome).toBe('Coisa desconhecida');
  });

  it('preserva a descrição original da medida no bloco', () => {
    const { analise, resolvidos } = resolverTexto('# D\n## Almoço\n- Mandioca cozida | 1 pedaço');
    const bloco = montarDieta(analise, resolvidos).blocos[0];
    expect(bloco?.original.descricaoMedidaOriginal).toBe('pedaço');
    expect(bloco?.atual.descricaoMedidaOriginal).toBe('pedaço');
  });
});
