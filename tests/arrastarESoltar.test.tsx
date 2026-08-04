import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { Loja } from '../src/estado/Loja';
import { ArmazenamentoEmMemoria } from '../src/persistencia/memoria';
import { RepositorioDeEstado } from '../src/persistencia/repositorioDeEstado';
import { criarBloco, criarDieta, criarEstadoComPlanos, criarPlanoDeTeste, criarRepositorioSincrono } from './apoio/fabricas';

function estadoParaArraste() {
  const dieta = criarDieta([
    { ...criarBloco({ id: 'a', nome: 'Arroz', refeicaoId: 'almoco', ordem: 0, kcal: 128 }), observacao: 'sem sal' },
    criarBloco({ id: 'b', nome: 'Feijão', refeicaoId: 'almoco', ordem: 1, kcal: 76 }),
    criarBloco({ id: 'c', nome: 'Salada', refeicaoId: 'almoco', ordem: 2, kcal: 35 }),
    criarBloco({ id: 'd', nome: 'Sopa', refeicaoId: 'jantar', ordem: 0, kcal: 90 }),
  ]);
  return criarEstadoComPlanos([criarPlanoDeTeste({ id: 'plano-a', dieta })]);
}

async function montar() {
  const repositorio = new RepositorioDeEstado(new ArmazenamentoEmMemoria());
  await repositorio.salvar(estadoParaArraste());
  const alimentos = criarRepositorioSincrono();
  const tela = render(
    <Loja repositorioDeEstado={repositorio} criarRepositorioDeAlimentos={() => alimentos}>
      <App />
    </Loja>,
  );
  await screen.findByRole('region', { name: 'Almoço' });
  return { repositorio, tela };
}

function refeicao(nome: string) {
  return within(screen.getByRole('region', { name: nome }));
}

afterEach(() => vi.restoreAllMocks());

describe('arrastar e soltar cartões', () => {
  it('abre a gaveta ao clicar no corpo e não ao clicar no botão de arraste', async () => {
    const usuario = userEvent.setup();
    await montar();

    await usuario.click(screen.getByRole('button', { name: /^Arroz, 50 g/ }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await usuario.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Fechar' }));

    const pegador = screen.getAllByRole('button', { name: 'Arrastar alimento' })[0]!;
    expect(pegador).toHaveAttribute('type', 'button');
    await usuario.click(pegador);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('abre as opções por toque prolongado e não exibe a observação no cartão', async () => {
    const usuario = userEvent.setup();
    await montar();
    const cartao = screen.getByRole('button', { name: /^Arroz, 50 g/ });

    expect(screen.queryByText('obs.')).not.toBeInTheDocument();
    await usuario.pointer([{ keys: '[TouchA>]', target: cartao }]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByRole('dialog', {}, { timeout: 800 })).toBeInTheDocument();
    await usuario.pointer([{ keys: '[/TouchA]', target: cartao }]);
  });

  it('reordena para baixo na mesma refeição por mouse usando apenas o pegador', async () => {
    await montar();
    const almoco = refeicao('Almoço');
    const pegador = almoco.getAllByRole('button', { name: 'Arrastar alimento' })[0]!;
    const salada = almoco.getByText('Salada').closest('article')!;

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const texto = this.textContent ?? '';
      const top = texto.includes('Arroz') ? 100 : texto.includes('Feijão') ? 160 : texto.includes('Salada') ? 220 : 300;
      return { x: 0, y: top, top, left: 0, right: 400, bottom: top + 50, width: 400, height: 50, toJSON: () => ({}) };
    });

    fireEvent.mouseDown(pegador, { button: 0, clientX: 380, clientY: 120 });
    fireEvent.mouseMove(document, { clientX: 380, clientY: 126 });
    fireEvent.mouseMove(document, { clientX: 200, clientY: 240 });
    fireEvent.mouseUp(salada, { clientX: 200, clientY: 240 });

    await waitFor(() => {
      expect(refeicao('Almoço').getAllByRole('article').map((item) => item.textContent)).toEqual([
        expect.stringContaining('Feijão'),
        expect.stringContaining('Salada'),
        expect.stringContaining('Arroz'),
      ]);
    });
  });

  it('move por mouse entre refeições e persiste a refeição e a ordem após recarregar', async () => {
    const { repositorio, tela } = await montar();
    const almoco = refeicao('Almoço');
    const pegador = almoco.getAllByRole('button', { name: 'Arrastar alimento' })[1]!;
    const sopa = refeicao('Jantar').getByText('Sopa').closest('article')!;

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const texto = this.textContent ?? '';
      const destino = this.dataset?.destino;
      if (destino) {
        const top = destino === 'cafe-da-manha' ? 0 : destino === 'almoco' ? 80 : 380;
        const height = destino === 'almoco' ? 210 : 100;
        return { x: 0, y: top, top, left: 0, right: 400, bottom: top + height, width: 400, height, toJSON: () => ({}) };
      }
      const top = texto.includes('Arroz') ? 100 : texto.includes('Feijão') ? 160 : texto.includes('Salada') ? 220 : 400;
      return { x: 0, y: top, top, left: 0, right: 400, bottom: top + 50, width: 400, height: 50, toJSON: () => ({}) };
    });

    fireEvent.mouseDown(pegador, { button: 0, clientX: 380, clientY: 180 });
    fireEvent.mouseMove(document, { clientX: 380, clientY: 186 });
    fireEvent.mouseMove(sopa, { clientX: 200, clientY: 420 });
    fireEvent.mouseUp(sopa, { clientX: 200, clientY: 420 });

    await waitFor(() => expect(refeicao('Jantar').getByText('Feijão')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Desfazer' })).toBeInTheDocument();
    await waitFor(async () => {
      const plano = (await repositorio.carregar()).estado.planos[0]!;
      expect(plano.dietaAtual.blocos.find((item) => item.id === 'b')).toMatchObject({
        kcal: 76,
        ordem: 0,
        atual: { refeicaoId: 'jantar' },
      });
    });

    tela.unmount();
    const alimentos = criarRepositorioSincrono();
    render(
      <Loja repositorioDeEstado={repositorio} criarRepositorioDeAlimentos={() => alimentos}>
        <App />
      </Loja>,
    );
    expect(within(await screen.findByRole('region', { name: 'Jantar' })).getAllByRole('article')[0]).toHaveTextContent('Feijão');
  });

  it('permite pegar e soltar pelo teclado sem abrir a gaveta', async () => {
    const usuario = userEvent.setup();
    await montar();
    const almoco = refeicao('Almoço');
    const pegador = almoco.getAllByRole('button', { name: 'Arrastar alimento' })[0]!;

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const texto = this.textContent ?? '';
      const top = texto.includes('Arroz') ? 100 : texto.includes('Feijão') ? 180 : texto.includes('Salada') ? 260 : 400;
      return { x: 0, y: top, top, left: 0, right: 400, bottom: top + 50, width: 400, height: 50, toJSON: () => ({}) };
    });

    pegador.focus();
    expect(pegador).toHaveFocus();

    await usuario.keyboard(' ');
    await waitFor(() =>
      expect(refeicao('Almoço').getAllByRole('button', { name: 'Arrastar alimento' })[0]).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    const regiaoAoVivo = screen
      .getAllByRole('status')
      .find((elemento) => elemento.id.startsWith('DndLiveRegion-'))!;
    expect(regiaoAoVivo).toHaveTextContent(/draggable item a/i);

    await usuario.keyboard('{ArrowDown}{ArrowDown}');
    await waitFor(() => expect(regiaoAoVivo).toHaveTextContent(/draggable item a was moved over droppable area item:c/i));

    await usuario.keyboard(' ');
    await waitFor(() => {
      expect(refeicao('Almoço').getAllByRole('article').map((item) => item.textContent)).toEqual([
        expect.stringContaining('Feijão'),
        expect.stringContaining('Salada'),
        expect.stringContaining('Arroz'),
      ]);
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(regiaoAoVivo).toHaveTextContent(/draggable item a was dropped/i);
  });
});
