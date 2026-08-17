import { describe, expect, it } from 'vitest';
import { analisarMarkdown } from '../src/importacao/analisadorMarkdown';
import { gerarModeloMarkdown } from '../src/importacao/modelo';

describe('analisarMarkdown', () => {
  it('lê título, refeições e itens completos', () => {
    const resultado = analisarMarkdown(`# Dieta: Plano da Ana

## Café da manhã

- Pão francês | 1 unidade | peso 50 g | 150 kcal | obs: sem manteiga
- Mamão papaia | 100 g | 40 kcal
`);

    expect(resultado.titulo).toBe('Plano da Ana');
    expect(resultado.refeicoes).toEqual([{ id: 'cafe-da-manha', nome: 'Café da manhã', ordem: 0 }]);
    expect(resultado.erros).toHaveLength(0);
    expect(resultado.itens).toHaveLength(2);

    expect(resultado.itens[0]).toMatchObject({
      nomeAlimento: 'Pão francês',
      quantidade: 1,
      unidade: 'unidade',
      gramas: 50,
      kcalInformada: 150,
      observacao: 'sem manteiga',
      refeicaoId: 'cafe-da-manha',
    });
    expect(resultado.itens[1]).toMatchObject({ gramas: 100, kcalInformada: 40 });
  });

  it('aceita o título sem o prefixo "Dieta:"', () => {
    expect(analisarMarkdown('# Meu plano\n## Almoço\n- Arroz | 100 g').titulo).toBe('Meu plano');
  });

  it('reconhece apelidos de refeição e ignora parênteses', () => {
    const resultado = analisarMarkdown(`# Dieta: X
## Desjejum
- Café | 200 ml | 8 kcal
## Almoço (12h)
- Arroz | 100 g | 128 kcal
## Janta
- Sopa | 300 ml | 150 kcal
`);
    expect(resultado.refeicoes.map((r) => r.id)).toEqual(['cafe-da-manha', 'almoco', 'jantar']);
    expect(resultado.refeicoes.map((r) => r.nome)).toEqual(['Café da manhã', 'Almoço', 'Jantar']);
  });

  it('ordena refeições canônicas pelo dia, mesmo fora de ordem no arquivo', () => {
    const resultado = analisarMarkdown(`# Dieta: X
## Jantar
- A | 10 g | 10 kcal
## Café da manhã
- B | 10 g | 10 kcal
`);
    expect(resultado.refeicoes.map((r) => r.id)).toEqual(['cafe-da-manha', 'jantar']);
  });

  it('preserva refeições personalizadas depois das canônicas', () => {
    const resultado = analisarMarkdown(`# Dieta: X
## Pré-treino
- Banana | 70 g | 69 kcal
## Almoço
- Arroz | 100 g | 128 kcal
`);
    expect(resultado.refeicoes.map((r) => r.nome)).toEqual(['Almoço', 'Pré-treino']);
  });

  it('aceita vírgula decimal, unidade omitida e complementos de unidade', () => {
    const resultado = analisarMarkdown(`# Dieta: X
## Almoço
- Azeite | 1,5 colher de sopa | peso 20 g | 177 kcal
- Aveia | 30
`);
    expect(resultado.itens[0]).toMatchObject({
      quantidade: 1.5,
      unidade: 'colher',
      descricaoMedidaOriginal: 'colher de sopa',
      gramas: 20,
    });
    expect(resultado.itens[1]).toMatchObject({ quantidade: 30, unidade: 'g', gramas: 30 });
  });

  it.each([
    ['1 pedaço', 1, 'pedaço'],
    ['1 bife', 1, 'bife'],
    ['4 colheres de sopa', 4, 'colher'],
  ])('importa e preserva a medida livre "%s"', (medida, quantidade, unidade) => {
    const resultado = analisarMarkdown(`# D\n## Almoço\n- Alimento | ${medida}`);
    expect(resultado.erros).toEqual([]);
    expect(resultado.itens).toHaveLength(1);
    expect(resultado.itens[0]).toMatchObject({
      quantidade,
      unidade,
      descricaoMedidaOriginal: medida.replace(/^\d+\s*/, ''),
      gramas: null,
    });
  });

  it('importa unidade livre desconhecida como item em vez de descartar a linha', () => {
    const resultado = analisarMarkdown('# D\n## Almoço\n- Sopa | 2 escumadeiras fundas');
    expect(resultado.erros).toEqual([]);
    expect(resultado.itens[0]).toMatchObject({
      unidade: 'escumadeiras fundas',
      descricaoMedidaOriginal: 'escumadeiras fundas',
    });
  });

  it('aceita campos opcionais em qualquer ordem e formatos alternativos', () => {
    const resultado = analisarMarkdown(`# Dieta: X
## Almoço
- Arroz | 1 concha | kcal: 128 | obs: bem cozido | peso: 100g
`);
    expect(resultado.itens[0]).toMatchObject({
      kcalInformada: 128,
      gramas: 100,
      observacao: 'bem cozido',
    });
  });

  it.each(['à vontade', 'a vontade', 'livre'])(
    'importa a medida não contabilizada "%s" sem exigir número',
    (medida) => {
      const resultado = analisarMarkdown(`# D\n## Almoço\n- Tomate | ${medida}`);
      expect(resultado.erros).toEqual([]);
      expect(resultado.itens[0]).toMatchObject({
        nomeAlimento: 'Tomate',
        livre: true,
        quantidade: 0,
        unidade: 'à vontade',
        descricaoMedidaOriginal: 'à vontade',
        gramas: null,
        kcalInformada: null,
      });
    },
  );

  it('registra erro para item sem quantidade', () => {
    const resultado = analisarMarkdown('# Dieta: X\n## Almoço\n- Arroz');
    expect(resultado.itens).toHaveLength(0);
    expect(resultado.erros[0]?.linha).toBe(3);
    expect(resultado.erros[0]?.mensagem).toContain('falta a quantidade');
  });

  it('registra erro para quantidade não numérica', () => {
    const resultado = analisarMarkdown('# Dieta: X\n## Almoço\n- Arroz | muito');
    expect(resultado.erros[0]?.mensagem).toContain('não entendi a quantidade');
  });

  it('registra erro para item fora de refeição', () => {
    const resultado = analisarMarkdown('# Dieta: X\n- Arroz | 100 g');
    expect(resultado.erros.some((e) => e.mensagem.includes('fora de qualquer refeição'))).toBe(true);
  });

  it('registra erro quando não há nenhuma refeição', () => {
    const resultado = analisarMarkdown('# Dieta: X\n\ntexto solto');
    expect(resultado.erros.some((e) => e.mensagem.includes('Nenhuma refeição'))).toBe(true);
  });

  it('avisa (sem descartar o resto) quando um campo não é reconhecido', () => {
    const resultado = analisarMarkdown('# Dieta: X\n## Almoço\n- Arroz | 100 g | cor: branco');
    expect(resultado.itens).toHaveLength(1);
    expect(resultado.avisos.some((a) => a.mensagem.includes('não reconhecido'))).toBe(true);
  });

  it('avisa quando falta o título', () => {
    const resultado = analisarMarkdown('## Almoço\n- Arroz | 100 g');
    expect(resultado.titulo).toBe('Dieta importada');
    expect(resultado.avisos.some((a) => a.mensagem.includes('não tem um título'))).toBe(true);
  });

  it('avisa sobre linhas soltas sem transformá-las em itens', () => {
    const resultado = analisarMarkdown('# Dieta: X\n## Almoço\nbeber água\n- Arroz | 100 g');
    expect(resultado.itens).toHaveLength(1);
    expect(resultado.avisos.some((a) => a.conteudo === 'beber água')).toBe(true);
  });

  it('ignora comentários, citações, linhas horizontais e blocos de código', () => {
    const resultado = analisarMarkdown(`# Dieta: X
<!-- comentário -->
> nota do nutricionista
---
\`\`\`
- Isto não é item | 100 g
\`\`\`
## Almoço
- Arroz | 100 g | 128 kcal
`);
    expect(resultado.itens).toHaveLength(1);
    expect(resultado.avisos).toHaveLength(0);
  });

  it('aceita CRLF e marcadores * e +', () => {
    const resultado = analisarMarkdown('# Dieta: X\r\n## Almoço\r\n* Arroz | 100 g\r\n+ Feijão | 80 g');
    expect(resultado.itens).toHaveLength(2);
  });

  it('lê o modelo distribuído pelo aplicativo sem erros', () => {
    const resultado = analisarMarkdown(gerarModeloMarkdown());
    expect(resultado.erros).toEqual([]);
    expect(resultado.avisos).toEqual([]);
    expect(resultado.titulo).toBe('Nome do plano');
    expect(resultado.refeicoes.map((r) => r.id)).toEqual([
      'cafe-da-manha',
      'lanche-da-manha',
      'almoco',
      'lanche-da-tarde',
      'jantar',
      'ceia',
    ]);
    expect(resultado.itens.length).toBeGreaterThan(8);
    expect(resultado.itens.every((i) => i.kcalInformada !== null)).toBe(true);
  });

  it('instrui a IA a usar IDs exatos e representar itens à vontade', () => {
    const modelo = gerarModeloMarkdown([]);
    expect(modelo).toContain('NÃO use nomes genéricos');
    expect(modelo).toContain('Nunca invente nem altere um ID');
    expect(modelo).toContain('- Tomate | à vontade');
  });

  it('instrui a IA a escolher apenas uma opção quando a prescrição tem alternativas', () => {
    const modelo = gerarModeloMarkdown([]);
    expect(modelo).toContain('Opção 1');
    expect(modelo).toContain('escolha apenas UMA opção por refeição');
    expect(modelo).toContain('NUNCA liste duas opções alternativas');
  });
});
