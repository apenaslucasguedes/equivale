/**
 * Seletor compacto do plano atual, no cabeçalho.
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

  // Um plano só: mostrar um seletor seria ruído. Basta o nome.
  if (planos.length === 1) {
    const unico = planos[0] as PlanoAlimentar;
    return (
      <span className="seletor-de-plano seletor-de-plano--unico" title={rotuloDoPlano(unico)}>
        {unico.nome}
      </span>
    );
  }

  const ativo = planos.find((plano) => plano.id === planoAtivoId) ?? planos[0];
  const legenda = legendaDoPlano(ativo);

  return (
    <div className="seletor-de-plano">
      <label>
        <span className="visualmente-oculto">Plano atual</span>
        <select
          className="seletor-de-plano__campo"
          value={planoAtivoId ?? ''}
          onChange={(evento) => aoTrocar(evento.target.value)}
        >
          {planos.map((plano) => (
            <option key={plano.id} value={plano.id}>
              {plano.nome}
            </option>
          ))}
        </select>
      </label>
      {legenda ? <span className="seletor-de-plano__legenda">{legenda}</span> : null}
    </div>
  );
}
