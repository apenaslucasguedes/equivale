import { beforeEach, describe, expect, it } from 'vitest';
import { ArmazenamentoIndexedDB } from '../src/persistencia/indexeddb';
import { ArmazenamentoEmMemoria } from '../src/persistencia/memoria';
import { RepositorioDeEstado } from '../src/persistencia/repositorioDeEstado';
import { sanearEstado } from '../src/persistencia/migracoes';
import { CHAVE_ESTADO } from '../src/persistencia/armazenamento';
import { VERSAO_DO_ESQUEMA, estadoInicial } from '../src/domain/types';
import {
  criarBloco,
  criarDieta,
  criarEstadoComPlanos,
  criarPlanoDeTeste,
} from './apoio/fabricas';

describe('ArmazenamentoIndexedDB', () => {
  beforeEach(async () => {
    await new ArmazenamentoIndexedDB().limpar();
  });

  it('está disponível no ambiente de teste (fake-indexeddb)', () => {
    expect(ArmazenamentoIndexedDB.disponivel()).toBe(true);
  });

  it('grava e lê um valor', async () => {
    const armazenamento = new ArmazenamentoIndexedDB();
    await armazenamento.gravar('chave', { a: 1, texto: 'olá' });
    expect(await armazenamento.ler('chave')).toEqual({ a: 1, texto: 'olá' });
  });

  it('devolve null para chave inexistente', async () => {
    expect(await new ArmazenamentoIndexedDB().ler('nada')).toBeNull();
  });

  it('remove e limpa', async () => {
    const armazenamento = new ArmazenamentoIndexedDB();
    await armazenamento.gravar('a', 1);
    await armazenamento.gravar('b', 2);
    await armazenamento.remover('a');
    expect(await armazenamento.ler('a')).toBeNull();
    await armazenamento.limpar();
    expect(await armazenamento.ler('b')).toBeNull();
  });
});

describe('RepositorioDeEstado', () => {
  it('recupera o estado gravado (reabertura do aplicativo)', async () => {
    const repositorio = new RepositorioDeEstado(new ArmazenamentoIndexedDB());

    await repositorio.salvar(criarEstadoComPlanos());
    const { estado: recuperado, aviso } = await repositorio.carregar();

    expect(aviso).toBeNull();
    expect(recuperado.planos).toHaveLength(1);
    expect(recuperado.planos[0]?.nome).toBe('Plano de teste');
    expect(recuperado.planoAtivoId).toBe('plano_teste');
    expect(recuperado.planos[0]?.dietaAtual.blocos).toHaveLength(1);
    expect(recuperado.planos[0]?.dietaAtual.blocos[0]?.kcal).toBe(150);
  });

  it('recupera vários planos e o plano ativo', async () => {
    const repositorio = new RepositorioDeEstado(new ArmazenamentoEmMemoria());
    const estado = {
      ...criarEstadoComPlanos([
        criarPlanoDeTeste({ id: 'dias-uteis', nome: 'Dias úteis' }),
        criarPlanoDeTeste({ id: 'fim-de-semana', nome: 'Fim de semana' }),
      ]),
      planoAtivoId: 'fim-de-semana',
    };

    await repositorio.salvar(estado);
    const { estado: recuperado } = await repositorio.carregar();

    expect(recuperado.planos.map((p) => p.nome)).toEqual(['Dias úteis', 'Fim de semana']);
    expect(recuperado.planoAtivoId).toBe('fim-de-semana');
  });

  it('começa vazio quando nunca houve gravação', async () => {
    const repositorio = new RepositorioDeEstado(new ArmazenamentoEmMemoria());
    const { estado, aviso } = await repositorio.carregar();
    expect(estado.planos).toEqual([]);
    expect(estado.planoAtivoId).toBeNull();
    expect(aviso).toBeNull();
  });

  it('avisa e não quebra quando o dado gravado está corrompido', async () => {
    const armazenamento = new ArmazenamentoEmMemoria();
    await armazenamento.gravar(CHAVE_ESTADO, { lixo: true });
    const { estado, aviso } = await new RepositorioDeEstado(armazenamento).carregar();

    expect(estado.planos).toEqual([]);
    expect(aviso).toContain('Não foi possível ler os dados salvos');
  });

  it('apagarTudo remove o estado', async () => {
    const armazenamento = new ArmazenamentoEmMemoria();
    const repositorio = new RepositorioDeEstado(armazenamento);
    await repositorio.salvar(criarEstadoComPlanos());
    await repositorio.apagarTudo();
    expect((await repositorio.carregar()).estado.planos).toEqual([]);
  });

  it('atualiza a marca de tempo ao salvar', async () => {
    const repositorio = new RepositorioDeEstado(new ArmazenamentoEmMemoria());
    const estado = { ...estadoInicial(), atualizadoEm: '2000-01-01T00:00:00.000Z' };
    await repositorio.salvar(estado);
    const { estado: recuperado } = await repositorio.carregar();
    expect(recuperado.atualizadoEm).not.toBe('2000-01-01T00:00:00.000Z');
  });
});

describe('sanearEstado', () => {
  it('rejeita conteúdo que não é objeto', () => {
    expect(sanearEstado(null).ok).toBe(false);
    expect(sanearEstado('texto').ok).toBe(false);
    expect(sanearEstado([1, 2]).ok).toBe(false);
  });

  it('rejeita objeto sem versão de esquema', () => {
    const resultado = sanearEstado({ dieta: null });
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.erro).toContain('versaoDoEsquema');
  });

  it('normaliza configurações inválidas para os padrões', () => {
    const resultado = sanearEstado({
      versaoDoEsquema: 2,
      planos: [],
      configuracoes: { arredondamento: 'inexistente', modoDemonstracao: 'sim' },
    });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.valor.configuracoes.arredondamento).toBe('grama');
    expect(resultado.valor.configuracoes.modoDemonstracao).toBe(false);
  });

  it('descarta blocos sem id ou sem refeição original', () => {
    const resultado = sanearEstado({
      versaoDoEsquema: 1,
      dieta: {
        titulo: 'X',
        refeicoes: [{ id: 'almoco', nome: 'Almoço', ordem: 0 }],
        blocos: [
          { id: '', original: { refeicaoId: 'almoco' } },
          { id: 'ok', original: { refeicaoId: 'almoco', alimentoNome: 'Arroz' }, kcal: 10 },
          { id: 'sem-refeicao', original: {}, kcal: 10 },
        ],
      },
    });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.valor.planos[0]?.dietaAtual.blocos.map((b) => b.id)).toEqual(['ok']);
  });

  it('reancora blocos cuja refeição atual não existe mais', () => {
    const resultado = sanearEstado({
      versaoDoEsquema: 1,
      dieta: {
        titulo: 'X',
        refeicoes: [{ id: 'almoco', nome: 'Almoço', ordem: 0 }],
        blocos: [
          {
            id: 'a',
            kcal: 10,
            original: { refeicaoId: 'almoco', alimentoNome: 'Arroz', quantidade: 100 },
            atual: { refeicaoId: 'refeicao-apagada', alimentoNome: 'Arroz', quantidade: 100 },
          },
        ],
      },
    });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.valor.planos[0]?.dietaAtual.blocos[0]?.atual.refeicaoId).toBe('almoco');
  });

  it('descarta o plano quando não sobra nenhuma refeição', () => {
    const resultado = sanearEstado({ versaoDoEsquema: 1, dieta: { titulo: 'X', refeicoes: [] } });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.valor.planos).toEqual([]);
    expect(resultado.valor.planoAtivoId).toBeNull();
  });

  it('remove vínculos duplicados e incompletos', () => {
    const resultado = sanearEstado({
      versaoDoEsquema: 2,
      planos: [],
      vinculos: [
        { textoNormalizado: 'arroz', alimentoId: 'a1' },
        { textoNormalizado: 'arroz', alimentoId: 'a2' },
        { textoNormalizado: '', alimentoId: 'a3' },
        { alimentoId: 'a4' },
      ],
    });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.valor.vinculos).toHaveLength(1);
    expect(resultado.valor.vinculos[0]?.alimentoId).toBe('a1');
  });

  it('reduz esquema de versão futura para a versão suportada', () => {
    const resultado = sanearEstado({ versaoDoEsquema: 99, planos: [] });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.valor.versaoDoEsquema).toBe(VERSAO_DO_ESQUEMA);
  });

  it('preserva um estado íntegro sem perdas', () => {
    const original = criarEstadoComPlanos([
      criarPlanoDeTeste({ dieta: criarDieta([criarBloco({ id: 'x', kcal: 321 })]) }),
    ]);
    const resultado = sanearEstado(JSON.parse(JSON.stringify(original)));
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.valor.planos[0]).toEqual(original.planos[0]);
  });

  it('descarta um plano ilegível sem derrubar os demais', () => {
    const bom = criarPlanoDeTeste({ id: 'bom', nome: 'Bom' });
    const resultado = sanearEstado({
      versaoDoEsquema: 2,
      planos: [{ id: 'ruim', nome: 'Ruim' }, JSON.parse(JSON.stringify(bom))],
      planoAtivoId: 'ruim',
    });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.valor.planos.map((p) => p.id)).toEqual(['bom']);
    // O plano ativo apontava para o plano descartado: outro assume.
    expect(resultado.valor.planoAtivoId).toBe('bom');
  });

  it('reconstrói a dieta original de um plano que não a tenha guardado', () => {
    const plano = criarPlanoDeTeste();
    const semOriginal = { ...JSON.parse(JSON.stringify(plano)), dietaOriginal: undefined };
    const resultado = sanearEstado({
      versaoDoEsquema: 2,
      planos: [semOriginal],
      planoAtivoId: plano.id,
    });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.valor.planos[0]?.dietaOriginal.blocos[0]?.atual.alimentoNome).toBe(
      'Pão francês',
    );
  });

  it('gera ids novos para planos repetidos, para que um não sobrescreva o outro', () => {
    const plano = JSON.parse(JSON.stringify(criarPlanoDeTeste({ id: 'igual' })));
    const resultado = sanearEstado({
      versaoDoEsquema: 2,
      planos: [plano, JSON.parse(JSON.stringify(plano))],
      planoAtivoId: 'igual',
    });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.valor.planos).toHaveLength(2);
    expect(resultado.valor.planos[0]?.id).not.toBe(resultado.valor.planos[1]?.id);
  });

  it('mantém `estadoInicial` coerente com o esquema atual', () => {
    const inicial = estadoInicial();
    expect(inicial.versaoDoEsquema).toBe(VERSAO_DO_ESQUEMA);
    expect(inicial.planos).toEqual([]);
    expect(inicial.planoAtivoId).toBeNull();
  });
});
