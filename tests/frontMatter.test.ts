/** Metadados do plano no front matter do Markdown de importação. */

import { describe, expect, it } from 'vitest';
import { interpretarDiasSugeridos, lerFrontMatter } from '../src/importacao/frontMatter';
import { analisarMarkdown } from '../src/importacao/analisadorMarkdown';
import { gerarModeloMarkdown } from '../src/importacao/modelo';

const COM_METADADOS = `---
equivaleVersion: 1
planId: dias-uteis
planName: Dias úteis
suggestedDays: seg, ter, qua, qui, sex
---

# Dieta: Plano da semana

## Café da manhã

- Pão francês | 1 unidade | peso 50 g | 150 kcal
`;

describe('lerFrontMatter', () => {
  it('lê os quatro metadados', () => {
    const { metadados, presente } = lerFrontMatter(COM_METADADOS);
    expect(presente).toBe(true);
    expect(metadados.equivaleVersion).toBe(1);
    expect(metadados.planId).toBe('dias-uteis');
    expect(metadados.planName).toBe('Dias úteis');
    expect(metadados.suggestedDays).toEqual(['segunda', 'terca', 'quarta', 'quinta', 'sexta']);
  });

  it('arquivo sem front matter continua válido, sem metadados', () => {
    const { metadados, presente, avisos, corpo } = lerFrontMatter('# Dieta: X\n\n## Almoço\n');
    expect(presente).toBe(false);
    expect(avisos).toEqual([]);
    expect(metadados.planId).toBeNull();
    expect(metadados.suggestedDays).toEqual([]);
    expect(corpo).toContain('## Almoço');
  });

  it('remove o bloco do corpo preservando a numeração das linhas', () => {
    const { corpo } = lerFrontMatter(COM_METADADOS);
    expect(corpo).not.toContain('planId');
    expect(corpo.split('\n')).toHaveLength(COM_METADADOS.split('\n').length);
    // O título continua na mesma linha do arquivo original.
    expect(corpo.split('\n')[7]).toBe('# Dieta: Plano da semana');
  });

  it('aceita aspas em volta dos valores', () => {
    const { metadados } = lerFrontMatter('---\nplanName: "Fim de semana"\n---\n# X\n');
    expect(metadados.planName).toBe('Fim de semana');
  });

  it('avisa sobre metadado desconhecido sem invalidar o arquivo', () => {
    const { metadados, avisos } = lerFrontMatter('---\nplanId: a\ncorDaCapa: azul\n---\n# X\n');
    expect(metadados.planId).toBe('a');
    expect(avisos).toHaveLength(1);
    expect(avisos[0]?.mensagem).toContain('corDaCapa');
    expect(avisos[0]?.linha).toBe(3);
  });

  it('avisa quando o bloco não é fechado e ignora os metadados', () => {
    const { presente, avisos, corpo } = lerFrontMatter('---\nplanId: a\n\n# X\n');
    expect(presente).toBe(false);
    expect(avisos[0]?.mensagem).toContain('não é fechado');
    expect(corpo).toContain('# X');
  });

  it('avisa quando equivaleVersion não é número', () => {
    const { metadados, avisos } = lerFrontMatter('---\nequivaleVersion: muitas\n---\n# X\n');
    expect(metadados.equivaleVersion).toBeNull();
    expect(avisos[0]?.mensagem).toContain('não é um número');
  });

  it('avisa quando os metadados são de uma versão futura', () => {
    const { metadados, avisos } = lerFrontMatter('---\nequivaleVersion: 99\n---\n# X\n');
    expect(metadados.equivaleVersion).toBe(99);
    expect(avisos[0]?.mensagem).toContain('versão 99');
  });

  it('avisa sobre dias não reconhecidos, aproveitando os que deu', () => {
    const { metadados, avisos } = lerFrontMatter('---\nsuggestedDays: seg, feriado\n---\n# X\n');
    expect(metadados.suggestedDays).toEqual(['segunda']);
    expect(avisos[0]?.mensagem).toContain('feriado');
  });

  it('ignora linha sem "chave: valor"', () => {
    const { avisos } = lerFrontMatter('---\nplanId: a\nlinha solta\n---\n# X\n');
    expect(avisos[0]?.mensagem).toContain('chave: valor');
  });
});

describe('interpretarDiasSugeridos', () => {
  it('aceita abreviações, nomes completos e números', () => {
    expect(interpretarDiasSugeridos('seg, ter').dias).toEqual(['segunda', 'terca']);
    expect(interpretarDiasSugeridos('segunda-feira; sexta-feira').dias).toEqual([
      'segunda',
      'sexta',
    ]);
    expect(interpretarDiasSugeridos('sáb, dom').dias).toEqual(['domingo', 'sabado']);
    expect(interpretarDiasSugeridos('2 3 4 5 6').dias).toEqual([
      'segunda',
      'terca',
      'quarta',
      'quinta',
      'sexta',
    ]);
  });

  it('separa por espaço quando não há vírgulas', () => {
    expect(interpretarDiasSugeridos('seg ter qua').dias).toEqual(['segunda', 'terca', 'quarta']);
  });

  it('sempre devolve na ordem da semana, sem repetir', () => {
    expect(interpretarDiasSugeridos('sexta, segunda, sexta').dias).toEqual(['segunda', 'sexta']);
  });

  it('lista o que não reconheceu, aproveitando o que deu', () => {
    const { dias, naoReconhecidos } = interpretarDiasSugeridos('seg, feriado, xyz');
    expect(dias).toEqual(['segunda']);
    expect(naoReconhecidos).toEqual(['feriado', 'xyz']);
  });
});

describe('analisarMarkdown com metadados', () => {
  it('devolve os metadados junto com a análise', () => {
    const analise = analisarMarkdown(COM_METADADOS);
    expect(analise.temMetadados).toBe(true);
    expect(analise.metadados.planId).toBe('dias-uteis');
    expect(analise.titulo).toBe('Plano da semana');
    expect(analise.itens).toHaveLength(1);
    expect(analise.erros).toEqual([]);
  });

  it('os números de linha continuam certos com front matter', () => {
    const analise = analisarMarkdown(COM_METADADOS);
    // O item está na 12ª linha do arquivo; o bloco de metadados não desloca nada.
    expect(analise.itens[0]?.linha).toBe(12);
  });

  it('usa planName como título quando não há "# Dieta: ..."', () => {
    const analise = analisarMarkdown(
      '---\nplanName: Fim de semana\n---\n\n## Almoço\n\n- Arroz | 100 g | 128 kcal\n',
    );
    expect(analise.titulo).toBe('Fim de semana');
    expect(analise.avisos.some((a) => a.mensagem.includes('Usamos "Dieta importada"'))).toBe(false);
  });

  it('sem título e sem planName, avisa e usa o nome padrão', () => {
    const analise = analisarMarkdown('## Almoço\n\n- Arroz | 100 g | 128 kcal\n');
    expect(analise.titulo).toBe('Dieta importada');
    expect(analise.avisos.some((a) => a.mensagem.includes('Dieta importada'))).toBe(true);
  });

  it('o modelo baixado traz os metadados e é importável sem erros', () => {
    const analise = analisarMarkdown(gerarModeloMarkdown());
    expect(analise.temMetadados).toBe(true);
    expect(analise.metadados.equivaleVersion).toBe(1);
    expect(analise.metadados.planId).toBe('plano-principal');
    expect(analise.metadados.planName).toBe('Nome do plano');
    expect(analise.metadados.suggestedDays).toEqual([
      'segunda',
      'terca',
      'quarta',
      'quinta',
      'sexta',
    ]);
    expect(analise.erros).toEqual([]);
    expect(analise.avisos).toEqual([]);
    expect(analise.refeicoes).toHaveLength(6);
  });
});
