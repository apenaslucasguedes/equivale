/**
 * Busca de alimentos reutilizável.
 *
 * O filtro por categoria é ORGANIZACIONAL: ele só muda o que a lista mostra.
 * Nenhuma categoria impede a troca por outra — o filtro pode ser limpo a
 * qualquer momento, e o aviso na tela deixa isso explícito.
 */

import { useDeferredValue, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Alimento, Categoria } from '../domain/types';
import { ICONE_CATEGORIA, ROTULO_CATEGORIA } from '../domain/types';
import type { RepositorioDeAlimentos } from '../data/alimentos/repositorio';

export interface PropsDoSeletor {
  repositorio: RepositorioDeAlimentos;
  /** Conteúdo do lado direito de cada resultado (ex.: quantidade equivalente). */
  aoDescreverResultado?: (alimento: Alimento) => ReactNode;
  aoEscolher: (alimento: Alimento) => void;
  rotuloDaBusca?: string;
  categoriaInicial?: Categoria | null;
}

export function SeletorDeAlimento({
  repositorio,
  aoDescreverResultado,
  aoEscolher,
  rotuloDaBusca = 'Pesquisar alimento',
  categoriaInicial = null,
}: PropsDoSeletor) {
  const [consulta, setConsulta] = useState('');
  const [categoria, setCategoria] = useState<Categoria | null>(categoriaInicial);
  const consultaAdiada = useDeferredValue(consulta);

  const categorias = useMemo(
    () => repositorio.categoriasDisponiveis().sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [repositorio],
  );

  const resultados = useMemo(
    () => repositorio.buscar(consultaAdiada, { categoria, limite: 60 }),
    [repositorio, consultaAdiada, categoria],
  );

  if (repositorio.total() === 0) {
    return (
      <p className="nota nota--destaque">
        Nenhuma base de alimentos carregada. O Equivale não inclui uma base nutricional própria e
        não inventa valores. Ative o <strong>modo de demonstração</strong> em Ajustes para
        experimentar com dados fictícios, ou instale uma base real (veja o README).
      </p>
    );
  }

  return (
    <div>
      <label className="campo">
        <span className="campo__rotulo">{rotuloDaBusca}</span>
        <input
          className="entrada"
          type="search"
          value={consulta}
          onChange={(evento) => setConsulta(evento.target.value)}
          placeholder="Ex.: arroz, banana, frango..."
          autoComplete="off"
        />
      </label>

      {categorias.length > 0 ? (
        <>
          <div className="filtros" role="group" aria-label="Filtrar por categoria">
            <button
              type="button"
              className="filtro"
              aria-pressed={categoria === null}
              onClick={() => setCategoria(null)}
            >
              Todas
            </button>
            {categorias.map((c) => (
              <button
                key={c}
                type="button"
                className="filtro"
                aria-pressed={categoria === c}
                onClick={() => setCategoria(categoria === c ? null : c)}
              >
                {ROTULO_CATEGORIA[c] ?? c}
              </button>
            ))}
          </div>
          <p className="nota" style={{ marginBottom: 8 }}>
            As categorias só organizam a lista. Qualquer alimento pode substituir qualquer outro.
          </p>
        </>
      ) : null}

      {resultados.length === 0 ? (
        <p className="nota nota--destaque">
          Nenhum alimento encontrado para “{consulta}”
          {categoria ? ' nesta categoria' : ''}. Tente outro termo
          {categoria ? ' ou toque em “Todas”' : ''}.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {resultados.map(({ alimento }) => (
            <li key={alimento.id}>
              <button type="button" className="resultado" onClick={() => aoEscolher(alimento)}>
                <span style={{ minWidth: 0 }}>
                  <span className="resultado__nome">
                    <span aria-hidden="true">{ICONE_CATEGORIA[alimento.categoria]} </span>
                    {alimento.nome}
                  </span>
                  <span className="resultado__detalhe">
                    {ROTULO_CATEGORIA[alimento.categoria] ?? alimento.categoria}
                    {alimento.preparo ? ` · ${alimento.preparo}` : ''} · {alimento.kcalPor100g} kcal
                    /100 g
                  </span>
                </span>
                {aoDescreverResultado ? aoDescreverResultado(alimento) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
