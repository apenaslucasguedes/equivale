import { describe, expect, it } from 'vitest';
import {
  adicionarAlimentoNaDieta,
  ajustarAlimentoNaDieta,
  blocosDaRefeicao,
  contarAlteracoes,
  foiAlterado,
  foiMovido,
  foiSubstituido,
  moverBlocoNaDieta,
  restaurarBlocoNaDieta,
  restaurarDietaOriginal,
  removerBlocoDaDieta,
  somaDeCalorias,
  substituirAlimentoNaDieta,
} from '../src/domain/blocos';
import { criarBloco, criarDieta } from './apoio/fabricas';

const substituicao = {
  alimento: { id: 'TEST_ONLY_aveia_flocos', nome: 'Aveia em flocos' },
  quantidade: 38.46153846153846,
  unidade: 'g' as const,
  medidaCaseira: '≈ 2,5 colher de sopa',
};

describe('substituição', () => {
  it('troca o alimento mantendo id, calorias e dados originais', () => {
    const dieta = criarDieta();
    const depois = substituirAlimentoNaDieta(dieta, 'bloco_1', substituicao);
    const bloco = depois.blocos[0];

    expect(bloco?.id).toBe('bloco_1');
    expect(bloco?.kcal).toBe(150);
    expect(bloco?.original).toEqual(dieta.blocos[0]?.original);
    expect(bloco?.atual.alimentoNome).toBe('Aveia em flocos');
    expect(bloco?.atual.alimentoId).toBe('TEST_ONLY_aveia_flocos');
    expect(bloco?.atual.quantidade).toBeCloseTo(38.46153846153846, 10);
    expect(bloco?.atual.medidaCaseira).toBe('≈ 2,5 colher de sopa');
  });

  it('não altera a dieta recebida (imutabilidade)', () => {
    const dieta = criarDieta();
    substituirAlimentoNaDieta(dieta, 'bloco_1', substituicao);
    expect(dieta.blocos[0]?.atual.alimentoNome).toBe('Pão francês');
  });

  it('ignora bloco inexistente', () => {
    const dieta = criarDieta();
    expect(substituirAlimentoNaDieta(dieta, 'inexistente', substituicao)).toBe(dieta);
  });

  it('permite substituições sucessivas preservando o original', () => {
    let dieta = criarDieta();
    dieta = substituirAlimentoNaDieta(dieta, 'bloco_1', substituicao);
    dieta = substituirAlimentoNaDieta(dieta, 'bloco_1', {
      alimento: { id: 'TEST_ONLY_banana_prata', nome: 'Banana prata' },
      quantidade: 153.06,
      unidade: 'g',
    });

    expect(dieta.blocos[0]?.atual.alimentoNome).toBe('Banana prata');
    expect(dieta.blocos[0]?.original.alimentoNome).toBe('Pão francês');
    expect(dieta.blocos[0]?.kcal).toBe(150);
    expect(dieta.blocos[0]?.atual.medidaCaseira).toBeNull();
  });

  it('não impede substituição entre categorias diferentes', () => {
    const dieta = criarDieta();
    const depois = substituirAlimentoNaDieta(dieta, 'bloco_1', {
      alimento: { id: 'TEST_ONLY_azeite', nome: 'Azeite de oliva' },
      quantidade: 16.97,
      unidade: 'g',
    });
    expect(depois.blocos[0]?.atual.alimentoNome).toBe('Azeite de oliva');
  });
});

describe('registro do que foi consumido', () => {
  it('ajusta quantidade e calorias sem perder a prescrição original', () => {
    const dieta = ajustarAlimentoNaDieta(criarDieta(), 'bloco_1', {
      alimento: { id: 'TEST_ONLY_pao_frances', nome: 'Pão francês' },
      quantidade: 100,
      kcal: 300,
    });
    expect(dieta.blocos[0]).toMatchObject({
      kcal: 300,
      kcalOriginal: 150,
      atual: { quantidade: 100, unidade: 'g' },
      original: { quantidade: 50, unidade: 'g' },
    });
  });

  it('adiciona um alimento novo à refeição com calorias calculadas', () => {
    const dieta = adicionarAlimentoNaDieta(criarDieta(), {
      id: 'extra_1', refeicaoId: 'cafe-da-manha',
      alimento: { id: 'TEST_ONLY_banana_prata', nome: 'Banana prata' },
      quantidade: 80, kcal: 78,
    });
    expect(dieta.blocos).toHaveLength(2);
    expect(dieta.blocos[1]).toMatchObject({ adicionado: true, kcal: 78 });
    expect(somaDeCalorias(dieta.blocos)).toBe(228);
  });

  it('remove um item e a restauração geral volta à dieta prescrita', () => {
    const removida = removerBlocoDaDieta(criarDieta(), 'bloco_1');
    expect(removida.blocos[0]).toMatchObject({ removido: true, kcal: 0, kcalOriginal: 150 });
    const restaurada = restaurarDietaOriginal(removida);
    expect(restaurada.blocos[0]).toMatchObject({ kcal: 150, atual: { quantidade: 50 } });
    expect(restaurada.blocos[0]?.removido).toBeUndefined();
  });
});

describe('movimentação entre refeições', () => {
  it('reordena um item para cima dentro da mesma refeição', () => {
    const dieta = criarDieta([
      criarBloco({ id: 'a', refeicaoId: 'almoco', ordem: 0, nome: 'Arroz' }),
      criarBloco({ id: 'b', refeicaoId: 'almoco', ordem: 1, nome: 'Feijão' }),
      criarBloco({ id: 'c', refeicaoId: 'almoco', ordem: 2, nome: 'Salada' }),
    ]);
    const depois = moverBlocoNaDieta(dieta, 'c', 'almoco', 0);
    expect(blocosDaRefeicao(depois, 'almoco').map((b) => b.id)).toEqual(['c', 'a', 'b']);
  });

  it('reordena um item para baixo dentro da mesma refeição', () => {
    const dieta = criarDieta([
      criarBloco({ id: 'a', refeicaoId: 'almoco', ordem: 0 }),
      criarBloco({ id: 'b', refeicaoId: 'almoco', ordem: 1 }),
      criarBloco({ id: 'c', refeicaoId: 'almoco', ordem: 2 }),
    ]);
    const depois = moverBlocoNaDieta(dieta, 'a', 'almoco', 2);
    expect(blocosDaRefeicao(depois, 'almoco').map((b) => b.id)).toEqual(['b', 'c', 'a']);
  });
  it('muda a refeição atual sem tocar nas calorias', () => {
    const dieta = criarDieta();
    const depois = moverBlocoNaDieta(dieta, 'bloco_1', 'jantar');

    expect(depois.blocos[0]?.atual.refeicaoId).toBe('jantar');
    expect(depois.blocos[0]?.original.refeicaoId).toBe('cafe-da-manha');
    expect(depois.blocos[0]?.kcal).toBe(150);
    expect(depois.blocos[0]?.atual.quantidade).toBe(50);
  });

  it('ignora refeição de destino inexistente', () => {
    const dieta = criarDieta();
    expect(moverBlocoNaDieta(dieta, 'bloco_1', 'nao-existe')).toBe(dieta);
  });

  it('ignora bloco inexistente', () => {
    const dieta = criarDieta();
    expect(moverBlocoNaDieta(dieta, 'nada', 'jantar')).toBe(dieta);
  });

  it('respeita a posição pedida dentro da refeição de destino', () => {
    const dieta = criarDieta([
      criarBloco({ id: 'a', refeicaoId: 'almoco', ordem: 0, nome: 'Arroz' }),
      criarBloco({ id: 'b', refeicaoId: 'almoco', ordem: 1, nome: 'Feijão' }),
      criarBloco({ id: 'c', refeicaoId: 'jantar', ordem: 0, nome: 'Batata' }),
    ]);

    const depois = moverBlocoNaDieta(dieta, 'c', 'almoco', 1);
    expect(blocosDaRefeicao(depois, 'almoco').map((b) => b.id)).toEqual(['a', 'c', 'b']);
  });

  it('sem posição, coloca o bloco no fim da refeição de destino', () => {
    const dieta = criarDieta([
      criarBloco({ id: 'a', refeicaoId: 'almoco', ordem: 0 }),
      criarBloco({ id: 'b', refeicaoId: 'jantar', ordem: 0 }),
    ]);
    const depois = moverBlocoNaDieta(dieta, 'b', 'almoco');
    expect(blocosDaRefeicao(depois, 'almoco').map((b) => b.id)).toEqual(['a', 'b']);
  });

  it('mover para a mesma refeição não muda nada de essencial', () => {
    const dieta = criarDieta();
    const depois = moverBlocoNaDieta(dieta, 'bloco_1', 'cafe-da-manha');
    expect(depois.blocos[0]?.atual.refeicaoId).toBe('cafe-da-manha');
  });
});

describe('restauração', () => {
  it('restaura um item para alimento, quantidade e refeição originais', () => {
    let dieta = criarDieta();
    dieta = substituirAlimentoNaDieta(dieta, 'bloco_1', substituicao);
    dieta = moverBlocoNaDieta(dieta, 'bloco_1', 'jantar');
    expect(foiAlterado(dieta.blocos[0]!)).toBe(true);

    const restaurada = restaurarBlocoNaDieta(dieta, 'bloco_1');
    const bloco = restaurada.blocos[0]!;

    expect(bloco.atual.alimentoNome).toBe('Pão francês');
    expect(bloco.atual.quantidade).toBe(50);
    expect(bloco.atual.unidade).toBe('g');
    expect(bloco.atual.refeicaoId).toBe('cafe-da-manha');
    expect(bloco.atual.medidaCaseira).toBeNull();
    expect(bloco.kcal).toBe(150);
    expect(foiAlterado(bloco)).toBe(false);
  });

  it('restaurar a dieta desfaz tudo sem apagar blocos', () => {
    let dieta = criarDieta([
      criarBloco({ id: 'a', nome: 'Arroz', refeicaoId: 'almoco' }),
      criarBloco({ id: 'b', nome: 'Feijão', refeicaoId: 'almoco' }),
    ]);
    dieta = substituirAlimentoNaDieta(dieta, 'a', substituicao);
    dieta = moverBlocoNaDieta(dieta, 'b', 'jantar');
    expect(contarAlteracoes(dieta)).toBe(2);

    const restaurada = restaurarDietaOriginal(dieta);
    expect(restaurada.blocos).toHaveLength(2);
    expect(contarAlteracoes(restaurada)).toBe(0);
    expect(restaurada.titulo).toBe(dieta.titulo);
    expect(restaurada.blocos.map((b) => b.id)).toEqual(['a', 'b']);
  });
});

describe('consultas', () => {
  it('detecta substituição e movimentação separadamente', () => {
    const base = criarDieta();
    const substituido = substituirAlimentoNaDieta(base, 'bloco_1', substituicao).blocos[0]!;
    const movido = moverBlocoNaDieta(base, 'bloco_1', 'jantar').blocos[0]!;

    expect(foiSubstituido(substituido)).toBe(true);
    expect(foiMovido(substituido)).toBe(false);
    expect(foiSubstituido(movido)).toBe(false);
    expect(foiMovido(movido)).toBe(true);
  });

  it('lista os blocos de uma refeição em ordem', () => {
    const dieta = criarDieta([
      criarBloco({ id: 'b', refeicaoId: 'almoco', ordem: 1 }),
      criarBloco({ id: 'a', refeicaoId: 'almoco', ordem: 0 }),
      criarBloco({ id: 'c', refeicaoId: 'jantar', ordem: 0 }),
    ]);
    expect(blocosDaRefeicao(dieta, 'almoco').map((b) => b.id)).toEqual(['a', 'b']);
  });

  it('soma calorias ignorando valores inválidos', () => {
    const blocos = [criarBloco({ id: 'a', kcal: 100 }), criarBloco({ id: 'b', kcal: Number.NaN })];
    expect(somaDeCalorias(blocos)).toBe(100);
  });
});
