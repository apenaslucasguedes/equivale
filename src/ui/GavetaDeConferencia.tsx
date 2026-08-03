/**
 * Conferência de um item que entrou sem calorias definidas.
 *
 * Nada é descartado na importação: o item vira bloco e espera aqui até ser
 * vinculado a um alimento da base ou receber as calorias manualmente.
 */

import { useState } from 'react';
import type { Alimento, BlocoCalorico } from '../domain/types';
import type { RepositorioDeAlimentos } from '../data/alimentos/repositorio';
import { calcularCaloriasDaQuantidade } from '../domain/equivalencia';
import { formatarNumero, lerNumero } from '../domain/texto';
import { Gaveta } from './Gaveta';
import { SeletorDeAlimento } from './SeletorDeAlimento';

export interface PropsDaConferencia {
  aberta: boolean;
  bloco: BlocoCalorico;
  repositorio: RepositorioDeAlimentos;
  aoVincular: (alimento: Alimento, kcal: number) => void;
  aoInformarCalorias: (kcal: number) => void;
  aoFechar: () => void;
}

/** Gramas do item a partir da quantidade prescrita e das medidas do alimento. */
function gramasDoBloco(bloco: BlocoCalorico, alimento: Alimento | null): number | null {
  const { quantidade, unidade } = bloco.original;
  if (unidade === 'g' || unidade === 'ml') return quantidade;
  if (!alimento) return null;

  for (const porcao of alimento.porcoesCaseiras ?? []) {
    const medida = porcao.medida.toLowerCase();
    if (!medida.startsWith(unidade.toLowerCase())) continue;
    if (!Number.isFinite(porcao.gramas) || porcao.quantidade <= 0) continue;
    return (quantidade * porcao.gramas) / porcao.quantidade;
  }
  return null;
}

function caloriasParaAlimento(bloco: BlocoCalorico, alimento: Alimento): number | null {
  const gramas = gramasDoBloco(bloco, alimento);
  if (gramas === null) return null;
  const resultado = calcularCaloriasDaQuantidade(gramas, alimento.kcalPor100g);
  return resultado.ok ? resultado.valor : null;
}

export function GavetaDeConferencia({
  aberta,
  bloco,
  repositorio,
  aoVincular,
  aoInformarCalorias,
  aoFechar,
}: PropsDaConferencia) {
  const [kcalManual, setKcalManual] = useState('');
  const valorManual = lerNumero(kcalManual);
  const manualValido = valorManual !== null && valorManual >= 0;

  return (
    <Gaveta
      aberta={aberta}
      titulo="Conferir item"
      subtitulo={
        <>
          <strong>{bloco.original.alimentoNome}</strong> · {formatarNumero(bloco.original.quantidade, 2)}{' '}
          {bloco.original.unidade}
        </>
      }
      aoFechar={aoFechar}
    >
      <p className="nota nota--destaque" style={{ marginBottom: 12 }}>
        Este item veio da dieta sem calorias e sem correspondência exata na base. Vincule a um
        alimento ou informe as calorias prescritas. Nada foi descartado.
      </p>

      <h3 className="cartao-info__titulo">Informar as calorias do item</h3>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 16 }}>
        <label className="campo" style={{ flex: 1, marginBottom: 0 }}>
          <span className="campo__rotulo">Calorias prescritas (kcal)</span>
          <input
            className="entrada"
            type="text"
            inputMode="decimal"
            value={kcalManual}
            onChange={(evento) => setKcalManual(evento.target.value)}
            placeholder="Ex.: 150"
          />
        </label>
        <button
          type="button"
          className="botao botao--primario"
          disabled={!manualValido}
          onClick={() => manualValido && aoInformarCalorias(valorManual)}
        >
          Salvar
        </button>
      </div>

      <h3 className="cartao-info__titulo">Ou vincular a um alimento da base</h3>
      <SeletorDeAlimento
        repositorio={repositorio}
        rotuloDaBusca="Pesquisar alimento para vincular"
        aoEscolher={(alimento) => {
          const kcal = caloriasParaAlimento(bloco, alimento);
          if (kcal === null) return;
          aoVincular(alimento, kcal);
        }}
        aoDescreverResultado={(alimento) => {
          const kcal = caloriasParaAlimento(bloco, alimento);
          return (
            <span className="resultado__quantidade">
              {kcal === null ? '—' : `${formatarNumero(kcal, 0)} kcal`}
              <small>{kcal === null ? 'sem conversão' : 'para este item'}</small>
            </span>
          );
        }}
      />
    </Gaveta>
  );
}
