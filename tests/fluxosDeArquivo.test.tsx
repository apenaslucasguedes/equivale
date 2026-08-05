/**
 * Fluxos que envolvem arquivos: baixar modelo, importar Markdown, conferir
 * itens não reconhecidos, exportar backup e restaurar backup.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App';
import { Loja } from '../src/estado/Loja';
import { ArmazenamentoEmMemoria } from '../src/persistencia/memoria';
import { RepositorioDeEstado } from '../src/persistencia/repositorioDeEstado';
import { criarRepositorioSincrono } from './apoio/fabricas';

interface DownloadCapturado {
  nome: string;
  conteudo: Promise<string>;
}

/** O Blob do jsdom não tem `.text()`; lemos com FileReader. */
function lerBlob(blob: Blob): Promise<string> {
  return new Promise((resolver, rejeitar) => {
    const leitor = new FileReader();
    leitor.onload = () => resolver(String(leitor.result ?? ''));
    leitor.onerror = () => rejeitar(leitor.error);
    leitor.readAsText(blob, 'utf-8');
  });
}

const downloads: DownloadCapturado[] = [];
let cliqueOriginal: () => void;

beforeEach(() => {
  downloads.length = 0;
  const blobs = new Map<string, Blob>();

  URL.createObjectURL = vi.fn((blob: Blob) => {
    const url = `blob:teste/${blobs.size}`;
    blobs.set(url, blob);
    return url;
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn();

  cliqueOriginal = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function capturar(this: HTMLAnchorElement) {
    const blob = blobs.get(this.href);
    if (blob) downloads.push({ nome: this.download, conteudo: lerBlob(blob) });
  };
});

afterEach(() => {
  HTMLAnchorElement.prototype.click = cliqueOriginal;
});

function montar(repositorio: RepositorioDeEstado) {
  const alimentos = criarRepositorioSincrono();
  return render(
    <Loja repositorioDeEstado={repositorio} criarRepositorioDeAlimentos={() => alimentos}>
      <App />
    </Loja>,
  );
}

const DIETA_MD = `# Dieta: Plano importado

## Café da manhã

- Pão francês | 1 unidade | peso 50 g | 150 kcal
- Suco especial da casa | 200 ml

## Almoço

- Arroz branco cozido | 100 g | 128 kcal
`;

describe('baixar modelo', () => {
  it('gera um arquivo Markdown válido a partir do estado vazio', async () => {
    const usuario = userEvent.setup();
    montar(new RepositorioDeEstado(new ArmazenamentoEmMemoria()));

    await usuario.click(await screen.findByRole('button', { name: 'Baixar modelo' }));

    expect(downloads).toHaveLength(1);
    expect(downloads[0]?.nome).toBe('modelo-dieta-equivale.md');
    const conteudo = await downloads[0]!.conteudo;
    expect(conteudo).toContain('# Dieta: Nome do plano');
    expect(conteudo).toContain('## Café da manhã');
    // O modelo precisa ensinar o front matter dos planos.
    expect(conteudo).toContain('equivaleVersion: 1');
    expect(conteudo).toContain('planId: plano-principal');
    expect(conteudo).toContain('planName: Nome do plano');
    expect(conteudo).toContain('suggestedDays: seg, ter, qua, qui, sex');
    expect(conteudo).toContain('CATÁLOGO EXATO PARA A IA');
    expect(conteudo).toContain('TEST_ONLY_arroz_branco_cozido | Arroz branco cozido');
  });
});

describe('importar arquivo .md', () => {
  it('mostra prévia com avisos, conferência e importa sem descartar o item pendente', async () => {
    const usuario = userEvent.setup();
    montar(new RepositorioDeEstado(new ArmazenamentoEmMemoria()));

    await usuario.click(await screen.findByRole('button', { name: /Importar plano \(\.md\)/ }));

    const arquivo = new File([DIETA_MD], 'dieta.md', { type: 'text/markdown' });
    await usuario.upload(screen.getByLabelText('Arquivo Markdown da dieta'), arquivo);

    expect(await screen.findByText('Prévia da importação')).toBeInTheDocument();
    expect(screen.getByText('Itens reconhecidos').nextElementSibling).toHaveTextContent('2');
    expect(screen.getByText('Itens a conferir').nextElementSibling).toHaveTextContent('1');

    // Etapa de conferência: o item sem correspondência aparece para vinculação.
    await usuario.click(screen.getByRole('button', { name: 'Conferir 1 item' }));
    expect(await screen.findByText('Conferir itens')).toBeInTheDocument();
    expect(screen.getByText(/Suco especial da casa/)).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Vincular ou informar calorias' }));
    const gaveta = within(await screen.findByRole('dialog'));
    await usuario.type(gaveta.getByLabelText('Calorias (kcal)'), '90');
    await usuario.click(gaveta.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(screen.getByText('Todos os itens estão resolvidos.')).toBeInTheDocument();
    });

    await usuario.click(screen.getByRole('button', { name: 'Voltar para a prévia' }));
    await usuario.click(await screen.findByRole('button', { name: 'Importar plano' }));

    expect(await screen.findByRole('region', { name: 'Café da manhã' })).toBeInTheDocument();
    expect(screen.getByText('Suco especial da casa')).toBeInTheDocument();
    expect(screen.queryByText('a conferir')).not.toBeInTheDocument();
  }, 30000);

  it('recusa arquivo que não é Markdown', async () => {
    // `applyAccept: false` deixa o teste entregar um arquivo que o seletor do
    // navegador filtraria, para exercitar a validação da própria aplicação.
    const usuario = userEvent.setup({ applyAccept: false });
    montar(new RepositorioDeEstado(new ArmazenamentoEmMemoria()));

    await usuario.click(await screen.findByRole('button', { name: /Importar plano \(\.md\)/ }));
    await usuario.upload(
      screen.getByLabelText('Arquivo Markdown da dieta'),
      new File(['{}'], 'coisa.json', { type: 'application/json' }),
    );

    expect(await screen.findByText(/Escolha um arquivo Markdown/)).toBeInTheDocument();
  });

  it('permite vincular o item pendente depois, pelo próprio cartão', async () => {
    const usuario = userEvent.setup();
    montar(new RepositorioDeEstado(new ArmazenamentoEmMemoria()));

    await usuario.click(await screen.findByRole('button', { name: /Importar plano \(\.md\)/ }));
    await usuario.upload(
      screen.getByLabelText('Arquivo Markdown da dieta'),
      new File([DIETA_MD], 'dieta.md', { type: 'text/markdown' }),
    );
    await usuario.click(await screen.findByRole('button', { name: 'Importar plano' }));

    const avisoDePendencias = await screen.findByText(/1 item ficou a conferir/);
    expect(avisoDePendencias).toBeInTheDocument();
    expect(avisoDePendencias.closest('.faixa')).toHaveClass('faixa--pendencias');

    await usuario.click(screen.getByRole('button', { name: /^Suco especial da casa/ }));

    const gaveta = within(await screen.findByRole('dialog'));
    await usuario.type(gaveta.getByLabelText('Calorias prescritas (kcal)'), '90');
    await usuario.click(gaveta.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(screen.queryByText(/ficou a conferir/)).not.toBeInTheDocument();
    });
    expect(screen.queryByText('a conferir')).not.toBeInTheDocument();
  }, 30000);
});

describe('backup', () => {
  it('exporta e restaura o estado, com prévia antes de aplicar', async () => {
    const usuario = userEvent.setup();
    montar(new RepositorioDeEstado(new ArmazenamentoEmMemoria()));

    // Importa e faz uma movimentação para o backup ter conteúdo.
    await usuario.click(await screen.findByRole('button', { name: /Importar plano \(\.md\)/ }));
    await usuario.click(screen.getByRole('button', { name: 'Usar plano de demonstração' }));
    await usuario.click(await screen.findByRole('button', { name: 'Importar plano' }));

    fireEvent.contextMenu(await screen.findByRole('button', { name: /^Pão francês/ }));
    await usuario.click(screen.getByRole('button', { name: /Mover para outra refeição/ }));
    await usuario.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: /^Ceia/ }),
    );
    await waitFor(() => {
      expect(
        within(screen.getByRole('region', { name: 'Ceia' })).getByText('Pão francês'),
      ).toBeInTheDocument();
    });

    // Exporta.
    await usuario.click(screen.getByRole('button', { name: 'Abrir ajustes' }));
    await usuario.click(screen.getByRole('button', { name: /Exportar backup/ }));

    expect(downloads).toHaveLength(1);
    expect(downloads[0]?.nome).toMatch(/^equivale-backup-.*\.json$/);
    const json = await downloads[0]!.conteudo;
    const backup = JSON.parse(json);
    expect(backup.aplicativo).toBe('equivale');
    expect(backup.planos).toHaveLength(1);
    expect(backup.planoAtivoId).toBe(backup.planos[0].id);
    expect(backup.planos[0].dietaOriginal).not.toBeNull();
    expect(backup.planos[0].dietaAtual).not.toBeNull();

    // Apaga tudo e restaura a partir do arquivo exportado.
    await usuario.click(screen.getByRole('button', { name: /Apagar todos os dados locais/ }));
    await usuario.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Apagar tudo' }),
    );

    await usuario.upload(
      screen.getByLabelText('Arquivo de backup JSON'),
      new File([json], 'backup.json', { type: 'application/json' }),
    );

    const previa = within(await screen.findByRole('dialog'));
    expect(previa.getByText('Alterações').nextElementSibling).toHaveTextContent('1');
    await usuario.click(previa.getByRole('button', { name: 'Restaurar' }));

    await usuario.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(
      within(await screen.findByRole('region', { name: 'Ceia' })).getByText('Pão francês'),
    ).toBeInTheDocument();
  }, 40000);

  it('mostra erro para arquivo de backup inválido', async () => {
    const usuario = userEvent.setup();
    montar(new RepositorioDeEstado(new ArmazenamentoEmMemoria()));

    await usuario.click(await screen.findByRole('button', { name: 'Abrir ajustes' }));
    await usuario.upload(
      screen.getByLabelText('Arquivo de backup JSON'),
      new File(['isto não é json'], 'ruim.json', { type: 'application/json' }),
    );

    expect(await screen.findByText(/não é um JSON válido/)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('arredondamento', () => {
  it('muda a exibição das quantidades sem alterar o cálculo', async () => {
    const usuario = userEvent.setup();
    montar(new RepositorioDeEstado(new ArmazenamentoEmMemoria()));

    await usuario.click(await screen.findByRole('button', { name: /Importar plano \(\.md\)/ }));
    await usuario.click(screen.getByRole('button', { name: 'Usar plano de demonstração' }));
    await usuario.click(await screen.findByRole('button', { name: 'Importar plano' }));

    // Substitui por tofu: 150 kcal × 100 ÷ 76 = 197,368… g
    await usuario.click(await screen.findByRole('button', { name: /^Pão francês/ }));
    await usuario.click(screen.getByRole('button', { name: 'Todas' }));
    await usuario.type(screen.getByLabelText('Pesquisar alimento'), 'tofu');
    await usuario.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^Tofu/ }));
    await usuario.click(screen.getByRole('button', { name: 'Substituir' }));

    expect(await screen.findByRole('button', { name: /^Tofu, 197 g/ })).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Abrir ajustes' }));
    await usuario.click(screen.getByRole('button', { name: /Múltiplos de 5 g/ }));
    await usuario.click(screen.getByRole('button', { name: 'Voltar' }));

    expect(await screen.findByRole('button', { name: /^Tofu, 195 g/ })).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Abrir ajustes' }));
    await usuario.click(screen.getByRole('button', { name: /Valor exato/ }));
    await usuario.click(screen.getByRole('button', { name: 'Voltar' }));

    expect(await screen.findByRole('button', { name: /^Tofu, 197,37 g/ })).toBeInTheDocument();
  }, 40000);
});
