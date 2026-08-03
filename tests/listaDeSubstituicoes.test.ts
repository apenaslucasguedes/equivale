/**
 * Camada preparada para a lista de substituições da nutricionista.
 *
 * Recurso FUTURO: aqui existem só o modelo, as consultas puras e o saneamento.
 * Não há importação, a lista não é persistida e ela não restringe as
 * substituições por equivalência calórica do aplicativo.
 */

import { describe, expect, it } from 'vitest';
import {
  alternativasSugeridas,
  contarAlimentos,
  gruposDoAlimento,
  listaVazia,
  sanearListaDeSubstituicoes,
} from '../src/domain/listaDeSubstituicoes';
import type { ListaDeSubstituicoes } from '../src/domain/listaDeSubstituicoes';

function listaDeExemplo(): ListaDeSubstituicoes {
  return {
    id: 'lista-1',
    nome: 'Lista da nutricionista',
    origem: 'Consulta de janeiro',
    criadaEm: '2026-01-01T00:00:00.000Z',
    grupos: [
      {
        id: 'cereais',
        nome: 'Cereais e tubérculos',
        descricao: 'Escolha uma opção por refeição',
        alimentos: [
          {
            id: 'pao',
            nome: 'Pão francês',
            alimentoId: 'TEST_ONLY_pao_frances',
            quantidade: 1,
            unidade: 'unidade',
            medidaCaseira: '1 unidade (50 g)',
            kcal: 150,
            observacao: null,
          },
          {
            id: 'arroz',
            nome: 'Arroz branco cozido',
            alimentoId: null,
            quantidade: 4,
            unidade: 'colher',
            medidaCaseira: '4 colheres de sopa',
            kcal: 150,
            observacao: null,
          },
        ],
      },
      {
        id: 'frutas',
        nome: 'Frutas',
        descricao: null,
        alimentos: [
          {
            id: 'banana',
            nome: 'Banana prata',
            alimentoId: null,
            quantidade: 1,
            unidade: 'unidade',
            medidaCaseira: '1 unidade média',
            kcal: 70,
            observacao: null,
          },
        ],
      },
    ],
  };
}

describe('modelo', () => {
  it('cria uma lista vazia utilizável', () => {
    const lista = listaVazia('l1', 'Minha lista');
    expect(lista.grupos).toEqual([]);
    expect(contarAlimentos(lista)).toBe(0);
  });

  it('conta os alimentos de todos os grupos', () => {
    expect(contarAlimentos(listaDeExemplo())).toBe(3);
  });

  it('guarda quantidades e medidas caseiras de cada opção', () => {
    const opcao = listaDeExemplo().grupos[0]?.alimentos[1];
    expect(opcao?.quantidade).toBe(4);
    expect(opcao?.unidade).toBe('colher');
    expect(opcao?.medidaCaseira).toBe('4 colheres de sopa');
  });
});

describe('consultas', () => {
  it('encontra os grupos de um alimento por nome ou por id da base', () => {
    const lista = listaDeExemplo();
    expect(gruposDoAlimento(lista, 'pão francês').map((g) => g.id)).toEqual(['cereais']);
    expect(gruposDoAlimento(lista, 'TEST_ONLY_pao_frances').map((g) => g.id)).toEqual(['cereais']);
    expect(gruposDoAlimento(lista, 'quiabo')).toEqual([]);
  });

  it('sugere as outras opções do mesmo grupo, sem repetir o próprio alimento', () => {
    const alternativas = alternativasSugeridas(listaDeExemplo(), 'Pão francês');
    expect(alternativas.map((a) => a.id)).toEqual(['arroz']);
  });

  it('devolve lista vazia para alimento que não está em nenhum grupo', () => {
    expect(alternativasSugeridas(listaDeExemplo(), 'Quiabo')).toEqual([]);
  });
});

describe('saneamento de dados não confiáveis', () => {
  it('rejeita conteúdo que não é objeto', () => {
    expect(sanearListaDeSubstituicoes(null)).toBeNull();
    expect(sanearListaDeSubstituicoes([1, 2])).toBeNull();
  });

  it('descarta grupos e alimentos sem nome, preservando o resto', () => {
    const lista = sanearListaDeSubstituicoes({
      nome: 'Lista',
      grupos: [
        { nome: '', alimentos: [] },
        {
          nome: 'Cereais',
          alimentos: [{ nome: 'Arroz', quantidade: 100 }, { quantidade: 50 }, 'lixo'],
        },
      ],
    });

    expect(lista?.grupos).toHaveLength(1);
    expect(lista?.grupos[0]?.alimentos).toHaveLength(1);
    expect(lista?.grupos[0]?.alimentos[0]?.nome).toBe('Arroz');
  });

  it('preenche identificadores e padrões ausentes', () => {
    const lista = sanearListaDeSubstituicoes({
      grupos: [{ nome: 'Frutas', alimentos: [{ nome: 'Banana', kcal: -5 }] }],
    });

    expect(lista?.nome).toBe('Lista de substituições');
    expect(lista?.grupos[0]?.id).toBe('grupo-0');
    expect(lista?.grupos[0]?.alimentos[0]?.id).toBe('alimento-0');
    expect(lista?.grupos[0]?.alimentos[0]?.unidade).toBe('g');
    // Calorias negativas não viram dado errado.
    expect(lista?.grupos[0]?.alimentos[0]?.kcal).toBeNull();
  });

  it('faz a volta completa de uma lista íntegra', () => {
    const original = listaDeExemplo();
    expect(sanearListaDeSubstituicoes(JSON.parse(JSON.stringify(original)))).toEqual(original);
  });
});
