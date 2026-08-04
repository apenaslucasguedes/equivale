/**
 * Cartão compacto de um bloco calórico.
 *
 * Toque prolongado ou menu de contexto no corpo → abre a gaveta de ações.
 * Somente o pegador inicia o arraste.
 * O pegador também funciona com teclado (dnd-kit KeyboardSensor).
 */

import { useEffect, useRef } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { BlocoCalorico, Configuracoes } from '../domain/types';
import { foiMovido, foiSubstituido } from '../domain/blocos';
import { descreverQuantidade } from './formatacao';

export interface PropsDoCartao {
  bloco: BlocoCalorico;
  configuracoes: Configuracoes;
  aoAbrir: (bloco: BlocoCalorico) => void;
  /** Desliga o arraste (usado no DragOverlay). */
  estatico?: boolean;
}

export const PREFIXO_ITEM_DESTINO = 'item:';

function iconeDoAlimento(nome: string): string {
  const alimento = nome.toLocaleLowerCase('pt-BR');
  if (alimento.includes('café')) return '☕';
  if (alimento.includes('queijo') || alimento.includes('muçarela') || alimento.includes('mussarela')) return '🧀';
  if (alimento.includes('banana')) return '🍌';
  if (alimento.includes('maçã')) return '🍎';
  if (alimento.includes('mamão')) return '🍈';
  if (alimento.includes('morango')) return '🍓';
  if (alimento.includes('uva')) return '🍇';
  if (alimento.includes('laranja') || alimento.includes('tangerina')) return '🍊';
  if (alimento.includes('abacaxi')) return '🍍';
  if (alimento.includes('melancia')) return '🍉';
  if (alimento.includes('abacate')) return '🥑';
  if (alimento.includes('ovo')) return '🥚';
  if (alimento.includes('pão') || alimento.includes('torrada')) return '🥖';
  if (alimento.includes('leite')) return '🥛';
  if (alimento.includes('iogurte')) return '🥣';
  if (alimento.includes('arroz')) return '🍚';
  if (alimento.includes('feijão')) return '🫘';
  if (alimento.includes('frango')) return '🍗';
  if (alimento.includes('carne')) return '🥩';
  if (alimento.includes('peixe') || alimento.includes('atum') || alimento.includes('sardinha')) return '🐟';
  if (alimento.includes('salada') || alimento.includes('alface')) return '🥗';
  if (alimento.includes('brócolis') || alimento.includes('couve')) return '🥦';
  if (alimento.includes('batata')) return '🥔';
  if (alimento.includes('milho') || alimento.includes('cuscuz')) return '🌽';
  if (alimento.includes('suco')) return '🧃';
  if (alimento.includes('água')) return '💧';
  if (alimento.includes('castanha') || alimento.includes('amendoim')) return '🥜';
  return '🍴';
}

export function CartaoDeItem({ bloco, configuracoes, aoAbrir, estatico = false }: PropsDoCartao) {
  const temporizador = useRef<number | null>(null);
  const { attributes, listeners, setNodeRef: setDraggableRef, isDragging } = useDraggable({
    id: bloco.id,
    disabled: estatico,
    data: { refeicaoId: bloco.atual.refeicaoId },
  });
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `${PREFIXO_ITEM_DESTINO}${bloco.id}`,
    disabled: estatico,
    data: { blocoId: bloco.id, refeicaoId: bloco.atual.refeicaoId },
  });
  const definirRef = (elemento: HTMLElement | null) => {
    setDraggableRef(elemento);
    setDroppableRef(elemento);
  };

  const substituido = foiSubstituido(bloco);
  const movido = foiMovido(bloco);
  const pendente = bloco.origemDasCalorias === 'pendente';
  const quantidade = descreverQuantidade(bloco, configuracoes);
  const cancelarToqueProlongado = () => {
    if (temporizador.current !== null) window.clearTimeout(temporizador.current);
    temporizador.current = null;
  };
  const iniciarToqueProlongado = (evento: React.PointerEvent<HTMLButtonElement>) => {
    if (evento.pointerType !== 'touch' && evento.pointerType !== 'pen') return;
    cancelarToqueProlongado();
    temporizador.current = window.setTimeout(() => {
      temporizador.current = null;
      aoAbrir(bloco);
    }, 500);
  };

  useEffect(() => cancelarToqueProlongado, []);

  return (
    <article
      ref={estatico ? undefined : definirRef}
      className={`cartao${isDragging ? ' cartao--arrastando' : ''}${isOver && !isDragging ? ' cartao--destino' : ''}${estatico ? ' cartao--sobreposto' : ''}`}
    >
      <button
        type="button"
        className="cartao__corpo"
        onPointerDown={iniciarToqueProlongado}
        onPointerUp={cancelarToqueProlongado}
        onPointerCancel={cancelarToqueProlongado}
        onPointerLeave={cancelarToqueProlongado}
        onPointerMove={cancelarToqueProlongado}
        onContextMenu={(evento) => {
          evento.preventDefault();
          cancelarToqueProlongado();
          aoAbrir(bloco);
        }}
        onClick={(evento) => {
          const tipoDePonteiro = (evento.nativeEvent as PointerEvent).pointerType;
          if (tipoDePonteiro === 'touch' || tipoDePonteiro === 'pen') return;
          aoAbrir(bloco);
        }}
        onKeyDown={(evento) => {
          if (evento.key !== 'Enter' && evento.key !== ' ') return;
          evento.preventDefault();
          aoAbrir(bloco);
        }}
        aria-label={`${bloco.atual.alimentoNome}, ${quantidade}. Segure para abrir as opções do item.`}
      >
        <span className="cartao__titulo">
          <span className="cartao__icone" aria-hidden="true">{iconeDoAlimento(bloco.atual.alimentoNome)}</span>
          <span className="cartao__nome">{bloco.atual.alimentoNome}</span>
        </span>
        <span className="cartao__quantidade">{quantidade}</span>
        {substituido || movido || pendente ? (
          <span className="cartao__etiquetas">
            {substituido ? <span className="etiqueta etiqueta--alterado">substituído</span> : null}
            {movido ? <span className="etiqueta etiqueta--alterado">movido</span> : null}
            {pendente ? (
              <span className="etiqueta etiqueta--pendente">
                {bloco.motivoPendencia ?? 'Calorias pendentes'}
              </span>
            ) : null}

          </span>
        ) : null}
      </button>

      {estatico ? null : (
        <button
          type="button"
          className="cartao__pegador"
          {...attributes}
          {...listeners}
          aria-label="Arrastar alimento"
          onClick={(evento) => evento.stopPropagation()}
        >
          <span aria-hidden="true">⠿</span>
        </button>
      )}
    </article>
  );
}
