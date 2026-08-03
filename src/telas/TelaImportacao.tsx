/**
 * Importação de plano em Markdown: escolha do arquivo → prévia → conferência
 * dos itens não reconhecidos → decisão explícita entre ADICIONAR como plano
 * novo, SUBSTITUIR um plano existente de mesmo `planId` ou cancelar.
 *
 * Importar NUNCA substitui todos os planos: no máximo um plano é trocado, e
 * só depois de confirmação.
 */

import { useMemo, useRef, useState } from 'react';
import type { Alimento } from '../domain/types';
import { descreverDias } from '../domain/planos';
import { novoId } from '../domain/identificadores';
import { useLoja } from '../estado/contexto';
import { analisarMarkdown } from '../importacao/analisadorMarkdown';
import type { ResultadoDaAnalise } from '../importacao/analisadorMarkdown';
import {
  contarPendentes,
  determinarGramas,
  montarPlano,
  resolverItens,
} from '../importacao/resolucao';
import type { ItemResolvido } from '../importacao/resolucao';
import { NOME_DO_ARQUIVO_MODELO, gerarModeloMarkdown } from '../importacao/modelo';
import { calcularCaloriasDaQuantidade } from '../domain/equivalencia';
import { formatarNumero, lerNumero, normalizar } from '../domain/texto';
import { baixarTexto, lerArquivoComoTexto } from '../ui/arquivos';
import { Gaveta } from '../ui/Gaveta';
import { Confirmacao } from '../ui/Confirmacao';
import { SeletorDeAlimento } from '../ui/SeletorDeAlimento';

type Etapa = 'escolha' | 'previa' | 'conferencia';

export interface PropsDaImportacao {
  aoConcluir: () => void;
  aoCancelar: () => void;
}

export function TelaImportacao({ aoConcluir, aoCancelar }: PropsDaImportacao) {
  const { estado, despachar, alimentos } = useLoja();
  const entradaDeArquivo = useRef<HTMLInputElement>(null);

  const [etapa, setEtapa] = useState<Etapa>('escolha');
  const [analise, setAnalise] = useState<ResultadoDaAnalise | null>(null);
  const [resolvidos, setResolvidos] = useState<ItemResolvido[]>([]);
  const [erroDeLeitura, setErroDeLeitura] = useState<string | null>(null);
  const [indiceEmConferencia, setIndiceEmConferencia] = useState<number | null>(null);
  const [kcalManual, setKcalManual] = useState('');
  const [confirmarSubstituicao, setConfirmarSubstituicao] = useState(false);

  const pendentes = useMemo(() => contarPendentes(resolvidos), [resolvidos]);

  const planId = analise?.metadados.planId ?? null;
  /** Único plano que a importação pode substituir: o de mesmo `planId`. */
  const planoExistente = useMemo(
    () => (planId ? (estado.planos.find((plano) => plano.id === planId) ?? null) : null),
    [estado.planos, planId],
  );

  const processar = (conteudo: string) => {
    const resultado = analisarMarkdown(conteudo);
    setAnalise(resultado);
    setResolvidos(resolverItens(resultado.itens, alimentos, estado.vinculos));
    setErroDeLeitura(null);
    setEtapa('previa');
  };

  const escolherArquivo = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    if (!/\.(md|markdown|txt)$/i.test(arquivo.name)) {
      setErroDeLeitura('Escolha um arquivo Markdown (.md). Nada foi enviado para a internet.');
      return;
    }
    try {
      processar(await lerArquivoComoTexto(arquivo));
    } catch (erro) {
      setErroDeLeitura(`Não foi possível ler o arquivo: ${(erro as Error).message}`);
    }
  };

  /** Acrescenta um plano novo. Nenhum plano existente é tocado. */
  const adicionarComoNovo = () => {
    if (!analise) return;
    // Reaproveitar o `planId` de um plano que já existe substituiria aquele
    // plano sem o usuário pedir; nesse caso geramos um id local novo.
    const id = planId && !planoExistente ? planId : novoId('plano');
    despachar({ tipo: 'planoAdicionado', plano: montarPlano(analise, resolvidos, { id }) });
    aoConcluir();
  };

  /** Substitui SÓ o plano de mesmo `planId`. Os outros continuam intactos. */
  const substituirExistente = () => {
    if (!analise || !planoExistente) return;
    despachar({
      tipo: 'planoSubstituido',
      plano: montarPlano(analise, resolvidos, { id: planoExistente.id }),
    });
    aoConcluir();
  };

  const itemEmConferencia = indiceEmConferencia === null ? null : resolvidos[indiceEmConferencia];

  const aplicarResolucao = (indice: number, novo: Partial<ItemResolvido>) => {
    setResolvidos((anteriores) =>
      anteriores.map((atual, i) => (i === indice ? { ...atual, ...novo } : atual)),
    );
  };

  const vincularAlimento = (indice: number, alimento: Alimento) => {
    const resolvido = resolvidos[indice];
    if (!resolvido) return;
    const gramas = determinarGramas(resolvido.item, alimentos, alimento.id);
    if (gramas === null) return;
    const calculo = calcularCaloriasDaQuantidade(gramas, alimento.kcalPor100g);
    if (!calculo.ok) return;

    aplicarResolucao(indice, {
      alimentoId: alimento.id,
      kcal: calculo.valor,
      origem: 'calculada',
      motivo: null,
    });
    despachar({
      tipo: 'registrarVinculo',
      vinculo: {
        textoNormalizado: normalizar(resolvido.item.nomeAlimento),
        textoOriginal: resolvido.item.nomeAlimento,
        alimentoId: alimento.id,
        criadoEm: new Date().toISOString(),
      },
    });
    setIndiceEmConferencia(null);
  };

  // ------------------------------------------------------------- etapa 1
  if (etapa === 'escolha') {
    return (
      <div>
        <h1 className="vazio__titulo">Importar plano</h1>
        <p className="vazio__texto" style={{ margin: '0 0 16px' }}>
          Escolha um arquivo <strong>.md</strong> com a dieta que você já recebeu. Cada arquivo vira
          um <strong>plano alimentar</strong> independente — dá para ter “Dias úteis” e “Fim de
          semana” lado a lado. O arquivo é lido aqui no aparelho e não é enviado para nenhum
          servidor.
        </p>

        {erroDeLeitura ? (
          <div className="faixa faixa--erro" style={{ borderRadius: 12, marginBottom: 12 }}>
            <span className="faixa__texto">{erroDeLeitura}</span>
          </div>
        ) : null}

        <div className="vazio__acoes" style={{ maxWidth: 'none' }}>
          <button
            type="button"
            className="botao botao--primario botao--largo"
            onClick={() => entradaDeArquivo.current?.click()}
          >
            Escolher arquivo .md
          </button>
          <input
            ref={entradaDeArquivo}
            type="file"
            accept=".md,.markdown,text/markdown,text/plain"
            className="visualmente-oculto"
            aria-label="Arquivo Markdown da dieta"
            onChange={(evento) => {
              void escolherArquivo(evento.target.files?.[0]);
              evento.target.value = '';
            }}
          />
          <button
            type="button"
            className="botao botao--largo"
            onClick={() => baixarTexto(NOME_DO_ARQUIVO_MODELO, gerarModeloMarkdown(), 'text/markdown')}
          >
            Baixar modelo
          </button>
          <button
            type="button"
            className="botao botao--largo"
            onClick={() => processar(gerarModeloMarkdown())}
          >
            Usar plano de demonstração
          </button>
          <button type="button" className="botao botao--discreto botao--largo" onClick={aoCancelar}>
            Cancelar
          </button>
        </div>

        <p className="nota" style={{ marginTop: 16 }}>
          O formato completo está documentado em <code>docs/import-format.md</code>. O modelo
          baixado já vem comentado com todas as regras.
        </p>
      </div>
    );
  }

  // ---------------------------------------------------- etapas 2 e 3
  if (!analise) return null;

  const itensPorRefeicao = analise.refeicoes.map((refeicao) => ({
    refeicao,
    quantidade: resolvidos.filter((r) => r.item.refeicaoId === refeicao.id).length,
  }));

  const impossivelImportar = resolvidos.length === 0;

  return (
    <div>
      <h1 className="vazio__titulo" style={{ textAlign: 'left' }}>
        {etapa === 'previa' ? 'Prévia da importação' : 'Conferir itens'}
      </h1>

      {etapa === 'previa' ? (
        <>
          <div className="cartao-info">
            <h2 className="cartao-info__titulo">{analise.metadados.planName ?? analise.titulo}</h2>
            <dl className="definicoes">
              <dt>Refeições</dt>
              <dd>{analise.refeicoes.length}</dd>
              <dt>Itens reconhecidos</dt>
              <dd>{resolvidos.length - pendentes}</dd>
              <dt>Itens a conferir</dt>
              <dd>{pendentes}</dd>
              <dt>Avisos</dt>
              <dd>{analise.avisos.length}</dd>
              <dt>Erros</dt>
              <dd>{analise.erros.length}</dd>
            </dl>
          </div>

          <div className="cartao-info">
            <h2 className="cartao-info__titulo">Metadados do plano</h2>
            {analise.temMetadados ? (
              <dl className="definicoes">
                <dt>planId</dt>
                <dd>{analise.metadados.planId ?? '— (plano novo)'}</dd>
                <dt>planName</dt>
                <dd>{analise.metadados.planName ?? '— (usa o título)'}</dd>
                <dt>suggestedDays</dt>
                <dd>{descreverDias(analise.metadados.suggestedDays) || '— (nenhum)'}</dd>
                <dt>equivaleVersion</dt>
                <dd>{analise.metadados.equivaleVersion ?? '— (não informada)'}</dd>
              </dl>
            ) : (
              <p className="nota" style={{ margin: 0 }}>
                O arquivo não traz o bloco de metadados. Ele pode ser importado assim mesmo: vira
                um plano novo. Com <code>planId</code> no arquivo, importações futuras conseguem
                atualizar este plano em vez de criar outro.
              </p>
            )}
            {planoExistente ? (
              <p className="nota nota--destaque" style={{ marginBottom: 0 }}>
                Já existe um plano com este <code>planId</code>: <strong>{planoExistente.nome}</strong>.
                Você pode substituí-lo ou adicionar este arquivo como um plano separado.
              </p>
            ) : null}
            {analise.metadados.suggestedDays.length > 0 ? (
              <p className="nota" style={{ marginBottom: 0 }}>
                Os dias sugeridos são apenas uma anotação: a troca de plano continua manual, pelo
                seletor do cabeçalho.
              </p>
            ) : null}
          </div>

          <div className="cartao-info">
            <h2 className="cartao-info__titulo">Refeições encontradas</h2>
            {itensPorRefeicao.length === 0 ? (
              <p className="nota">Nenhuma refeição com itens.</p>
            ) : (
              <ul className="lista-simples">
                {itensPorRefeicao.map(({ refeicao, quantidade }) => (
                  <li key={refeicao.id}>
                    {refeicao.nome} — {quantidade === 1 ? '1 item' : `${quantidade} itens`}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {analise.erros.length > 0 ? (
            <div className="cartao-info" style={{ borderColor: 'var(--erro)' }}>
              <h2 className="cartao-info__titulo" style={{ color: 'var(--erro)' }}>
                Erros ({analise.erros.length})
              </h2>
              <ul className="lista-simples">
                {analise.erros.map((erro, i) => (
                  <li key={`${erro.linha}-${i}`}>
                    {erro.linha > 0 ? `Linha ${erro.linha}: ` : ''}
                    {erro.mensagem}
                  </li>
                ))}
              </ul>
              <p className="nota">Linhas com erro não viram itens. O resto pode ser importado.</p>
            </div>
          ) : null}

          {analise.avisos.length > 0 ? (
            <div className="cartao-info">
              <h2 className="cartao-info__titulo">Avisos ({analise.avisos.length})</h2>
              <ul className="lista-simples">
                {analise.avisos.map((aviso, i) => (
                  <li key={`${aviso.linha}-${i}`}>
                    {aviso.linha > 0 ? `Linha ${aviso.linha}: ` : ''}
                    {aviso.mensagem}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {impossivelImportar ? (
            <div className="faixa faixa--erro" style={{ borderRadius: 12, marginBottom: 12 }}>
              <span className="faixa__texto">
                Nenhum item pôde ser lido. Confira o formato em docs/import-format.md ou baixe o
                modelo.
              </span>
            </div>
          ) : null}

          <div className="vazio__acoes" style={{ maxWidth: 'none', marginTop: 16 }}>
            {pendentes > 0 ? (
              <button
                type="button"
                className="botao botao--largo"
                onClick={() => setEtapa('conferencia')}
              >
                Conferir {pendentes === 1 ? '1 item' : `${pendentes} itens`}
              </button>
            ) : null}
            <button
              type="button"
              className="botao botao--primario botao--largo"
              disabled={impossivelImportar}
              onClick={adicionarComoNovo}
            >
              {estado.planos.length === 0 ? 'Importar plano' : 'Adicionar como novo plano'}
            </button>
            {planoExistente ? (
              <button
                type="button"
                className="botao botao--largo"
                disabled={impossivelImportar}
                onClick={() => setConfirmarSubstituicao(true)}
              >
                Substituir o plano “{planoExistente.nome}”
              </button>
            ) : null}
            <button
              type="button"
              className="botao botao--discreto botao--largo"
              onClick={() => setEtapa('escolha')}
            >
              Escolher outro arquivo
            </button>
            <button type="button" className="botao botao--discreto botao--largo" onClick={aoCancelar}>
              Cancelar
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="nota nota--destaque" style={{ marginBottom: 12 }}>
            Estes itens não têm calorias no arquivo e não têm correspondência exata na base. Eles
            <strong> não serão descartados</strong>: você pode vinculá-los agora ou depois, pelo
            próprio cartão.
          </p>

          <div className="painel">
            {resolvidos.map((resolvido, indice) =>
              resolvido.origem === 'pendente' ? (
                <div className="linha-conferencia" key={`${resolvido.item.linha}-${indice}`}>
                  <div className="linha-conferencia__titulo">
                    {resolvido.item.nomeAlimento} · {formatarNumero(resolvido.item.quantidade, 2)}{' '}
                    {resolvido.item.unidade}
                  </div>
                  <p className="linha-conferencia__motivo">
                    Linha {resolvido.item.linha}: {resolvido.motivo}
                  </p>
                  <button
                    type="button"
                    className="botao botao--pequeno"
                    onClick={() => {
                      setIndiceEmConferencia(indice);
                      setKcalManual('');
                    }}
                  >
                    Vincular ou informar calorias
                  </button>
                </div>
              ) : null,
            )}
            {pendentes === 0 ? (
              <div className="linha-conferencia">
                <p className="nota" style={{ margin: 0 }}>
                  Todos os itens estão resolvidos.
                </p>
              </div>
            ) : null}
          </div>

          <div className="vazio__acoes" style={{ maxWidth: 'none', marginTop: 16 }}>
            <button
              type="button"
              className="botao botao--primario botao--largo"
              onClick={() => setEtapa('previa')}
            >
              Voltar para a prévia
            </button>
          </div>
        </>
      )}

      <Gaveta
        aberta={itemEmConferencia !== null && itemEmConferencia !== undefined}
        titulo="Vincular item"
        subtitulo={
          itemEmConferencia ? (
            <>
              <strong>{itemEmConferencia.item.nomeAlimento}</strong> ·{' '}
              {formatarNumero(itemEmConferencia.item.quantidade, 2)} {itemEmConferencia.item.unidade}
            </>
          ) : undefined
        }
        aoFechar={() => setIndiceEmConferencia(null)}
      >
        {itemEmConferencia && indiceEmConferencia !== null ? (
          <>
            <h3 className="cartao-info__titulo">Informar as calorias prescritas</h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 16 }}>
              <label className="campo" style={{ flex: 1, marginBottom: 0 }}>
                <span className="campo__rotulo">Calorias (kcal)</span>
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
                disabled={(lerNumero(kcalManual) ?? -1) < 0}
                onClick={() => {
                  const valor = lerNumero(kcalManual);
                  if (valor === null || valor < 0) return;
                  aplicarResolucao(indiceEmConferencia, {
                    kcal: valor,
                    origem: 'informada',
                    motivo: null,
                  });
                  setIndiceEmConferencia(null);
                }}
              >
                Salvar
              </button>
            </div>

            <h3 className="cartao-info__titulo">Ou vincular a um alimento da base</h3>
            <SeletorDeAlimento
              repositorio={alimentos}
              rotuloDaBusca="Pesquisar alimento"
              aoEscolher={(alimento) => vincularAlimento(indiceEmConferencia, alimento)}
              aoDescreverResultado={(alimento) => {
                const gramas = determinarGramas(itemEmConferencia.item, alimentos, alimento.id);
                const calculo =
                  gramas === null ? null : calcularCaloriasDaQuantidade(gramas, alimento.kcalPor100g);
                return (
                  <span className="resultado__quantidade">
                    {calculo?.ok ? `${formatarNumero(calculo.valor, 0)} kcal` : '—'}
                    <small>{calculo?.ok ? 'para este item' : 'sem conversão'}</small>
                  </span>
                );
              }}
            />
          </>
        ) : null}
      </Gaveta>

      <Confirmacao
        aberta={confirmarSubstituicao && planoExistente !== null}
        titulo={`Substituir o plano “${planoExistente?.nome ?? ''}”?`}
        descricao={
          <>
            Só este plano é trocado: os itens, as substituições e as movimentações dele serão
            descartados e trocados pelo conteúdo do arquivo. Os <strong>outros planos continuam
            intactos</strong>. Faça um backup antes se quiser guardar o estado atual.
          </>
        }
        rotuloDeConfirmar="Substituir este plano"
        perigo
        aoConfirmar={() => {
          setConfirmarSubstituicao(false);
          substituirExistente();
        }}
        aoCancelar={() => setConfirmarSubstituicao(false)}
      />
    </div>
  );
}

