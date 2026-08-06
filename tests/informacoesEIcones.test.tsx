import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { BlocoDeRefeicao } from '../src/ui/BlocoDeRefeicao';
import { SeletorDeAlimento } from '../src/ui/SeletorDeAlimento';
import { CONFIGURACOES_PADRAO } from '../src/domain/types';
import { criarBloco, criarRepositorioSincrono } from './apoio/fabricas';
import { iconeDoAlimento } from '../src/ui/iconeDoAlimento';

describe('informações e ícones dos alimentos', () => {
  it.each([
    'Tomate, purê',
    'Tomate, salada',
    'Tomate, extrato',
    'Tomate, com semente, cru',
    'Tomate, molho industrializado',
  ])('usa o emoji de tomate em todas as apresentações: %s', (nome) => {
    expect(iconeDoAlimento(nome, 'hortalicas')).toBe('🍅');
  });

  it('mostra medida, peso e calorias no cartão sem ícone no título da refeição', () => {
    const bloco = criarBloco({ quantidade: 1, unidade: 'unidade', kcal: 150 });
    bloco.original.pesoGramas = 50;
    bloco.atual.pesoGramas = 50;

    render(
      <DndContext>
        <BlocoDeRefeicao
          refeicao={{ id: 'cafe-da-manha', nome: 'Café da manhã', ordem: 0 }}
          blocos={[bloco]}
          configuracoes={CONFIGURACOES_PADRAO}
          aoAbrirItem={vi.fn()}
          aoAbrirAcoesDoItem={vi.fn()}
          arrastando={false}
        />
      </DndContext>,
    );

    expect(screen.getByRole('heading', { name: 'Café da manhã' })).toHaveTextContent(/^Café da manhã$/);
    expect(screen.getByText('1 unidade · 50 g · 150 kcal')).toBeInTheDocument();
  });

  it('usa o emoji específico de cada alimento na lista de substituição', () => {
    render(
      <SeletorDeAlimento
        repositorio={criarRepositorioSincrono()}
        categoriaInicial="frutas"
        aoEscolher={vi.fn()}
      />,
    );

    const banana = screen.getByRole('button', { name: /Banana prata/i });
    const mamao = screen.getByRole('button', { name: /Mamão papaia/i });
    expect(within(banana).getByText('🍌', { exact: false })).toBeInTheDocument();
    expect(within(mamao).getByText('🍈', { exact: false })).toBeInTheDocument();
  });

  it('mostra “à vontade” sem exibir zero calorias', () => {
    const bloco = criarBloco({ nome: 'Tomate', quantidade: 0, unidade: 'à vontade', kcal: 0 });
    bloco.livre = true;
    bloco.origemDasCalorias = 'livre';

    render(
      <DndContext>
        <BlocoDeRefeicao
          refeicao={{ id: 'cafe-da-manha', nome: 'Café da manhã', ordem: 0 }}
          blocos={[bloco]}
          configuracoes={CONFIGURACOES_PADRAO}
          aoAbrirItem={vi.fn()}
          aoAbrirAcoesDoItem={vi.fn()}
          arrastando={false}
        />
      </DndContext>,
    );

    expect(screen.getByText('à vontade')).toBeInTheDocument();
    expect(screen.queryByText(/0 kcal/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Alimento não encontrado/)).not.toBeInTheDocument();
  });
});
