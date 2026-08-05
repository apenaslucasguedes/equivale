/**
 * Guias compactas dos planos, no cabeçalho.
 *
 * A troca é sempre MANUAL. Os dias sugeridos aparecem só como legenda: nesta
 * versão o Equivale não troca de plano sozinho conforme o dia da semana.
 */

import type { PlanoAlimentar } from '../domain/types';


export interface PropsDoSeletorDePlano {
  planos: PlanoAlimentar[];
  planoAtivoId: string | null;
  aoTrocar: (planoId: string) => void;
}

export function SeletorDePlano({ planos, planoAtivoId, aoTrocar }: PropsDoSeletorDePlano) {
  if (planos.length === 0) return null;

  const ativo = planos.find((plano) => plano.id === planoAtivoId) ?? planos[0];
  return (
    <div className="seletor-de-plano">
      <div className="seletor-de-plano__guias" role="tablist" aria-label="Planos alimentares">
        {planos.map((plano) => {
          const selecionado = plano.id === ativo?.id;
          return (
            <button
              key={plano.id}
              type="button"
              className={`seletor-de-plano__guia${selecionado ? ' seletor-de-plano__guia--ativa' : ''}`}
              role="tab"
              aria-selected={selecionado}
              title={plano.nome}
              onClick={() => aoTrocar(plano.id)}
            >
              {plano.nome}
            </button>
          );
        })}
      </div>
    </div>
  );
}
