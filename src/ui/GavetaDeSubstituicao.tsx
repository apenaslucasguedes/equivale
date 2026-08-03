/**
 * Substituição de alimento mantendo as calorias do bloco.
 *
 * Fórmula usada e exibida ao usuário:
 *   quantidade equivalente (g) = kcal fixas do bloco × 100 ÷ kcal por 100 g
 */

import { useEffect, useMemo, useState } from 'react';
import type { Alimento, BlocoCalorico, Configuracoes } from '../domain/types';
import type { RepositorioDeAlimentos } from '../data/alimentos/repositorio';
import type { DadosDaSubstituicao } from '../domain/blocos';
import {
  arredondarParaExibicao,
  calcularQuantidadeEquivalente,
  formatarQuantidade,
  sugerirMedidasCaseiras,
} from '../domain/equivalencia';
import { formatarNumero } from '../domain/texto';
import { Gaveta } from './Gaveta';
import { SeletorDeAlimento } from './SeletorDeAlimento';
import { descreverEnergia, descreverQuantidade } from './formatacao';
import { carregarCatalogo, criarIndiceCatalogo } from '../catalogo/catalogo';
import type { GrupoCatalogo, OpcaoCatalogo } from '../catalogo/catalogo';

export interface PropsDaSubstituicao {
  aberta: boolean;
  bloco: BlocoCalorico;
  repositorio: RepositorioDeAlimentos;
  configuracoes: Configuracoes;
  aoSubstituir: (dados: DadosDaSubstituicao) => void;
  aoFechar: () => void;
}

export function GavetaDeSubstituicao({
  aberta,
  bloco,
  repositorio,
  configuracoes,
  aoSubstituir,
  aoFechar,
}: PropsDaSubstituicao) {
  const [escolhido, setEscolhido] = useState<Alimento | null>(null);
  const [medidaEscolhida, setMedidaEscolhida] = useState<string | null>(null);
  const [grupoPrescrito, setGrupoPrescrito] = useState<GrupoCatalogo | null>(null);

  useEffect(() => {
    if (!aberta) return;
    let ativo = true;
    void carregarCatalogo(`${import.meta.env.BASE_URL}data/catalogo-equivalencias.json`)
      .then((catalogo) => {
        if (!ativo) return;
        const indice = criarIndiceCatalogo(catalogo);
        const correspondencia = indice.correspondenciaExata(bloco.original.alimentoNome);
        setGrupoPrescrito(correspondencia.tipo === 'unica' ? indice.grupoDaOpcao(correspondencia.opcao.id) : null);
      })
      .catch(() => setGrupoPrescrito(null));
    return () => { ativo = false; };
  }, [aberta, bloco.original.alimentoNome]);

  const usarSugestaoPrescrita = (opcao: OpcaoCatalogo) => {
    const quantidade = opcao.pesoGramas ?? opcao.quantidadeNumerica;
    if (!quantidade || quantidade <= 0) return;
    aoSubstituir({
      alimento: { id: `catalogo:${opcao.id}`, nome: opcao.nomePadronizado },
      quantidade,
      unidade: opcao.pesoGramas ? 'g' : 'porção',
      medidaCaseira: opcao.medidaCaseira && opcao.quantidadeMedidaCaseira
        ? `${formatarNumero(opcao.quantidadeMedidaCaseira, 2)} ${opcao.medidaCaseira}` : null,
    });
  };

  const calculo = useMemo(
    () => (escolhido ? calcularQuantidadeEquivalente(bloco.kcal, escolhido.kcalPor100g) : null),
    [escolhido, bloco.kcal],
  );

  const medidas = useMemo(
    () =>
      escolhido && calculo?.ok
        ? sugerirMedidasCaseiras(calculo.valor, escolhido.porcoesCaseiras)
        : [],
    [escolhido, calculo],
  );

  const fechar = () => {
    setEscolhido(null);
    setMedidaEscolhida(null);
    aoFechar();
  };

  const confirmar = () => {
    if (!escolhido || !calculo?.ok) return;
    aoSubstituir({
      alimento: { id: escolhido.id, nome: escolhido.nome },
      quantidade: calculo.valor,
      unidade: 'g',
      medidaCaseira: medidaEscolhida,
    });
    setEscolhido(null);
    setMedidaEscolhida(null);
  };

  const arredondado = calculo?.ok
    ? arredondarParaExibicao(calculo.valor, configuracoes.arredondamento)
    : null;

  return (
    <Gaveta
      aberta={aberta}
      titulo={escolhido ? 'Confirmar substituição' : 'Substituir alimento'}
      subtitulo={
        <>
          Hoje: <strong>{bloco.atual.alimentoNome}</strong> ·{' '}
          {descreverQuantidade(bloco, configuracoes)} · bloco de{' '}
          <strong>{descreverEnergia(bloco.kcal)}</strong>
        </>
      }
      aoFechar={fechar}
      rodape={
        escolhido ? (
          <>
            <button
              type="button"
              className="botao"
              style={{ flex: 1 }}
              onClick={() => {
                setEscolhido(null);
                setMedidaEscolhida(null);
              }}
            >
              Voltar
            </button>
            <button
              type="button"
              className="botao botao--primario"
              style={{ flex: 1 }}
              onClick={confirmar}
              disabled={!calculo?.ok}
            >
              Substituir
            </button>
          </>
        ) : undefined
      }
    >
      {bloco.origemDasCalorias === 'pendente' ? (
        <p className="nota nota--destaque" style={{ marginBottom: 12 }}>
          Este item ainda está <strong>a conferir</strong>: o bloco não tem calorias definidas, então
          não é possível calcular uma quantidade equivalente. Vincule-o a um alimento da base em
          “Conferir itens” antes de substituir.
        </p>
      ) : null}

      {!escolhido ? (
        <div>
        {grupoPrescrito ? (
          <section aria-labelledby="sugestoes-prescricao-titulo">
            <h3 id="sugestoes-prescricao-titulo">Sugestões da prescrição</h3>
            <p className="nota">Opções autorizadas do grupo “{grupoPrescrito.nome}”. Sem kcal estimadas.</p>
            <ul className="opcoes">
              {grupoPrescrito.opcoes.map((opcao) => (
                <li key={opcao.id}>
                  <button type="button" className="opcao" onClick={() => usarSugestaoPrescrita(opcao)}>
                    <span className="opcao__texto">{opcao.nomePadronizado}
                      <span className="opcao__descricao">
                        {opcao.medidaCaseira ? `${formatarNumero(opcao.quantidadeMedidaCaseira ?? 1, 2)} ${opcao.medidaCaseira}` : `${formatarNumero(opcao.quantidadeNumerica ?? 0, 2)} ${opcao.unidadePrincipal ?? 'porção'}`}
                        {opcao.pesoGramas ? ` · ${formatarNumero(opcao.pesoGramas, 2)} g` : ''}
                        {opcao.observacoes ? ` · ${opcao.observacoes}` : ''}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <h3>Equivalência calórica livre</h3>
        <p className="nota">Busca separada; requer uma base nutricional com kcal por 100 g.</p>
        <SeletorDeAlimento
          repositorio={repositorio}
          aoEscolher={(alimento) => {
            setEscolhido(alimento);
            setMedidaEscolhida(null);
          }}
          aoDescreverResultado={(alimento) => {
            const resultado = calcularQuantidadeEquivalente(bloco.kcal, alimento.kcalPor100g);
            return (
              <span className="resultado__quantidade">
                {resultado.ok
                  ? `${formatarQuantidade(resultado.valor, configuracoes.arredondamento)} g`
                  : '—'}
                <small>{resultado.ok ? 'equivalente' : 'não calculável'}</small>
              </span>
            );
          }}
        />
        </div>
      ) : (
        <div>
          <div className="cartao-info">
            <h3 className="cartao-info__titulo">{escolhido.nome}</h3>
            <dl className="definicoes">
              <dt>Calorias do bloco</dt>
              <dd>
                <strong>{descreverEnergia(bloco.kcal)}</strong> (não mudam)
              </dd>
              <dt>Densidade</dt>
              <dd>{formatarNumero(escolhido.kcalPor100g, 1)} kcal por 100 g</dd>
              <dt>Quantidade</dt>
              <dd>
                {calculo?.ok ? (
                  <>
                    <strong>
                      {arredondado?.ok
                        ? `${formatarNumero(arredondado.valor, configuracoes.arredondamento === 'exato' ? 2 : 0)} g`
                        : '—'}
                    </strong>
                    {arredondado?.ok && Math.abs(arredondado.valor - calculo.valor) > 0.005 ? (
                      <span className="nota"> (exato: {formatarNumero(calculo.valor, 2)} g)</span>
                    ) : null}
                  </>
                ) : (
                  <span style={{ color: 'var(--erro)' }}>{calculo?.erro}</span>
                )}
              </dd>
            </dl>
            <p className="nota" style={{ marginTop: 8 }}>
              {formatarNumero(bloco.kcal, 0)} kcal × 100 ÷ {formatarNumero(escolhido.kcalPor100g, 1)}{' '}
              kcal/100 g
            </p>
          </div>

          {medidas.length > 0 ? (
            <div className="cartao-info">
              <h3 className="cartao-info__titulo">Medida caseira aproximada</h3>
              <p className="nota" style={{ marginBottom: 8 }}>
                São <strong>aproximações</strong> para facilitar o preparo. O cálculo principal
                continua em gramas.
              </p>
              <ul className="opcoes">
                <li>
                  <button
                    type="button"
                    className="opcao"
                    aria-pressed={medidaEscolhida === null}
                    onClick={() => setMedidaEscolhida(null)}
                  >
                    <span className="opcao__icone" aria-hidden="true">
                      {medidaEscolhida === null ? '◉' : '○'}
                    </span>
                    <span className="opcao__texto">
                      Somente em gramas
                      <span className="opcao__descricao">Não mostrar medida caseira no cartão</span>
                    </span>
                  </button>
                </li>
                {medidas.map((medida) => (
                  <li key={medida.medida}>
                    <button
                      type="button"
                      className="opcao"
                      aria-pressed={medidaEscolhida === medida.texto}
                      onClick={() => setMedidaEscolhida(medida.texto)}
                    >
                      <span className="opcao__icone" aria-hidden="true">
                        {medidaEscolhida === medida.texto ? '◉' : '○'}
                      </span>
                      <span className="opcao__texto">
                        {medida.texto}
                        <span className="opcao__descricao">
                          ≈ {formatarNumero(medida.gramasEquivalentes, 1)} g
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </Gaveta>
  );
}
