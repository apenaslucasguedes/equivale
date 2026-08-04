/** Uma refeição da dieta: cabeçalho discreto + cartões, e área de destino do arraste. */

import { useDroppable } from '@dnd-kit/core';
import type { BlocoCalorico, Configuracoes, Refeicao } from '../domain/types';
import { CartaoDeItem } from './CartaoDeItem';

export const PREFIXO_DESTINO = 'refeicao:';

function iconeDaRefeicao(nome: string): string {
  const nomeNormalizado = nome.toLocaleLowerCase('pt-BR');
  if (nomeNormalizado.includes('café')) return '☕';
  if (nomeNormalizado.includes('lanche')) return '🍎';
  if (nomeNormalizado.includes('almoço')) return '🍽️';
  if (nomeNormalizado.includes('jantar')) return '🥗';
  if (nomeNormalizado.includes('ceia')) return '🌙';
  return '🍴';
}

export interface PropsDaRefeicao {
  refeicao: Refeicao;
  blocos: BlocoCalorico[];
  configuracoes: Configuracoes;
  aoAbrirItem: (bloco: BlocoCalorico) => void;
  arrastando: boolean;
}

export function BlocoDeRefeicao({
  refeicao,
  blocos,
  configuracoes,
  aoAbrirItem,
  arrastando,
}: PropsDaRefeicao) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${PREFIXO_DESTINO}${refeicao.id}`,
    data: { refeicaoId: refeicao.id },
  });

  const destacar = arrastando && isOver;

  return (
    <section className="refeicao" aria-labelledby={`refeicao-${refeicao.id}`}>
      <header className="refeicao__cabecalho">
        <h2 className="refeicao__nome" id={`refeicao-${refeicao.id}`}>
          <span className="refeicao__icone" aria-hidden="true">{iconeDaRefeicao(refeicao.nome)}</span>
          {refeicao.nome}
        </h2>
        <span className="refeicao__contagem">
          {blocos.length === 1 ? '1 item' : `${blocos.length} itens`}
        </span>
      </header>

      <div
        ref={setNodeRef}
        className={`refeicao__lista${destacar ? ' refeicao__lista--destino' : ''}`}
        data-destino={refeicao.id}
      >
        {blocos.length === 0 ? (
          <p className="refeicao__vazia">
            {arrastando ? 'Solte aqui para mover o item' : 'Sem itens nesta refeição'}
          </p>
        ) : (
          blocos.map((bloco) => (
            <CartaoDeItem
              key={bloco.id}
              bloco={bloco}
              configuracoes={configuracoes}
              aoAbrir={aoAbrirItem}
            />
          ))
        )}
      </div>
    </section>
  );
}
