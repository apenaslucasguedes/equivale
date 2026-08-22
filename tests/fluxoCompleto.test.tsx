/**
 * Teste de fluxo completo, do jeito que uma pessoa usaria o aplicativo:
 * importar a dieta de demonstração → substituir um alimento → mover o bloco →
 * fechar e reabrir (recuperação do estado) → restaurar a dieta original.
 */

import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App';
import { Loja } from '../src/estado/Loja';
import { ArmazenamentoEmMemoria } from '../src/persistencia/memoria';
import { RepositorioDeEstado } from '../src/persistencia/repositorioDeEstado';
import { planoAtivo } from '../src/domain/planos';
import { criarRepositorioSincrono } from './apoio/fabricas';

function montar(repositorioDeEstado: RepositorioDeEstado) {
  const alimentos = criarRepositorioSincrono();
  return render(
    <Loja repositorioDeEstado={repositorioDeEstado} criarRepositorioDeAlimentos={() => alimentos}>
      <App />
    </Loja>,
  );
}

function refeicao(nome: string) {
  return within(screen.getByRole('region', { name: nome }));
}

describe('fluxo completo', () => {
  it('importa, substitui, move, recarrega e restaura', async () => {
    const usuario = userEvent.setup();
    const armazenamento = new ArmazenamentoEmMemoria();
    const repositorio = new RepositorioDeEstado(armazenamento);

    const tela = montar(repositorio);

    // ---------------------------------------------------- estado vazio
    expect(await screen.findByText('Nenhum plano por aqui ainda')).toBeInTheDocument();
    // O modo de demonstração precisa estar visualmente identificado.
    expect(screen.getByText(/Modo de demonstração/)).toBeInTheDocument();

    // ------------------------------------------------------ importação
    await usuario.click(screen.getByRole('button', { name: /Importar plano \(\.md\)/ }));
    await usuario.click(screen.getByRole('button', { name: 'Usar plano de demonstração' }));

    expect(await screen.findByText('Prévia da importação')).toBeInTheDocument();
    expect(screen.getByText('Refeições').nextElementSibling).toHaveTextContent('6');
    expect(screen.getByText('Itens a conferir').nextElementSibling).toHaveTextContent('0');
    expect(screen.getByText(/Café da manhã — 3 itens/)).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Importar plano' }));

    // ------------------------------------------------- refeições na tela
    expect(await screen.findByRole('region', { name: 'Café da manhã' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Ceia' })).toBeInTheDocument();
    expect(refeicao('Café da manhã').getByText('Pão francês')).toBeInTheDocument();
    // O cartão mostra medida, peso e calorias sem exigir a abertura dos detalhes.
    expect(refeicao('Café da manhã').getByText('1 unidade · 50 g · 150 kcal')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restaurar dieta do dia' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Adicionar alimento' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adicionar alimento ao Café da manhã' })).toBeInTheDocument();
    expect(screen.getByText(/Prescrito.*kcal/)).toBeInTheDocument();

    // -------------------------------------------------- substituição
    await usuario.click(screen.getByRole('button', { name: /^Pão francês, 1 unidade/ }));

    await usuario.click(screen.getByRole('button', { name: 'Todas' }));
    await usuario.type(screen.getByLabelText('Pesquisar alimento'), 'tofu');
    expect(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: /Tofu.*150 kcal.*197 g.*aprox\. 5 fatias/i,
      }),
    ).toBeInTheDocument();
    await usuario.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: /^Tofu/ }),
    );

    // 150 kcal × 100 ÷ 76 kcal/100 g = 197,36… g → 197 g com arredondamento padrão
    expect(await screen.findByText('Confirmar substituição')).toBeInTheDocument();
    expect(screen.getByText(/197,37/)).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Substituir' }));

    const cartaoSubstituido = await screen.findByRole('button', {
      name: /^Tofu, 197 g/,
    });
    expect(cartaoSubstituido).toBeInTheDocument();
    expect(refeicao('Café da manhã').getByText('substituído')).toBeInTheDocument();
    expect(screen.queryByText('Pão francês')).not.toBeInTheDocument();

    // As calorias do bloco não podem ter mudado.
    fireEvent.contextMenu(cartaoSubstituido);
    await usuario.click(screen.getByRole('button', { name: /Ver detalhes/ }));
    const detalhes = within(await screen.findByRole('dialog'));
    expect(detalhes.getByText('150 kcal')).toBeInTheDocument();
    expect(detalhes.getByText('Pão francês')).toBeInTheDocument();
    await usuario.click(detalhes.getByRole('button', { name: 'Fechar' }));

    // ------------------------------------- movimentação pelo botão acessível
    fireEvent.contextMenu(screen.getByRole('button', { name: /^Tofu, 197 g/ }));
    await usuario.click(screen.getByRole('button', { name: /Mover para outra refeição/ }));
    await usuario.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: /^Jantar/ }),
    );

    await waitFor(() => {
      expect(refeicao('Jantar').getByText('Tofu')).toBeInTheDocument();
    });
    expect(refeicao('Café da manhã').queryByText('Tofu')).not.toBeInTheDocument();
    expect(refeicao('Jantar').getByText('movido')).toBeInTheDocument();

    // -------------------------------------- fechar e reabrir o aplicativo
    await waitFor(async () => {
      const { estado } = await repositorio.carregar();
      const dieta = planoAtivo(estado)?.dietaAtual;
      const bloco = dieta?.blocos.find((b) => b.atual.alimentoNome === 'Tofu');
      expect(bloco?.atual.refeicaoId).toBe('jantar');
      // As calorias fixas sobreviveram à substituição e à movimentação.
      expect(bloco?.kcal).toBe(150);
    });

    tela.unmount();
    montar(repositorio);

    expect(await screen.findByRole('region', { name: 'Jantar' })).toBeInTheDocument();
    expect(refeicao('Jantar').getByText('Tofu')).toBeInTheDocument();
    expect(refeicao('Jantar').getByText('197 g · 150 kcal')).toBeInTheDocument();

    // --------------------------------------------- restaurar dieta original
    await usuario.click(screen.getByRole('button', { name: 'Abrir ajustes' }));
    await usuario.click(screen.getByRole('button', { name: /Restaurar dieta original/ }));
    await usuario.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Restaurar' }),
    );
    await usuario.click(screen.getByRole('button', { name: 'Voltar' }));

    expect(await screen.findByRole('region', { name: 'Café da manhã' })).toBeInTheDocument();
    expect(refeicao('Café da manhã').getByText('Pão francês')).toBeInTheDocument();
    expect(refeicao('Café da manhã').getByText('1 unidade · 50 g · 150 kcal')).toBeInTheDocument();
    expect(screen.queryByText('Tofu')).not.toBeInTheDocument();
    expect(screen.queryByText('substituído')).not.toBeInTheDocument();
    expect(screen.queryByText('movido')).not.toBeInTheDocument();
  }, 30000);

  it('restaura um item sozinho sem tocar nos outros', async () => {
    const usuario = userEvent.setup();
    const repositorio = new RepositorioDeEstado(new ArmazenamentoEmMemoria());
    montar(repositorio);

    await usuario.click(await screen.findByRole('button', { name: /Importar plano \(\.md\)/ }));
    await usuario.click(screen.getByRole('button', { name: 'Usar plano de demonstração' }));
    await usuario.click(await screen.findByRole('button', { name: 'Importar plano' }));

    // Move dois itens e restaura apenas um deles.
    fireEvent.contextMenu(await screen.findByRole('button', { name: /^Pão francês/ }));
    await usuario.click(screen.getByRole('button', { name: /Mover para outra refeição/ }));
    await usuario.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: /^Ceia/ }),
    );

    fireEvent.contextMenu(await screen.findByRole('button', { name: /^Mamão papaia/ }));
    await usuario.click(screen.getByRole('button', { name: /Mover para outra refeição/ }));
    await usuario.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: /^Ceia/ }),
    );

    await waitFor(() => {
      expect(refeicao('Ceia').getByText('Pão francês')).toBeInTheDocument();
      expect(refeicao('Ceia').getByText('Mamão papaia')).toBeInTheDocument();
    });

    fireEvent.contextMenu(screen.getByRole('button', { name: /^Pão francês/ }));
    await usuario.click(screen.getByRole('button', { name: /Restaurar item original/ }));

    await waitFor(() => {
      expect(refeicao('Café da manhã').getByText('Pão francês')).toBeInTheDocument();
    });
    expect(refeicao('Ceia').getByText('Mamão papaia')).toBeInTheDocument();
  }, 30000);

  it('apaga todos os dados locais com confirmação', async () => {
    const usuario = userEvent.setup();
    const repositorio = new RepositorioDeEstado(new ArmazenamentoEmMemoria());
    montar(repositorio);

    await usuario.click(await screen.findByRole('button', { name: /Importar plano \(\.md\)/ }));
    await usuario.click(screen.getByRole('button', { name: 'Usar plano de demonstração' }));
    await usuario.click(await screen.findByRole('button', { name: 'Importar plano' }));
    expect(await screen.findByRole('region', { name: 'Almoço' })).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Abrir ajustes' }));
    await usuario.click(screen.getByRole('button', { name: /Apagar todos os dados locais/ }));
    await usuario.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Apagar tudo' }),
    );
    await usuario.click(screen.getByRole('button', { name: 'Voltar' }));

    expect(await screen.findByText('Nenhum plano por aqui ainda')).toBeInTheDocument();
    await waitFor(async () => {
      expect((await repositorio.carregar()).estado.planos).toEqual([]);
    });
  }, 30000);
});
