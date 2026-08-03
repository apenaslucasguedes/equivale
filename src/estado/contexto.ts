/** Contexto do estado — separado do componente para manter o fast refresh. */

import { createContext, useContext } from 'react';
import type { EstadoPersistido } from '../domain/types';
import type { Acao } from './acoes';
import type { RepositorioDeAlimentos } from '../data/alimentos/repositorio';

export interface ValorDaLoja {
  estado: EstadoPersistido;
  despachar: (acao: Acao) => void;
  carregando: boolean;
  aviso: string | null;
  descartarAviso: () => void;
  alimentos: RepositorioDeAlimentos;
  alimentosProntos: boolean;
  /** Apaga todos os dados locais de verdade (banco incluído). */
  apagarTudo: () => Promise<void>;
  nomeDoArmazenamento: string;
}

export const ContextoDaLoja = createContext<ValorDaLoja | null>(null);

export function useLoja(): ValorDaLoja {
  const valor = useContext(ContextoDaLoja);
  if (!valor) throw new Error('useLoja precisa estar dentro de <Loja>.');
  return valor;
}
