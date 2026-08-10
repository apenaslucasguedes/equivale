import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Gaveta } from '../src/ui/Gaveta';

function Exemplo() {
  const [valor, setValor] = useState('');
  return (
    <Gaveta aberta titulo="Editar alimento" aoFechar={() => undefined}>
      <label>Quantidade<input value={valor} onChange={(evento) => setValor(evento.target.value)} /></label>
    </Gaveta>
  );
}

describe('gaveta', () => {
  it('mantém o foco no campo durante rerenderizações da digitação', async () => {
    const usuario = userEvent.setup();
    render(<Exemplo />);
    const campo = screen.getByRole('textbox', { name: 'Quantidade' });
    await usuario.click(campo);
    await usuario.type(campo, '123');
    expect(campo).toHaveValue('123');
    expect(campo).toHaveFocus();
  });
});
