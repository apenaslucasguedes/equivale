/** Gaveta inferior aberta ao tocar em um cartão. */

import type { BlocoCalorico, Configuracoes } from '../domain/types';
import { foiAlterado } from '../domain/blocos';
import { Gaveta } from './Gaveta';
import { descreverEnergia, descreverQuantidade } from './formatacao';

export type AcaoDoItem = 'substituir' | 'mover' | 'detalhes' | 'restaurar' | 'conferir';

export interface PropsDasAcoes {
  aberta: boolean;
  bloco: BlocoCalorico;
  configuracoes: Configuracoes;
  aoEscolher: (acao: AcaoDoItem) => void;
  aoFechar: () => void;
}

export function GavetaDeAcoes({
  aberta,
  bloco,
  configuracoes,
  aoEscolher,
  aoFechar,
}: PropsDasAcoes) {
  const alterado = foiAlterado(bloco);
  const pendente = bloco.origemDasCalorias === 'pendente';

  return (
    <Gaveta
      aberta={aberta}
      titulo={bloco.atual.alimentoNome}
      subtitulo={
        <>
          {descreverQuantidade(bloco, configuracoes)}
          {pendente ? ' · a conferir' : ` · ${descreverEnergia(bloco.kcal)}`}
        </>
      }
      aoFechar={aoFechar}
    >
      <ul className="opcoes">
        {pendente ? (
          <li>
            <button type="button" className="opcao" onClick={() => aoEscolher('conferir')}>
              <span className="opcao__icone" aria-hidden="true">
                ⚑
              </span>
              <span className="opcao__texto">
                Conferir item
                <span className="opcao__descricao">
                  Vincular a um alimento da base para definir as calorias do bloco
                </span>
              </span>
            </button>
          </li>
        ) : null}
        <li>
          <button type="button" className="opcao" onClick={() => aoEscolher('substituir')}>
            <span className="opcao__icone" aria-hidden="true">
              ⇄
            </span>
            <span className="opcao__texto">
              Substituir alimento
              <span className="opcao__descricao">
                Trocar por outro alimento com quantidade caloricamente equivalente
              </span>
            </span>
          </button>
        </li>
        <li>
          <button type="button" className="opcao" onClick={() => aoEscolher('mover')}>
            <span className="opcao__icone" aria-hidden="true">
              ↕
            </span>
            <span className="opcao__texto">
              Mover para outra refeição
              <span className="opcao__descricao">Sem alterar as calorias do bloco</span>
            </span>
          </button>
        </li>
        <li>
          <button type="button" className="opcao" onClick={() => aoEscolher('detalhes')}>
            <span className="opcao__icone" aria-hidden="true">
              ⓘ
            </span>
            <span className="opcao__texto">
              Ver detalhes
              <span className="opcao__descricao">Origem, alterações e observação</span>
            </span>
          </button>
        </li>
        <li>
          <button
            type="button"
            className="opcao"
            onClick={() => alterado && aoEscolher('restaurar')}
            disabled={!alterado}
            aria-disabled={!alterado}
          >
            <span className="opcao__icone" aria-hidden="true">
              ↺
            </span>
            <span className="opcao__texto">
              Restaurar item original
              <span className="opcao__descricao">
                {alterado
                  ? `Voltar para ${bloco.original.alimentoNome}`
                  : 'Este item já está como foi prescrito'}
              </span>
            </span>
          </button>
        </li>
      </ul>
    </Gaveta>
  );
}
