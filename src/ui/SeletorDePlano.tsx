/**
 * Guias compactas dos planos, no cabeçalho.
 *
 * A troca é sempre MANUAL. Os dias sugeridos aparecem só como legenda: nesta
 * versão o Equivale não troca de plano sozinho conforme o dia da semana.
 */

import type { PlanoAlimentar } from '../domain/types';
import { descreverDias } from '../domain/planos';

export interface PropsDoSeletorDePlano {
  planos: PlanoAlimentar[];
  planoAtivoId: string | null;
  aoTrocar: (planoId: string) => void;
}

function rotuloDoPlano(plano: PlanoAlimentar): string {
  const dias = descreverDias(plano.diasSugeridos);
  return dias ? `${plano.nome} · ${dias}` : plano.nome;
}

function legendaDoPlano(plano: PlanoAlimentar | undefined): string | null {
  if (!plano) return null;
  const dias = descreverDias(plano.diasSugeridos);
  return dias ? `Dias sugeridos: ${dias}` : null;
}

export function SeletorDePlano({ planos, planoAtivoId, aoTrocar }: PropsDoSeletorDePlano) {
  if (planos.length === 0) return null;

  const ativo = planos.find((plano) => plano.id === planoAtivoId) ?? planos[0];
  const legenda = legendaDoPlano(ativo);

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
              title={rotuloDoPlano(plano)}
              onClick={() => aoTrocar(plano.id)}
            >
              {plano.nome}
            </button>
          );
        })}
      </div>
      {legenda ? <span className="seletor-de-plano__legenda">{legenda}</span> : null}
    </div>
  );
}
