import { describe, expect, it } from 'vitest';
import {
  gerarBackup,
  interpretarBackup,
  nomeDoArquivoDeBackup,
  serializarBackup,
} from '../src/backup/backup';
import { VERSAO_DO_ESQUEMA, estadoInicial } from '../src/domain/types';
import type { EstadoPersistido } from '../src/domain/types';
import { moverBlocoNaDieta, substituirAlimentoNaDieta } from '../src/domain/blocos';
import { criarBloco, criarDieta, criarEstadoComPlanos, criarPlanoDeTeste } from './apoio/fabricas';

function dietaComAlteracoes() {
  let dieta = criarDieta([
    criarBloco({ id: 'a', nome: 'Pão francês', refeicaoId: 'cafe-da-manha', kcal: 150 }),
    criarBloco({ id: 'b', nome: 'Arroz', refeicaoId: 'almoco', kcal: 128 }),
  ]);
  dieta = substituirAlimentoNaDieta(dieta, 'a', {
    alimento: { id: 'TEST_ONLY_aveia_flocos', nome: 'Aveia em flocos' },
    quantidade: 38.46153846,
    unidade: 'g',
  });
  return moverBlocoNaDieta(dieta, 'b', 'jantar');
}

function estadoComAlteracoes(): EstadoPersistido {
  return {
    ...criarEstadoComPlanos([
      criarPlanoDeTeste({ id: 'plano_1', nome: 'Dieta de teste', dieta: dietaComAlteracoes() }),
    ]),
    vinculos: [
      {
        textoNormalizado: 'arrozinho',
        textoOriginal: 'Arrozinho',
        alimentoId: 'TEST_ONLY_arroz_branco_cozido',
        criadoEm: '2026-01-01T00:00:00.000Z',
      },
    ],
    configuracoes: { arredondamento: 'multiplo5' as const, modoDemonstracao: true },
  };
}

/** Dois planos independentes, cada um com as suas próprias alterações. */
function estadoComDoisPlanos(): EstadoPersistido {
  const fimDeSemana = criarDieta([
    criarBloco({ id: 'c', nome: 'Tapioca', refeicaoId: 'cafe-da-manha', kcal: 200 }),
  ]);
  return {
    ...estadoComAlteracoes(),
    planos: [
      criarPlanoDeTeste({ id: 'dias-uteis', nome: 'Dias úteis', dieta: dietaComAlteracoes() }),
      criarPlanoDeTeste({
        id: 'fim-de-semana',
        nome: 'Fim de semana',
        diasSugeridos: ['sabado', 'domingo'],
        dieta: fimDeSemana,
      }),
    ],
    planoAtivoId: 'fim-de-semana',
  };
}

describe('exportação', () => {
  it('inclui versão do esquema, todos os planos, o plano ativo, vínculos e configurações', () => {
    const backup = gerarBackup(estadoComDoisPlanos());

    expect(backup.aplicativo).toBe('equivale');
    expect(backup.versaoDoEsquema).toBe(VERSAO_DO_ESQUEMA);
    expect(backup.planos).toHaveLength(2);
    expect(backup.planos.map((p) => p.nome)).toEqual(['Dias úteis', 'Fim de semana']);
    expect(backup.planoAtivoId).toBe('fim-de-semana');
    expect(backup.vinculos).toHaveLength(1);
    expect(backup.configuracoes.arredondamento).toBe('multiplo5');
  });

  it('cada plano leva a sua dieta original com as alterações desfeitas', () => {
    const backup = gerarBackup(estadoComAlteracoes());
    const plano = backup.planos[0];
    const originalA = plano?.dietaOriginal.blocos.find((b) => b.id === 'a');
    const atualA = plano?.dietaAtual.blocos.find((b) => b.id === 'a');

    expect(originalA?.atual.alimentoNome).toBe('Pão francês');
    expect(atualA?.atual.alimentoNome).toBe('Aveia em flocos');
    expect(originalA?.kcal).toBe(atualA?.kcal);
  });

  it('guarda os dias sugeridos de cada plano', () => {
    const backup = gerarBackup(estadoComDoisPlanos());
    expect(backup.planos[1]?.diasSugeridos).toEqual(['domingo', 'sabado']);
  });

  it('gera JSON válido e nome de arquivo utilizável', () => {
    const estado = estadoComAlteracoes();
    expect(() => JSON.parse(serializarBackup(estado))).not.toThrow();
    expect(nomeDoArquivoDeBackup(estado)).toMatch(
      /^equivale-backup-dieta-de-teste-\d{4}-\d{2}-\d{2}\.json$/,
    );
  });

  it('com vários planos o nome do arquivo indica a coleção', () => {
    expect(nomeDoArquivoDeBackup(estadoComDoisPlanos())).toMatch(
      /^equivale-backup-planos-\d{4}-\d{2}-\d{2}\.json$/,
    );
  });

  it('funciona sem nenhum plano importado', () => {
    const backup = gerarBackup(estadoInicial());
    expect(backup.planos).toEqual([]);
    expect(backup.planoAtivoId).toBeNull();
  });
});

describe('restauração', () => {
  it('faz a volta completa preservando o estado atual', () => {
    const resultado = interpretarBackup(serializarBackup(estadoComAlteracoes()));

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    const dieta = resultado.valor.estado.planos[0]?.dietaAtual;
    expect(dieta?.blocos.find((b) => b.id === 'a')?.atual.alimentoNome).toBe('Aveia em flocos');
    expect(dieta?.blocos.find((b) => b.id === 'b')?.atual.refeicaoId).toBe('jantar');
    expect(dieta?.blocos.find((b) => b.id === 'a')?.original.alimentoNome).toBe('Pão francês');
    expect(resultado.valor.estado.configuracoes.arredondamento).toBe('multiplo5');
    expect(resultado.valor.estado.vinculos).toHaveLength(1);
  });

  it('preserva os vários planos e qual estava ativo', () => {
    const resultado = interpretarBackup(serializarBackup(estadoComDoisPlanos()));
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    const { estado } = resultado.valor;
    expect(estado.planos.map((p) => p.id)).toEqual(['dias-uteis', 'fim-de-semana']);
    expect(estado.planoAtivoId).toBe('fim-de-semana');
    // Os planos continuam independentes: cada um com os próprios itens.
    expect(estado.planos[0]?.dietaAtual.blocos).toHaveLength(2);
    expect(estado.planos[1]?.dietaAtual.blocos).toHaveLength(1);
  });

  it('a prévia descreve o conteúdo do arquivo, plano a plano', () => {
    const resultado = interpretarBackup(serializarBackup(estadoComDoisPlanos()));
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    expect(resultado.valor.previa).toMatchObject({
      quantidadeDePlanos: 2,
      planoAtivo: 'Fim de semana',
      quantidadeDeBlocos: 3,
      quantidadeDeAlteracoes: 2,
      quantidadeDeVinculos: 1,
      versaoMigrada: false,
    });
    expect(resultado.valor.previa.planos[0]).toMatchObject({
      nome: 'Dias úteis',
      quantidadeDeBlocos: 2,
      quantidadeDeAlteracoes: 2,
      ativo: false,
    });
    expect(resultado.valor.previa.planos[1]?.ativo).toBe(true);
  });

  it('rejeita JSON inválido', () => {
    const resultado = interpretarBackup('{ isto não é json');
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.erro).toContain('não é um JSON válido');
  });

  it('rejeita JSON que não é objeto', () => {
    expect(interpretarBackup('[1,2,3]').ok).toBe(false);
    expect(interpretarBackup('"texto"').ok).toBe(false);
  });

  it('rejeita arquivo sem estrutura de backup', () => {
    const resultado = interpretarBackup(JSON.stringify({ qualquer: 'coisa' }));
    expect(resultado.ok).toBe(false);
  });

  it('avisa quando o arquivo não se identifica como Equivale, mas tenta ler', () => {
    const backup = gerarBackup(estadoComAlteracoes());
    const resultado = interpretarBackup(
      JSON.stringify({ ...backup, aplicativo: 'outro-aplicativo' }),
    );
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.valor.avisos.some((a) => a.includes('não se identifica'))).toBe(true);
  });

  it('avisa e migra backup de esquema mais novo', () => {
    const backup = gerarBackup(estadoComAlteracoes());
    const resultado = interpretarBackup(JSON.stringify({ ...backup, versaoDoEsquema: 99 }));
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.valor.avisos.some((a) => a.includes('versão mais nova'))).toBe(true);
    expect(resultado.valor.previa.versaoMigrada).toBe(true);
    expect(resultado.valor.estado.versaoDoEsquema).toBe(VERSAO_DO_ESQUEMA);
  });

  it('avisa quando o backup não tem nenhum plano', () => {
    const resultado = interpretarBackup(serializarBackup(estadoInicial()));
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.valor.avisos.some((a) => a.includes('não contém nenhum plano'))).toBe(true);
  });

  it('recusa planos corrompidos em vez de importar pela metade', () => {
    const backup = gerarBackup(estadoComAlteracoes());
    const resultado = interpretarBackup(
      JSON.stringify({ ...backup, planos: [{ id: 'x', nome: 'X', dietaAtual: { refeicoes: [] } }] }),
    );
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.erro).toContain('incompletos ou corrompidos');
  });
});

describe('compatibilidade com backups do esquema 1 (dieta única)', () => {
  /** Formato exportado pela versão anterior do Equivale. */
  function backupAntigo(dieta: unknown, dietaOriginal: unknown = dieta) {
    return JSON.stringify({
      aplicativo: 'equivale',
      versaoDoEsquema: 1,
      geradoEm: '2026-01-01T00:00:00.000Z',
      dietaOriginal,
      estadoAtual: { dieta },
      vinculos: [],
      configuracoes: { arredondamento: 'multiplo5', modoDemonstracao: false },
    });
  }

  it('transforma a dieta única num plano, preservando itens e alterações', () => {
    const resultado = interpretarBackup(backupAntigo(dietaComAlteracoes()));
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    const { estado } = resultado.valor;
    expect(estado.planos).toHaveLength(1);
    expect(estado.planos[0]?.nome).toBe('Plano principal');
    expect(estado.planoAtivoId).toBe(estado.planos[0]?.id);

    const dieta = estado.planos[0]?.dietaAtual;
    expect(dieta?.blocos).toHaveLength(2);
    expect(dieta?.blocos.find((b) => b.id === 'a')?.atual.alimentoNome).toBe('Aveia em flocos');
    expect(dieta?.blocos.find((b) => b.id === 'b')?.atual.refeicaoId).toBe('jantar');
    // A prescrição continua recuperável.
    expect(estado.planos[0]?.dietaOriginal.blocos.find((b) => b.id === 'a')?.atual.alimentoNome).toBe(
      'Pão francês',
    );
    expect(estado.configuracoes.arredondamento).toBe('multiplo5');
  });

  it('avisa que o arquivo está no formato antigo', () => {
    const resultado = interpretarBackup(backupAntigo(criarDieta()));
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.valor.avisos.some((a) => a.includes('formato antigo'))).toBe(true);
  });

  it('recorre à dieta original quando o estado atual está ausente', () => {
    const resultado = interpretarBackup(
      JSON.stringify({
        aplicativo: 'equivale',
        versaoDoEsquema: 1,
        geradoEm: '2026-01-01T00:00:00.000Z',
        dietaOriginal: criarDieta(),
      }),
    );
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.valor.estado.planos[0]?.dietaAtual.blocos[0]?.atual.alimentoNome).toBe(
      'Pão francês',
    );
  });

  it('recusa dieta antiga corrompida em vez de importar pela metade', () => {
    const resultado = interpretarBackup(backupAntigo({ titulo: 'X', refeicoes: [] }));
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.erro).toContain('incompletos ou corrompidos');
  });
});
