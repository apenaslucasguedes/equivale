/**
 * Migração do esquema 1 (dieta única) para o 2 (coleção de planos).
 *
 * A regra é dura: NADA pode se perder. Todos os itens, as substituições, as
 * movimentações, os vínculos e as configurações precisam sobreviver, e a dieta
 * única precisa virar um plano chamado “Plano principal”.
 */

import { describe, expect, it } from 'vitest';
import { sanearEstado } from '../src/persistencia/migracoes';
import { RepositorioDeEstado } from '../src/persistencia/repositorioDeEstado';
import { ArmazenamentoEmMemoria } from '../src/persistencia/memoria';
import { CHAVE_ESTADO } from '../src/persistencia/armazenamento';
import { NOME_DO_PLANO_MIGRADO, VERSAO_DO_ESQUEMA } from '../src/domain/types';
import { moverBlocoNaDieta, substituirAlimentoNaDieta } from '../src/domain/blocos';
import { criarBloco, criarDieta } from './apoio/fabricas';

/** Exatamente o objeto que a versão anterior gravava no IndexedDB. */
function estadoAntigo() {
  let dieta = criarDieta([
    criarBloco({ id: 'a', nome: 'Pão francês', refeicaoId: 'cafe-da-manha', kcal: 150 }),
    criarBloco({ id: 'b', nome: 'Arroz', refeicaoId: 'almoco', kcal: 128 }),
    criarBloco({ id: 'c', nome: 'Tofu', refeicaoId: 'jantar', kcal: 76 }),
  ]);
  dieta = substituirAlimentoNaDieta(dieta, 'a', {
    alimento: { id: 'TEST_ONLY_aveia_flocos', nome: 'Aveia em flocos' },
    quantidade: 38.46,
    unidade: 'g',
  });
  dieta = moverBlocoNaDieta(dieta, 'b', 'jantar');

  return {
    versaoDoEsquema: 1,
    dieta,
    configuracoes: { arredondamento: 'multiplo5', modoDemonstracao: true },
    vinculos: [
      {
        textoNormalizado: 'arrozinho',
        textoOriginal: 'Arrozinho',
        alimentoId: 'TEST_ONLY_arroz_branco_cozido',
        criadoEm: '2026-01-01T00:00:00.000Z',
      },
    ],
    atualizadoEm: '2026-01-02T00:00:00.000Z',
  };
}

describe('migração da dieta única para planos', () => {
  it('cria um único plano chamado “Plano principal” e o deixa ativo', () => {
    const resultado = sanearEstado(estadoAntigo());
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    const { valor } = resultado;
    expect(valor.versaoDoEsquema).toBe(VERSAO_DO_ESQUEMA);
    expect(valor.planos).toHaveLength(1);
    expect(valor.planos[0]?.nome).toBe(NOME_DO_PLANO_MIGRADO);
    expect(valor.planoAtivoId).toBe(valor.planos[0]?.id);
  });

  it('preserva todos os itens', () => {
    const resultado = sanearEstado(estadoAntigo());
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    const dieta = resultado.valor.planos[0]?.dietaAtual;
    expect(dieta?.blocos.map((b) => b.id).sort()).toEqual(['a', 'b', 'c']);
    expect(dieta?.refeicoes).toHaveLength(3);
    expect(dieta?.blocos.find((b) => b.id === 'c')?.kcal).toBe(76);
  });

  it('preserva as alterações já feitas (substituições e movimentações)', () => {
    const resultado = sanearEstado(estadoAntigo());
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    const dieta = resultado.valor.planos[0]?.dietaAtual;
    expect(dieta?.blocos.find((b) => b.id === 'a')?.atual.alimentoNome).toBe('Aveia em flocos');
    expect(dieta?.blocos.find((b) => b.id === 'a')?.atual.quantidade).toBe(38.46);
    expect(dieta?.blocos.find((b) => b.id === 'b')?.atual.refeicaoId).toBe('jantar');
  });

  it('mantém a prescrição recuperável na dieta original do plano', () => {
    const resultado = sanearEstado(estadoAntigo());
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    const original = resultado.valor.planos[0]?.dietaOriginal;
    expect(original?.blocos.find((b) => b.id === 'a')?.atual.alimentoNome).toBe('Pão francês');
    expect(original?.blocos.find((b) => b.id === 'b')?.atual.refeicaoId).toBe('almoco');
    // As calorias do bloco são fixas: restaurar não pode alterá-las.
    expect(original?.blocos.find((b) => b.id === 'a')?.kcal).toBe(150);
  });

  it('mantém configurações e vínculos, que são compartilhados', () => {
    const resultado = sanearEstado(estadoAntigo());
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    expect(resultado.valor.configuracoes.arredondamento).toBe('multiplo5');
    expect(resultado.valor.configuracoes.modoDemonstracao).toBe(true);
    expect(resultado.valor.vinculos).toHaveLength(1);
    expect(resultado.valor.vinculos[0]?.alimentoId).toBe('TEST_ONLY_arroz_branco_cozido');
  });

  it('herda a data de importação da dieta antiga', () => {
    const resultado = sanearEstado(estadoAntigo());
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.valor.planos[0]?.importadoEm).toBe('2026-01-01T00:00:00.000Z');
  });

  it('sem dieta guardada, o app começa sem nenhum plano (e não quebra)', () => {
    const resultado = sanearEstado({ versaoDoEsquema: 1, dieta: null });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.valor.planos).toEqual([]);
    expect(resultado.valor.planoAtivoId).toBeNull();
  });

  it('não migra (nem apaga) um estado que já traz a coleção de planos', () => {
    const jaMigrado = sanearEstado(estadoAntigo());
    expect(jaMigrado.ok).toBe(true);
    if (!jaMigrado.ok) return;

    // Mesmo com a versão marcada errada, a coleção existente é respeitada.
    const resultado = sanearEstado(
      JSON.parse(JSON.stringify({ ...jaMigrado.valor, versaoDoEsquema: 1 })),
    );
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.valor.planos).toHaveLength(1);
    expect(resultado.valor.planos[0]?.dietaAtual.blocos).toHaveLength(3);
  });

  it('é idempotente: migrar de novo não muda mais nada', () => {
    const primeira = sanearEstado(estadoAntigo());
    expect(primeira.ok).toBe(true);
    if (!primeira.ok) return;

    const segunda = sanearEstado(JSON.parse(JSON.stringify(primeira.valor)));
    expect(segunda.ok).toBe(true);
    if (!segunda.ok) return;
    expect(segunda.valor.planos).toEqual(primeira.valor.planos);
    expect(segunda.valor.planoAtivoId).toBe(primeira.valor.planoAtivoId);
  });

  it('migra ao reabrir o aplicativo sobre dados gravados pela versão anterior', async () => {
    const armazenamento = new ArmazenamentoEmMemoria();
    await armazenamento.gravar(CHAVE_ESTADO, estadoAntigo());

    const { estado, aviso } = await new RepositorioDeEstado(armazenamento).carregar();

    expect(aviso).toBeNull();
    expect(estado.planos).toHaveLength(1);
    expect(estado.planos[0]?.nome).toBe(NOME_DO_PLANO_MIGRADO);
    expect(estado.planos[0]?.dietaAtual.blocos).toHaveLength(3);
    expect(estado.planoAtivoId).toBe(estado.planos[0]?.id);
  });
});
