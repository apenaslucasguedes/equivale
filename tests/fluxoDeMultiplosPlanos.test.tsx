/**
 * Fluxo de vários planos, do jeito que uma pessoa usaria:
 * importar “Dias úteis” → importar “Fim de semana” como plano NOVO → alternar
 * pelo seletor do cabeçalho → renomear → reimportar substituindo só um plano →
 * excluir um plano sem perder o outro.
 */

import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App';
import { Loja } from '../src/estado/Loja';
import { ArmazenamentoEmMemoria } from '../src/persistencia/memoria';
import { RepositorioDeEstado } from '../src/persistencia/repositorioDeEstado';
import { criarRepositorioSincrono } from './apoio/fabricas';

function montar(repositorio: RepositorioDeEstado) {
  const alimentos = criarRepositorioSincrono();
  return render(
    <Loja repositorioDeEstado={repositorio} criarRepositorioDeAlimentos={() => alimentos}>
      <App />
    </Loja>,
  );
}

const DIAS_UTEIS = `---
equivaleVersion: 1
planId: dias-uteis
planName: Dias úteis
suggestedDays: seg, ter, qua, qui, sex
---

## Café da manhã

- Pão francês | 1 unidade | peso 50 g | 150 kcal

## Almoço

- Arroz branco cozido | 100 g | 128 kcal
`;

const FIM_DE_SEMANA = `---
equivaleVersion: 1
planId: fim-de-semana
planName: Fim de semana
suggestedDays: sáb, dom
---

## Café da manhã

- Tapioca | 1 unidade | peso 60 g | 200 kcal
`;

/** Mesmo planId de DIAS_UTEIS: é o único que pode ser substituído. */
const DIAS_UTEIS_REVISADO = `---
equivaleVersion: 1
planId: dias-uteis
planName: Dias úteis (revisado)
suggestedDays: seg, ter, qua, qui, sex
---

## Café da manhã

- Cuscuz | 100 g | 113 kcal
`;

async function importar(
  usuario: ReturnType<typeof userEvent.setup>,
  markdown: string,
  acao: 'novo' | RegExp,
) {
  await usuario.click(
    await screen.findByRole('button', { name: /Importar (plano \(\.md\)|outro plano)/ }),
  );
  await usuario.upload(
    screen.getByLabelText('Arquivo Markdown da dieta'),
    new File([markdown], 'plano.md', { type: 'text/markdown' }),
  );
  expect(await screen.findByText('Prévia da importação')).toBeInTheDocument();

  if (acao === 'novo') {
    await usuario.click(
      screen.getByRole('button', { name: /^(Importar plano|Adicionar como novo plano)$/ }),
    );
    return;
  }

  await usuario.click(screen.getByRole('button', { name: acao }));
  await usuario.click(
    within(await screen.findByRole('dialog')).getByRole('button', {
      name: 'Substituir este plano',
    }),
  );
}

function guiaDoPlano(nome: string) {
  return screen.getByRole('tab', { name: nome });
}

describe('vários planos', () => {
  it('mostra os planos como guias sem repetir os dias sugeridos', async () => {
    const usuario = userEvent.setup();
    const repositorio = new RepositorioDeEstado(new ArmazenamentoEmMemoria());
    montar(repositorio);

    await importar(usuario, DIAS_UTEIS, 'novo');
    await importar(usuario, FIM_DE_SEMANA, 'novo');

    const guias = within(
      screen.getByRole('tablist', { name: 'Planos alimentares' }),
    ).getAllByRole('tab');
    expect(guias.map((guia) => guia.textContent)).toEqual(['Dias úteis', 'Fim de semana']);
    expect(screen.getByRole('navigation', { name: 'Escolher plano' }).closest('header')).toBeNull();
    expect(screen.queryByText(/Dias sugeridos:/)).not.toBeInTheDocument();
  });
  it('mantém dois planos independentes e alterna entre eles pelo cabeçalho', async () => {
    const usuario = userEvent.setup();
    montar(new RepositorioDeEstado(new ArmazenamentoEmMemoria()));

    await importar(usuario, DIAS_UTEIS, 'novo');
    expect(await screen.findByRole('region', { name: 'Almoço' })).toBeInTheDocument();
    expect(screen.getByText('Pão francês')).toBeInTheDocument();
    expect(guiaDoPlano('Dias úteis')).toHaveAttribute('aria-selected', 'true');

    await importar(usuario, FIM_DE_SEMANA, 'novo');

    // O plano recém-importado passa a ser o ativo.
    expect(await screen.findByText('Tapioca')).toBeInTheDocument();
    expect(screen.queryByText('Pão francês')).not.toBeInTheDocument();

    // Os dois planos aparecem como guias, com os dias sugeridos como legenda.
    expect(guiaDoPlano('Dias úteis')).toHaveAttribute('aria-selected', 'false');
    expect(guiaDoPlano('Fim de semana')).toHaveAttribute('aria-selected', 'true');

    // Voltar manualmente para o outro plano traz os itens dele de volta.
    await usuario.click(guiaDoPlano('Dias úteis'));
    expect(await screen.findByText('Pão francês')).toBeInTheDocument();
    expect(screen.queryByText('Tapioca')).not.toBeInTheDocument();
  }, 40000);

  it('uma substituição feita num plano não vaza para o outro', async () => {
    const usuario = userEvent.setup();
    montar(new RepositorioDeEstado(new ArmazenamentoEmMemoria()));

    await importar(usuario, DIAS_UTEIS, 'novo');
    await importar(usuario, FIM_DE_SEMANA, 'novo');

    // No plano do fim de semana, move a tapioca para o jantar.
    await usuario.click(await screen.findByRole('button', { name: /^Tapioca/ }));
    await usuario.click(screen.getByRole('button', { name: /Mover para outra refeição/ }));
    await usuario.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: /^Café da manhã/ }),
    );

    await usuario.click(guiaDoPlano('Dias úteis'));

    // O plano dos dias úteis continua exatamente como foi importado.
    expect(await screen.findByText('Pão francês')).toBeInTheDocument();
    expect(screen.queryByText('movido')).not.toBeInTheDocument();
  }, 40000);

  it('só oferece substituir o plano de mesmo planId, e a troca não afeta os outros', async () => {
    const usuario = userEvent.setup();
    montar(new RepositorioDeEstado(new ArmazenamentoEmMemoria()));

    await importar(usuario, DIAS_UTEIS, 'novo');
    await importar(usuario, FIM_DE_SEMANA, 'novo');
    await importar(usuario, DIAS_UTEIS_REVISADO, /^Substituir o plano/);

    expect(await screen.findByText('Cuscuz')).toBeInTheDocument();

    expect(screen.getAllByRole('tab').map((guia) => guia.textContent)).toEqual([
      'Dias úteis (revisado)',
      'Fim de semana',
    ]);

    // O outro plano ficou intacto.
    await usuario.click(guiaDoPlano('Fim de semana'));
    expect(await screen.findByText('Tapioca')).toBeInTheDocument();
  }, 40000);

  it('um arquivo com planId conhecido também pode virar um plano separado', async () => {
    const usuario = userEvent.setup();
    montar(new RepositorioDeEstado(new ArmazenamentoEmMemoria()));

    await importar(usuario, DIAS_UTEIS, 'novo');
    await importar(usuario, DIAS_UTEIS_REVISADO, 'novo');

    // Nada foi substituído: agora são dois planos.
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(await screen.findByText('Cuscuz')).toBeInTheDocument();
  }, 40000);

  it('renomeia e exclui um plano sem apagar os demais', async () => {
    const usuario = userEvent.setup();
    montar(new RepositorioDeEstado(new ArmazenamentoEmMemoria()));

    await importar(usuario, DIAS_UTEIS, 'novo');
    await importar(usuario, FIM_DE_SEMANA, 'novo');

    await usuario.click(screen.getByRole('button', { name: 'Abrir ajustes' }));
    expect(await screen.findByText('Planos alimentares (2)')).toBeInTheDocument();

    // Renomear.
    await usuario.click(screen.getAllByRole('button', { name: 'Renomear' })[0] as HTMLElement);
    const gaveta = within(await screen.findByRole('dialog'));
    await usuario.clear(gaveta.getByLabelText('Nome do plano'));
    await usuario.type(gaveta.getByLabelText('Nome do plano'), 'Semana');
    await usuario.click(gaveta.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(screen.getByText(/Plano renomeado para/)).toBeInTheDocument();
    });

    // Excluir o primeiro plano.
    await usuario.click(screen.getAllByRole('button', { name: 'Excluir' })[0] as HTMLElement);
    await usuario.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Excluir plano' }),
    );

    expect(await screen.findByText('Planos alimentares (1)')).toBeInTheDocument();
    expect(screen.queryByText('Semana')).not.toBeInTheDocument();

    // O plano restante continua completo.
    await usuario.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(await screen.findByText('Tapioca')).toBeInTheDocument();
  }, 40000);

  it('restaurar a dieta original desfaz só o plano ativo', async () => {
    const usuario = userEvent.setup();
    montar(new RepositorioDeEstado(new ArmazenamentoEmMemoria()));

    await importar(usuario, DIAS_UTEIS, 'novo');

    await usuario.click(await screen.findByRole('button', { name: /^Pão francês/ }));
    await usuario.click(screen.getByRole('button', { name: /Mover para outra refeição/ }));
    await usuario.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: /^Almoço/ }),
    );
    await waitFor(() => {
      expect(
        within(screen.getByRole('region', { name: 'Almoço' })).getByText('Pão francês'),
      ).toBeInTheDocument();
    });

    await importar(usuario, FIM_DE_SEMANA, 'novo');
    await usuario.click(guiaDoPlano('Dias úteis'));

    await usuario.click(screen.getByRole('button', { name: 'Abrir ajustes' }));
    await usuario.click(await screen.findByRole('button', { name: /Restaurar dieta original/ }));
    await usuario.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Restaurar' }),
    );
    await usuario.click(screen.getByRole('button', { name: 'Voltar' }));

    expect(
      within(await screen.findByRole('region', { name: 'Café da manhã' })).getByText('Pão francês'),
    ).toBeInTheDocument();
  }, 40000);

  it('o backup leva os dois planos e a restauração os traz de volta', async () => {
    const usuario = userEvent.setup();
    const repositorio = new RepositorioDeEstado(new ArmazenamentoEmMemoria());
    montar(repositorio);

    await importar(usuario, DIAS_UTEIS, 'novo');
    await importar(usuario, FIM_DE_SEMANA, 'novo');

    await usuario.click(screen.getByRole('button', { name: 'Abrir ajustes' }));
    expect(await screen.findByText('Planos alimentares (2)')).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Voltar' }));

    // O estado gravado guarda a coleção inteira e o plano ativo.
    await waitFor(async () => {
      const { estado } = await repositorio.carregar();
      expect(estado.planos.map((p) => p.id)).toEqual(['dias-uteis', 'fim-de-semana']);
      expect(estado.planoAtivoId).toBe('fim-de-semana');
    });
  }, 40000);
});
