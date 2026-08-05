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
import { descreverResumoDoBloco } from './formatacao';
import { iconeDoAlimento } from './iconeDoAlimento';

export interface PropsDoCartao {
  bloco: BlocoCalorico;
  configuracoes: Configuracoes;
  aoAtivar: (bloco: BlocoCalorico) => void;
  aoAbrirAcoes: (bloco: BlocoCalorico) => void;
  /** Desliga o arraste (usado no DragOverlay). */
  estatico?: boolean;
}

export const PREFIXO_ITEM_DESTINO = 'item:';


export function CartaoDeItem({ bloco, configuracoes, aoAtivar, aoAbrirAcoes, estatico = false }: PropsDoCartao) {
  const temporizador = useRef<number | null>(null);
  const toqueCancelado = useRef(false);
  const toqueProlongadoDisparado = useRef(false);
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
  const resumo = descreverResumoDoBloco(bloco, configuracoes);
  const cancelarToqueProlongado = () => {
    if (temporizador.current !== null) window.clearTimeout(temporizador.current);
    temporizador.current = null;
  };
  const iniciarToqueProlongado = (evento: React.PointerEvent<HTMLButtonElement>) => {
    if (evento.pointerType !== 'touch' && evento.pointerType !== 'pen') return;
    cancelarToqueProlongado();
    toqueCancelado.current = false;
    toqueProlongadoDisparado.current = false;
    temporizador.current = window.setTimeout(() => {
      temporizador.current = null;
      toqueProlongadoDisparado.current = true;
      aoAbrirAcoes(bloco);
    }, 500);
  };
  const concluirToque = (evento: React.PointerEvent<HTMLButtonElement>) => {
    if (evento.pointerType !== 'touch' && evento.pointerType !== 'pen') {
      cancelarToqueProlongado();
      return;
    }
    const deveAtivar = !toqueCancelado.current && !toqueProlongadoDisparado.current;
    cancelarToqueProlongado();
    if (deveAtivar) aoAtivar(bloco);
  };
  const cancelarGestual = () => {
    toqueCancelado.current = true;
    cancelarToqueProlongado();
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
        onPointerUp={concluirToque}
        onPointerCancel={cancelarGestual}
        onPointerLeave={cancelarGestual}
        onPointerMove={cancelarGestual}
        onContextMenu={(evento) => {
          evento.preventDefault();
          cancelarToqueProlongado();
          aoAbrirAcoes(bloco);
        }}
        onClick={(evento) => {
          const tipoDePonteiro = (evento.nativeEvent as PointerEvent).pointerType;
          if (tipoDePonteiro === 'touch' || tipoDePonteiro === 'pen') return;
          aoAtivar(bloco);
        }}
        onKeyDown={(evento) => {
          if (evento.key !== 'Enter' && evento.key !== ' ') return;
          evento.preventDefault();
          aoAtivar(bloco);
        }}
        aria-label={`${bloco.atual.alimentoNome}, ${resumo}. Clique para substituir; segure ou clique com o botão direito para abrir as opções.`}
      >
        <span className="cartao__titulo">
          <span className="cartao__icone" aria-hidden="true">{iconeDoAlimento(bloco.atual.alimentoNome)}</span>
          <span className="cartao__nome">{bloco.atual.alimentoNome}</span>
        </span>
        <span className="cartao__quantidade">{resumo}</span>
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
