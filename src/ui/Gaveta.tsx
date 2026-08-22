/** Gaveta inferior (bottom sheet) acessível: Esc fecha, foco fica preso dentro. */

import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';

export interface PropsDaGaveta {
  aberta: boolean;
  titulo: string;
  subtitulo?: ReactNode;
  aoFechar: () => void;
  children: ReactNode;
  rodape?: ReactNode;
}

const SELETOR_FOCAVEL =
  'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export function Gaveta({ aberta, titulo, subtitulo, aoFechar, children, rodape }: PropsDaGaveta) {
  const painel = useRef<HTMLDivElement>(null);
  const aoFecharRef = useRef(aoFechar);
  const idDoTitulo = useId();

  useEffect(() => {
    aoFecharRef.current = aoFechar;
  }, [aoFechar]);

  useEffect(() => {
    if (!aberta) return;
    const anterior = document.activeElement as HTMLElement | null;
    const primeiro = painel.current?.querySelector<HTMLElement>(SELETOR_FOCAVEL);
    primeiro?.focus();

    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        evento.stopPropagation();
        aoFecharRef.current();
        return;
      }
      if (evento.key !== 'Tab' || !painel.current) return;
      const focaveis = [...painel.current.querySelectorAll<HTMLElement>(SELETOR_FOCAVEL)];
      if (focaveis.length === 0) return;
      const inicio = focaveis[0] as HTMLElement;
      const fim = focaveis[focaveis.length - 1] as HTMLElement;
      if (evento.shiftKey && document.activeElement === inicio) {
        evento.preventDefault();
        fim.focus();
      } else if (!evento.shiftKey && document.activeElement === fim) {
        evento.preventDefault();
        inicio.focus();
      }
    };

    document.addEventListener('keydown', aoTeclar);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = overflowAnterior;
      anterior?.focus?.();
    };
  }, [aberta]);

  if (!aberta) return null;

  return (
    <div
      className="sobreposicao"
      onPointerDown={(evento) => {
        if (evento.target === evento.currentTarget) aoFechar();
      }}
    >
      <div
        className="gaveta"
        role="dialog"
        aria-modal="true"
        aria-labelledby={idDoTitulo}
        ref={painel}
      >
        <div className="gaveta__puxador" aria-hidden="true" />
        <div className="gaveta__cabecalho">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="gaveta__titulo" id={idDoTitulo}>
              {titulo}
            </h2>
            {subtitulo ? <p className="gaveta__subtitulo">{subtitulo}</p> : null}
          </div>
          <button type="button" className="botao botao--icone" onClick={aoFechar} aria-label="Fechar">
            ✕
          </button>
        </div>
        <div className="gaveta__corpo">{children}</div>
        {rodape ? <div className="gaveta__rodape">{rodape}</div> : null}
      </div>
    </div>
  );
}
