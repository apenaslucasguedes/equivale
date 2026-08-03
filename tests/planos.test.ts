/**
 * Coleção de planos: independência entre eles, plano ativo e as ações do
 * redutor que operam sobre o plano ativo.
 */

import { describe, expect, it } from 'vitest';
import {
  adicionarPlano,
  ativarPlano,
  comPlanoAtivoValido,
  criarPlano,
  descreverDias,
  dietaAtiva,
  excluirPlano,
  ordenarDias,
  planoAtivo,
  renomearPlano,
  restaurarPlano,
  substituirPlano,
} from '../src/domain/planos';
import { redutor } from '../src/estado/acoes';
import { estadoInicial } from '../src/domain/types';
import { criarBloco, criarDieta, criarEstadoComPlanos, criarPlanoDeTeste } from './apoio/fabricas';

function doisPlanos() {
  return criarEstadoComPlanos([
    criarPlanoDeTeste({
      id: 'dias-uteis',
      nome: 'Dias úteis',
      dieta: criarDieta([criarBloco({ id: 'a', nome: 'Pão francês' })]),
    }),
    criarPlanoDeTeste({
      id: 'fim-de-semana',
      nome: 'Fim de semana',
      diasSugeridos: ['sabado', 'domingo'],
      dieta: criarDieta([criarBloco({ id: 'b', nome: 'Tapioca', kcal: 200 })]),
    }),
  ]);
}

describe('criarPlano', () => {
  it('guarda a dieta atual e uma dieta original sem alterações', () => {
    const plano = criarPlano({ nome: 'Plano X', dieta: criarDieta() });
    expect(plano.nome).toBe('Plano X');
    expect(plano.dietaAtual.blocos).toHaveLength(1);
    expect(plano.dietaOriginal.blocos[0]?.atual.alimentoNome).toBe('Pão francês');
  });

  it('gera um id quando nenhum é informado e respeita o id do arquivo', () => {
    expect(criarPlano({ nome: 'A', dieta: criarDieta() }).id).toMatch(/^plano_/);
    expect(criarPlano({ id: 'dias-uteis', nome: 'A', dieta: criarDieta() }).id).toBe('dias-uteis');
  });

  it('normaliza nome vazio e descrição em branco', () => {
    const plano = criarPlano({ nome: '   ', descricao: '  ', dieta: criarDieta() });
    expect(plano.nome).toBe('Plano sem nome');
    expect(plano.descricao).toBeNull();
  });
});

describe('dias sugeridos', () => {
  it('ordena pela semana e remove repetições', () => {
    expect(ordenarDias(['sexta', 'segunda', 'segunda', 'domingo'])).toEqual([
      'domingo',
      'segunda',
      'sexta',
    ]);
  });

  it('descreve em formato curto', () => {
    expect(descreverDias(['segunda', 'terca', 'quarta'])).toBe('seg, ter, qua');
    expect(descreverDias([])).toBe('');
  });
});

describe('plano ativo', () => {
  it('encontra o plano ativo e a dieta dele', () => {
    const estado = doisPlanos();
    expect(planoAtivo(estado)?.id).toBe('dias-uteis');
    expect(dietaAtiva(estado)?.blocos[0]?.id).toBe('a');
  });

  it('trocar de plano muda a dieta exibida, sem alterar dado nenhum', () => {
    const estado = ativarPlano(doisPlanos(), 'fim-de-semana');
    expect(dietaAtiva(estado)?.blocos[0]?.id).toBe('b');
    expect(estado.planos).toHaveLength(2);
  });

  it('ignora a ativação de um plano que não existe', () => {
    const estado = doisPlanos();
    expect(ativarPlano(estado, 'inexistente').planoAtivoId).toBe('dias-uteis');
  });

  it('reancora o plano ativo quando ele não existe mais', () => {
    const estado = comPlanoAtivoValido({ ...doisPlanos(), planoAtivoId: 'sumiu' });
    expect(estado.planoAtivoId).toBe('dias-uteis');
  });

  it('sem planos, não há plano ativo', () => {
    expect(planoAtivo(estadoInicial())).toBeNull();
    expect(dietaAtiva(estadoInicial())).toBeNull();
  });
});

describe('adicionar e substituir', () => {
  it('adicionar não toca nos planos existentes e ativa o novo', () => {
    const estado = adicionarPlano(doisPlanos(), criarPlanoDeTeste({ id: 'novo', nome: 'Novo' }));
    expect(estado.planos.map((p) => p.id)).toEqual(['dias-uteis', 'fim-de-semana', 'novo']);
    expect(estado.planoAtivoId).toBe('novo');
  });

  it('substituir troca só o plano de mesmo id, na mesma posição', () => {
    const estado = substituirPlano(
      doisPlanos(),
      criarPlanoDeTeste({
        id: 'dias-uteis',
        nome: 'Dias úteis (revisado)',
        dieta: criarDieta([criarBloco({ id: 'z', nome: 'Cuscuz', kcal: 111 })]),
      }),
    );

    expect(estado.planos.map((p) => p.id)).toEqual(['dias-uteis', 'fim-de-semana']);
    expect(estado.planos[0]?.nome).toBe('Dias úteis (revisado)');
    expect(estado.planos[0]?.dietaAtual.blocos[0]?.id).toBe('z');
    // O outro plano segue exatamente igual.
    expect(estado.planos[1]?.dietaAtual.blocos[0]?.id).toBe('b');
  });

  it('substituir um id inexistente adiciona, em vez de apagar a coleção', () => {
    const estado = substituirPlano(doisPlanos(), criarPlanoDeTeste({ id: 'outro' }));
    expect(estado.planos).toHaveLength(3);
  });
});

describe('renomear e excluir', () => {
  it('renomeia sem alterar itens', () => {
    const estado = renomearPlano(doisPlanos(), 'fim-de-semana', '  Sábado e domingo  ');
    expect(estado.planos[1]?.nome).toBe('Sábado e domingo');
    expect(estado.planos[1]?.dietaAtual.blocos).toHaveLength(1);
  });

  it('recusa renomear para um nome vazio', () => {
    const estado = renomearPlano(doisPlanos(), 'fim-de-semana', '   ');
    expect(estado.planos[1]?.nome).toBe('Fim de semana');
  });

  it('excluir remove SÓ o plano indicado', () => {
    const estado = excluirPlano(doisPlanos(), 'dias-uteis');
    expect(estado.planos.map((p) => p.id)).toEqual(['fim-de-semana']);
    expect(estado.planos[0]?.dietaAtual.blocos[0]?.id).toBe('b');
  });

  it('excluir o plano ativo promove outro plano', () => {
    const estado = excluirPlano(doisPlanos(), 'dias-uteis');
    expect(estado.planoAtivoId).toBe('fim-de-semana');
  });

  it('excluir o último plano deixa o estado sem plano ativo', () => {
    let estado = excluirPlano(doisPlanos(), 'dias-uteis');
    estado = excluirPlano(estado, 'fim-de-semana');
    expect(estado.planos).toEqual([]);
    expect(estado.planoAtivoId).toBeNull();
  });

  it('excluir um id inexistente não faz nada', () => {
    expect(excluirPlano(doisPlanos(), 'nao-existe').planos).toHaveLength(2);
  });
});

describe('restauração por plano', () => {
  it('restaura só o plano indicado', () => {
    let estado = doisPlanos();
    estado = redutor(estado, {
      tipo: 'substituirAlimento',
      blocoId: 'a',
      dados: { alimento: { id: 'x', nome: 'Tofu' }, quantidade: 197, unidade: 'g' },
    });
    estado = ativarPlano(estado, 'fim-de-semana');
    estado = redutor(estado, { tipo: 'moverBloco', blocoId: 'b', refeicaoId: 'jantar' });

    const restaurado = restaurarPlano(estado, 'dias-uteis');

    expect(restaurado.planos[0]?.dietaAtual.blocos[0]?.atual.alimentoNome).toBe('Pão francês');
    // O outro plano mantém a movimentação dele.
    expect(restaurado.planos[1]?.dietaAtual.blocos[0]?.atual.refeicaoId).toBe('jantar');
  });
});

describe('redutor com vários planos', () => {
  it('substituir alimento afeta só o plano ativo', () => {
    const estado = redutor(doisPlanos(), {
      tipo: 'substituirAlimento',
      blocoId: 'a',
      dados: { alimento: { id: 'x', nome: 'Tofu' }, quantidade: 197, unidade: 'g' },
    });

    expect(estado.planos[0]?.dietaAtual.blocos[0]?.atual.alimentoNome).toBe('Tofu');
    expect(estado.planos[1]?.dietaAtual.blocos[0]?.atual.alimentoNome).toBe('Tapioca');
  });

  it('mover bloco afeta só o plano ativo', () => {
    const estado = redutor(ativarPlano(doisPlanos(), 'fim-de-semana'), {
      tipo: 'moverBloco',
      blocoId: 'b',
      refeicaoId: 'jantar',
    });

    expect(estado.planos[1]?.dietaAtual.blocos[0]?.atual.refeicaoId).toBe('jantar');
    expect(estado.planos[0]?.dietaAtual.blocos[0]?.atual.refeicaoId).toBe('cafe-da-manha');
  });

  it('informar calorias corrige também a prescrição guardada do plano', () => {
    const estado = redutor(doisPlanos(), { tipo: 'definirCalorias', blocoId: 'a', kcal: 222 });
    expect(estado.planos[0]?.dietaAtual.blocos[0]?.kcal).toBe(222);
    expect(estado.planos[0]?.dietaOriginal.blocos[0]?.kcal).toBe(222);
    expect(estado.planos[1]?.dietaAtual.blocos[0]?.kcal).toBe(200);
  });

  it('resolver pendência vale para a dieta atual e para a original', () => {
    const estado = redutor(doisPlanos(), {
      tipo: 'resolverPendencia',
      blocoId: 'a',
      alimentoId: 'TEST_ONLY_pao_frances',
      nome: 'Pão francês',
      kcal: 145,
    });

    expect(estado.planos[0]?.dietaAtual.blocos[0]?.original.alimentoId).toBe(
      'TEST_ONLY_pao_frances',
    );
    expect(estado.planos[0]?.dietaOriginal.blocos[0]?.kcal).toBe(145);
  });

  it('as ações de plano não misturam nada entre planos', () => {
    let estado = redutor(doisPlanos(), {
      tipo: 'planoAdicionado',
      plano: criarPlanoDeTeste({ id: 'terceiro', nome: 'Terceiro' }),
    });
    expect(estado.planos).toHaveLength(3);

    estado = redutor(estado, { tipo: 'planoExcluido', planoId: 'terceiro' });
    expect(estado.planos.map((p) => p.id)).toEqual(['dias-uteis', 'fim-de-semana']);

    estado = redutor(estado, { tipo: 'planoRenomeado', planoId: 'dias-uteis', nome: 'Semana' });
    expect(estado.planos[0]?.nome).toBe('Semana');
    expect(estado.planos[1]?.nome).toBe('Fim de semana');
  });

  it('vínculos e configurações são compartilhados por todos os planos', () => {
    let estado = redutor(doisPlanos(), { tipo: 'definirArredondamento', modo: 'multiplo5' });
    estado = redutor(estado, {
      tipo: 'registrarVinculo',
      vinculo: {
        textoNormalizado: 'tapioca',
        textoOriginal: 'Tapioca',
        alimentoId: 'x',
        criadoEm: '2026-01-01T00:00:00.000Z',
      },
    });
    estado = redutor(estado, { tipo: 'planoAtivado', planoId: 'fim-de-semana' });

    expect(estado.configuracoes.arredondamento).toBe('multiplo5');
    expect(estado.vinculos).toHaveLength(1);
  });

  it('apagar tudo esvazia a coleção inteira', () => {
    const estado = redutor(doisPlanos(), { tipo: 'apagarTudo' });
    expect(estado.planos).toEqual([]);
    expect(estado.planoAtivoId).toBeNull();
  });
});
