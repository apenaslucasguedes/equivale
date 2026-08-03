/**
 * Provedor de estado do Equivale.
 *
 * Responsabilidades:
 * - recuperar o estado ao abrir o app (IndexedDB);
 * - gravar automaticamente cada mudança;
 * - manter o repositório de alimentos alinhado com o modo de demonstração.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { estadoInicial } from '../domain/types';
import { redutor } from './acoes';
import type { ValorDaLoja } from './contexto';
import { ContextoDaLoja } from './contexto';
import type { RepositorioDeEstado } from '../persistencia/repositorioDeEstado';
import { criarRepositorioDeEstadoPadrao } from '../persistencia/repositorioDeEstado';
import type { RepositorioDeAlimentos } from '../data/alimentos/repositorio';
import { criarRepositorio } from '../data/alimentos/fonte';

export interface PropsDaLoja {
  children: ReactNode;
  /** Injeção usada nos testes. */
  repositorioDeEstado?: RepositorioDeEstado;
  criarRepositorioDeAlimentos?: (modoDemonstracao: boolean) => RepositorioDeAlimentos;
}

export function Loja({ children, repositorioDeEstado, criarRepositorioDeAlimentos }: PropsDaLoja) {
  const repositorio = useMemo(
    () => repositorioDeEstado ?? criarRepositorioDeEstadoPadrao(),
    [repositorioDeEstado],
  );
  const fabricaDeAlimentos = useMemo(
    () => criarRepositorioDeAlimentos ?? criarRepositorio,
    [criarRepositorioDeAlimentos],
  );

  const [estado, despachar] = useReducer(redutor, undefined, estadoInicial);
  const [carregando, setCarregando] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);
  const [alimentosProntos, setAlimentosProntos] = useState(false);
  const podeSalvar = useRef(false);

  const modoDemonstracao = estado.configuracoes.modoDemonstracao;
  const [alimentos, setAlimentos] = useState<RepositorioDeAlimentos>(() =>
    fabricaDeAlimentos(false),
  );

  // Recuperação automática do estado ao (re)abrir o aplicativo.
  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { estado: recuperado, aviso: avisoDeCarga } = await repositorio.carregar();
      if (!ativo) return;
      despachar({ tipo: 'estadoCarregado', estado: recuperado });
      if (avisoDeCarga) setAviso(avisoDeCarga);
      setCarregando(false);
      podeSalvar.current = true;
    })();
    return () => {
      ativo = false;
    };
  }, [repositorio]);

  // Gravação automática, sem bloquear a interface.
  useEffect(() => {
    if (!podeSalvar.current) return;
    const identificador = setTimeout(() => {
      void repositorio.salvar(estado).catch((erro: Error) => {
        setAviso(`Não foi possível salvar no aparelho: ${erro.message}`);
      });
    }, 120);
    return () => clearTimeout(identificador);
  }, [estado, repositorio]);

  // Base de alimentos: troca junto com o modo de demonstração.
  useEffect(() => {
    let ativo = true;
    setAlimentosProntos(false);
    const novo = fabricaDeAlimentos(modoDemonstracao);
    void novo
      .carregar()
      .catch(() => undefined)
      .finally(() => {
        if (!ativo) return;
        setAlimentos(novo);
        setAlimentosProntos(true);
      });
    return () => {
      ativo = false;
    };
  }, [modoDemonstracao, fabricaDeAlimentos]);

  const apagarTudo = useCallback(async () => {
    await repositorio.apagarTudo();
    despachar({ tipo: 'apagarTudo' });
  }, [repositorio]);

  const descartarAviso = useCallback(() => setAviso(null), []);

  const valor = useMemo<ValorDaLoja>(
    () => ({
      estado,
      despachar,
      carregando,
      aviso,
      descartarAviso,
      alimentos,
      alimentosProntos,
      apagarTudo,
      nomeDoArmazenamento: repositorio.nomeDoArmazenamento(),
    }),
    [
      estado,
      carregando,
      aviso,
      descartarAviso,
      alimentos,
      alimentosProntos,
      apagarTudo,
      repositorio,
    ],
  );

  return <ContextoDaLoja.Provider value={valor}>{children}</ContextoDaLoja.Provider>;
}
