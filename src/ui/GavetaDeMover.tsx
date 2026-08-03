/** Alternativa acessível ao arrastar e soltar: "Mover para...". */

import type { BlocoCalorico, Refeicao } from '../domain/types';
import { Gaveta } from './Gaveta';

export interface PropsDeMover {
  aberta: boolean;
  bloco: BlocoCalorico;
  refeicoes: Refeicao[];
  aoMover: (refeicaoId: string) => void;
  posicaoAtual: number;
  totalNaRefeicao: number;
  aoReordenar: (posicao: number) => void;
  aoFechar: () => void;
}

export function GavetaDeMover({
  aberta,
  bloco,
  refeicoes,
  aoMover,
  posicaoAtual,
  totalNaRefeicao,
  aoReordenar,
  aoFechar,
}: PropsDeMover) {
  return (
    <Gaveta
      aberta={aberta}
      titulo="Mover para..."
      subtitulo={
        <>
          <strong>{bloco.atual.alimentoNome}</strong> mantém a mesma quantidade e as mesmas calorias.
        </>
      }
      aoFechar={aoFechar}
    >
      <div className="acoes-de-reordenacao" aria-label="Reordenar nesta refeição">
        <button type="button" className="botao" disabled={posicaoAtual <= 0} onClick={() => aoReordenar(posicaoAtual - 1)}>
          Mover para cima
        </button>
        <button type="button" className="botao" disabled={posicaoAtual < 0 || posicaoAtual >= totalNaRefeicao - 1} onClick={() => aoReordenar(posicaoAtual + 1)}>
          Mover para baixo
        </button>
      </div>
      <ul className="opcoes">
        {refeicoes.map((refeicao) => {
          const atual = refeicao.id === bloco.atual.refeicaoId;
          return (
            <li key={refeicao.id}>
              <button
                type="button"
                className="opcao"
                onClick={() => !atual && aoMover(refeicao.id)}
                disabled={atual}
                aria-disabled={atual}
              >
                <span className="opcao__icone" aria-hidden="true">
                  {atual ? '•' : '→'}
                </span>
                <span className="opcao__texto">
                  {refeicao.nome}
                  {atual ? <span className="opcao__descricao">Refeição atual</span> : null}
                  {refeicao.id === bloco.original.refeicaoId && !atual ? (
                    <span className="opcao__descricao">Refeição original do item</span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Gaveta>
  );
}
