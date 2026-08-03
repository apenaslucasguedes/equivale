/** Diálogo de confirmação para ações destrutivas ou de grande alcance. */

import type { ReactNode } from 'react';
import { Gaveta } from './Gaveta';

export interface PropsDaConfirmacao {
  aberta: boolean;
  titulo: string;
  descricao: ReactNode;
  rotuloDeConfirmar: string;
  perigo?: boolean;
  aoConfirmar: () => void;
  aoCancelar: () => void;
}

export function Confirmacao({
  aberta,
  titulo,
  descricao,
  rotuloDeConfirmar,
  perigo = false,
  aoConfirmar,
  aoCancelar,
}: PropsDaConfirmacao) {
  return (
    <Gaveta
      aberta={aberta}
      titulo={titulo}
      aoFechar={aoCancelar}
      rodape={
        <>
          <button type="button" className="botao" style={{ flex: 1 }} onClick={aoCancelar}>
            Cancelar
          </button>
          <button
            type="button"
            className={`botao ${perigo ? 'botao--perigo' : 'botao--primario'}`}
            style={{ flex: 1 }}
            onClick={aoConfirmar}
          >
            {rotuloDeConfirmar}
          </button>
        </>
      }
    >
      <div style={{ fontSize: 14, color: 'var(--texto-2)' }}>{descricao}</div>
    </Gaveta>
  );
}
