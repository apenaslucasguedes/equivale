/**
 * Ajustes: arredondamento, planos (renomear/excluir/restaurar), backup, dados
 * locais, receitas e lista de substituições (ambas recursos futuros).
 *
 * Arredondamento e base de alimentos são COMPARTILHADOS por todos os planos;
 * restaurar e excluir agem sobre um plano específico.
 */

import { useRef, useState } from 'react';
import type { ModoDeArredondamento, PlanoAlimentar } from '../domain/types';
import { ROTULO_ARREDONDAMENTO, VERSAO_DO_ESQUEMA } from '../domain/types';
import { contarAlteracoes } from '../domain/blocos';
import { descreverDias, planoAtivo } from '../domain/planos';
import { useLoja } from '../estado/contexto';
import {
  interpretarBackup,
  nomeDoArquivoDeBackup,
  serializarBackup,
} from '../backup/backup';
import type { BackupInterpretado } from '../backup/backup';
import { baixarTexto, lerArquivoComoTexto } from '../ui/arquivos';
import { Confirmacao } from '../ui/Confirmacao';
import { Gaveta } from '../ui/Gaveta';
import { descreverData } from '../ui/formatacao';

const MODOS: ModoDeArredondamento[] = ['exato', 'grama', 'multiplo5', 'caseira'];

const DESCRICAO_DO_MODO: Record<ModoDeArredondamento, string> = {
  exato: 'Mostra as casas decimais do cálculo (ex.: 87,42 g).',
  grama: 'Arredonda para a grama mais próxima (ex.: 87 g).',
  multiplo5: 'Arredonda para múltiplos de 5 g (ex.: 85 g).',
  caseira: 'Arredonda em gramas e destaca as medidas caseiras aproximadas.',
};

export interface PropsDosAjustes {
  aoVoltar: () => void;
}

export function TelaAjustes({ aoVoltar }: PropsDosAjustes) {
  const { estado, despachar, alimentos, apagarTudo, nomeDoArmazenamento } = useLoja();
  const entradaDeBackup = useRef<HTMLInputElement>(null);

  const [confirmarRestauracao, setConfirmarRestauracao] = useState(false);
  const [confirmarApagar, setConfirmarApagar] = useState(false);
  const [previaDoBackup, setPreviaDoBackup] = useState<BackupInterpretado | null>(null);
  const [erroDoBackup, setErroDoBackup] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [planoEmRenome, setPlanoEmRenome] = useState<PlanoAlimentar | null>(null);
  const [nomeEditado, setNomeEditado] = useState('');
  const [planoParaExcluir, setPlanoParaExcluir] = useState<PlanoAlimentar | null>(null);

  const ativo = planoAtivo(estado);
  const alteracoes = ativo ? contarAlteracoes(ativo.dietaAtual) : 0;

  const abrirRenome = (plano: PlanoAlimentar) => {
    setPlanoEmRenome(plano);
    setNomeEditado(plano.nome);
  };

  const confirmarRenome = () => {
    if (!planoEmRenome || !nomeEditado.trim()) return;
    despachar({ tipo: 'planoRenomeado', planoId: planoEmRenome.id, nome: nomeEditado });
    setPlanoEmRenome(null);
    setMensagem(`Plano renomeado para “${nomeEditado.trim()}”.`);
  };

  const exportar = () => {
    baixarTexto(nomeDoArquivoDeBackup(estado), serializarBackup(estado), 'application/json');
    setMensagem('Backup gerado. O arquivo foi salvo no seu aparelho.');
  };

  const escolherBackup = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    setErroDoBackup(null);
    setPreviaDoBackup(null);
    try {
      const conteudo = await lerArquivoComoTexto(arquivo);
      const resultado = interpretarBackup(conteudo);
      if (!resultado.ok) {
        setErroDoBackup(resultado.erro);
        return;
      }
      setPreviaDoBackup(resultado.valor);
    } catch (erro) {
      setErroDoBackup(`Não foi possível ler o arquivo: ${(erro as Error).message}`);
    }
  };

  return (
    <div>
      <h1 className="vazio__titulo" style={{ textAlign: 'left' }}>
        Ajustes
      </h1>

      {mensagem ? (
        <div className="faixa faixa--atualizacao" style={{ borderRadius: 12, marginBottom: 12 }}>
          <span className="faixa__texto">{mensagem}</span>
          <button
            type="button"
            className="botao botao--icone"
            onClick={() => setMensagem(null)}
            aria-label="Fechar aviso"
          >
            ✕
          </button>
        </div>
      ) : null}

      <section className="secao">
        <h2 className="secao__titulo">Arredondamento das quantidades</h2>
        <div className="painel">
          {MODOS.map((modo) => (
            <button
              key={modo}
              type="button"
              className="opcao"
              aria-pressed={estado.configuracoes.arredondamento === modo}
              onClick={() => despachar({ tipo: 'definirArredondamento', modo })}
            >
              <span className="opcao__icone" aria-hidden="true">
                {estado.configuracoes.arredondamento === modo ? '◉' : '○'}
              </span>
              <span className="opcao__texto">
                {ROTULO_ARREDONDAMENTO[modo]}
                <span className="opcao__descricao">{DESCRICAO_DO_MODO[modo]}</span>
              </span>
            </button>
          ))}
        </div>
        <p className="nota" style={{ margin: '6px 4px' }}>
          O cálculo interno mantém toda a precisão decimal. O arredondamento vale só para a
          exibição.
        </p>
      </section>

      <section className="secao">
        <h2 className="secao__titulo">
          Planos alimentares ({estado.planos.length})
        </h2>
        <div className="painel">
          {estado.planos.length === 0 ? (
            <div className="opcao" aria-disabled="true" style={{ cursor: 'default' }}>
              <span className="opcao__icone" aria-hidden="true">
                ☰
              </span>
              <span className="opcao__texto">
                Nenhum plano importado
                <span className="opcao__descricao">
                  Importe um arquivo .md para criar o primeiro plano.
                </span>
              </span>
            </div>
          ) : (
            estado.planos.map((plano) => {
              const dias = descreverDias(plano.diasSugeridos);
              const alteracoesDoPlano = contarAlteracoes(plano.dietaAtual);
              return (
                <div className="linha-de-plano" key={plano.id}>
                  <div className="linha-de-plano__info">
                    <span className="linha-de-plano__nome">
                      {plano.nome}
                      {plano.id === estado.planoAtivoId ? (
                        <span className="etiqueta"> ativo</span>
                      ) : null}
                    </span>
                    <span className="linha-de-plano__detalhe">
                      {plano.dietaAtual.blocos.length} itens ·{' '}
                      {plano.dietaAtual.refeicoes.length} refeições ·{' '}
                      {alteracoesDoPlano === 0
                        ? 'sem alterações'
                        : alteracoesDoPlano === 1
                          ? '1 alteração'
                          : `${alteracoesDoPlano} alterações`}
                      {dias ? ` · ${dias}` : ''}
                    </span>
                  </div>
                  <div className="linha-de-plano__acoes">
                    {plano.id === estado.planoAtivoId ? null : (
                      <button
                        type="button"
                        className="botao botao--pequeno"
                        onClick={() => despachar({ tipo: 'planoAtivado', planoId: plano.id })}
                      >
                        Usar
                      </button>
                    )}
                    <button
                      type="button"
                      className="botao botao--pequeno"
                      onClick={() => abrirRenome(plano)}
                    >
                      Renomear
                    </button>
                    <button
                      type="button"
                      className="botao botao--pequeno botao--perigo"
                      onClick={() => setPlanoParaExcluir(plano)}
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <p className="nota" style={{ margin: '6px 4px' }}>
          Cada plano guarda as próprias refeições, itens, movimentações e substituições. Excluir um
          plano não mexe nos outros. A troca entre planos é manual, pelo seletor do cabeçalho — o
          Equivale ainda não troca de plano sozinho conforme o dia da semana.
        </p>

        <div className="painel" style={{ marginTop: 8 }}>
          <button
            type="button"
            className="opcao"
            disabled={alteracoes === 0}
            aria-disabled={alteracoes === 0}
            onClick={() => alteracoes > 0 && setConfirmarRestauracao(true)}
          >
            <span className="opcao__icone" aria-hidden="true">
              ↺
            </span>
            <span className="opcao__texto">
              Restaurar dieta original
              <span className="opcao__descricao">
                {!ativo
                  ? 'Nenhum plano ativo'
                  : alteracoes === 0
                    ? `Nenhum item de “${ativo.nome}” foi alterado até agora`
                    : `Desfaz ${alteracoes === 1 ? '1 alteração' : `${alteracoes} alterações`} de “${ativo.nome}”, sem apagar o plano`}
              </span>
            </span>
          </button>
        </div>
      </section>

      <section className="secao">
        <h2 className="secao__titulo">Backup</h2>
        <div className="painel">
          <button type="button" className="opcao" onClick={exportar}>
            <span className="opcao__icone" aria-hidden="true">
              ⭳
            </span>
            <span className="opcao__texto">
              Exportar backup (JSON)
              <span className="opcao__descricao">
                Todos os planos (dieta original e estado atual de cada um), o plano ativo, os
                vínculos de alimentos e as configurações
              </span>
            </span>
          </button>
          <button
            type="button"
            className="opcao"
            onClick={() => entradaDeBackup.current?.click()}
          >
            <span className="opcao__icone" aria-hidden="true">
              ⭱
            </span>
            <span className="opcao__texto">
              Restaurar backup
              <span className="opcao__descricao">Mostra uma prévia antes de aplicar</span>
            </span>
          </button>
        </div>
        <input
          ref={entradaDeBackup}
          type="file"
          accept="application/json,.json"
          className="visualmente-oculto"
          aria-label="Arquivo de backup JSON"
          onChange={(evento) => {
            void escolherBackup(evento.target.files?.[0]);
            evento.target.value = '';
          }}
        />
        {erroDoBackup ? (
          <div className="faixa faixa--erro" style={{ borderRadius: 12, marginTop: 8 }}>
            <span className="faixa__texto">{erroDoBackup}</span>
          </div>
        ) : null}
      </section>

      <section className="secao">
        <h2 className="secao__titulo">Base de alimentos</h2>
        <div className="painel">
          <button
            type="button"
            className="opcao"
            aria-pressed={estado.configuracoes.modoDemonstracao}
            onClick={() =>
              despachar({
                tipo: 'definirModoDemonstracao',
                ativo: !estado.configuracoes.modoDemonstracao,
              })
            }
          >
            <span className="opcao__icone" aria-hidden="true">
              {estado.configuracoes.modoDemonstracao ? '☑' : '☐'}
            </span>
            <span className="opcao__texto">
              Modo de demonstração
              <span className="opcao__descricao">
                Carrega alimentos fictícios (TEST_ONLY) só para experimentar o aplicativo
              </span>
            </span>
          </button>
        </div>
        <p className="nota" style={{ margin: '6px 4px' }}>
          Base carregada: {alimentos.fonte()} · {alimentos.total()} alimentos.
          {alimentos.total() === 0
            ? ' O Equivale não inclui base nutricional própria e não inventa valores.'
            : ''}
        </p>
      </section>

      <section className="secao">
        <h2 className="secao__titulo">Minhas receitas</h2>
        <div className="painel">
          <div className="opcao" aria-disabled="true" style={{ cursor: 'default' }}>
            <span className="opcao__icone" aria-hidden="true">
              ✎
            </span>
            <span className="opcao__texto">
              Recurso futuro
              <span className="opcao__descricao">
                A estrutura de receitas (ingredientes, peso final, kcal por 100 g e medidas caseiras)
                já existe no modelo de dados e nos testes. O editor ainda não faz parte desta versão.
              </span>
            </span>
          </div>
        </div>
      </section>

      <section className="secao">
        <h2 className="secao__titulo">Lista de substituições da nutricionista</h2>
        <div className="painel">
          <div className="opcao" aria-disabled="true" style={{ cursor: 'default' }}>
            <span className="opcao__icone" aria-hidden="true">
              ⇄
            </span>
            <span className="opcao__texto">
              Recurso futuro
              <span className="opcao__descricao">
                A camada de dados para uma lista própria de trocas (grupos, alimentos, quantidades
                e medidas caseiras) já existe no modelo e nos testes. A importação dessa lista
                ainda não faz parte desta versão — e, quando existir, ela será uma sugestão: não
                vai restringir as substituições por equivalência calórica.
              </span>
            </span>
          </div>
        </div>
      </section>

      <section className="secao">
        <h2 className="secao__titulo">Dados locais</h2>
        <div className="painel">
          <button type="button" className="opcao opcao--perigo" onClick={() => setConfirmarApagar(true)}>
            <span className="opcao__icone" aria-hidden="true">
              ⌫
            </span>
            <span className="opcao__texto">
              Apagar todos os dados locais
              <span className="opcao__descricao">
                Remove TODOS os planos, alterações, vínculos e configurações deste aparelho
              </span>
            </span>
          </button>
        </div>
        <p className="nota" style={{ margin: '6px 4px' }}>
          Armazenamento: {nomeDoArmazenamento} · esquema versão {VERSAO_DO_ESQUEMA}. Nenhum dado sai
          do aparelho: não há login, servidor, telemetria nem banco remoto.
        </p>
      </section>

      <button type="button" className="botao botao--largo" onClick={aoVoltar}>
        Voltar
      </button>

      <Confirmacao
        aberta={confirmarRestauracao}
        titulo="Restaurar dieta original?"
        descricao={
          <>
            Todas as substituições e movimentações de <strong>“{ativo?.nome}”</strong> serão
            desfeitas. O plano continua no aparelho e os outros planos não são afetados — nada é
            apagado.
          </>
        }
        rotuloDeConfirmar="Restaurar"
        aoConfirmar={() => {
          despachar({ tipo: 'restaurarDieta' });
          setConfirmarRestauracao(false);
          setMensagem(`“${ativo?.nome ?? 'Plano'}” restaurado como foi importado.`);
        }}
        aoCancelar={() => setConfirmarRestauracao(false)}
      />

      <Confirmacao
        aberta={planoParaExcluir !== null}
        titulo={`Excluir o plano “${planoParaExcluir?.nome ?? ''}”?`}
        descricao={
          <>
            Só este plano é removido, com os itens e as alterações dele. Os{' '}
            <strong>outros planos continuam intactos</strong>, assim como os vínculos de alimentos e
            as configurações. Esta ação não pode ser desfeita.
          </>
        }
        rotuloDeConfirmar="Excluir plano"
        perigo
        aoConfirmar={() => {
          if (!planoParaExcluir) return;
          despachar({ tipo: 'planoExcluido', planoId: planoParaExcluir.id });
          setMensagem(`Plano “${planoParaExcluir.nome}” excluído.`);
          setPlanoParaExcluir(null);
        }}
        aoCancelar={() => setPlanoParaExcluir(null)}
      />

      <Gaveta
        aberta={planoEmRenome !== null}
        titulo="Renomear plano"
        subtitulo={planoEmRenome?.nome}
        aoFechar={() => setPlanoEmRenome(null)}
        rodape={
          <>
            <button
              type="button"
              className="botao"
              style={{ flex: 1 }}
              onClick={() => setPlanoEmRenome(null)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="botao botao--primario"
              style={{ flex: 1 }}
              disabled={nomeEditado.trim().length === 0}
              onClick={confirmarRenome}
            >
              Salvar
            </button>
          </>
        }
      >
        <label className="campo">
          <span className="campo__rotulo">Nome do plano</span>
          <input
            className="entrada"
            type="text"
            value={nomeEditado}
            onChange={(evento) => setNomeEditado(evento.target.value)}
            placeholder="Ex.: Dias úteis"
          />
        </label>
        <p className="nota">
          O nome é só um rótulo: renomear não altera itens, refeições nem alterações do plano.
        </p>
      </Gaveta>

      <Confirmacao
        aberta={confirmarApagar}
        titulo="Apagar todos os dados locais?"
        descricao="Todos os planos alimentares, as substituições, as movimentações, os vínculos e as configurações serão removidos deste aparelho. Esta ação não pode ser desfeita."
        rotuloDeConfirmar="Apagar tudo"
        perigo
        aoConfirmar={() => {
          void apagarTudo();
          setConfirmarApagar(false);
          setMensagem('Todos os dados locais foram apagados.');
        }}
        aoCancelar={() => setConfirmarApagar(false)}
      />

      <Gaveta
        aberta={previaDoBackup !== null}
        titulo="Restaurar backup"
        subtitulo="Confira antes de aplicar"
        aoFechar={() => setPreviaDoBackup(null)}
        rodape={
          <>
            <button
              type="button"
              className="botao"
              style={{ flex: 1 }}
              onClick={() => setPreviaDoBackup(null)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="botao botao--primario"
              style={{ flex: 1 }}
              onClick={() => {
                if (!previaDoBackup) return;
                despachar({ tipo: 'substituirEstado', estado: previaDoBackup.estado });
                setPreviaDoBackup(null);
                setMensagem('Backup restaurado.');
              }}
            >
              Restaurar
            </button>
          </>
        }
      >
        {previaDoBackup ? (
          <>
            <div className="cartao-info">
              <dl className="definicoes">
                <dt>Planos</dt>
                <dd>{previaDoBackup.previa.quantidadeDePlanos}</dd>
                <dt>Plano ativo</dt>
                <dd>{previaDoBackup.previa.planoAtivo}</dd>
                <dt>Gerado em</dt>
                <dd>{descreverData(previaDoBackup.previa.geradoEm)}</dd>
                <dt>Itens</dt>
                <dd>{previaDoBackup.previa.quantidadeDeBlocos}</dd>
                <dt>Alterações</dt>
                <dd>{previaDoBackup.previa.quantidadeDeAlteracoes}</dd>
                <dt>Vínculos</dt>
                <dd>{previaDoBackup.previa.quantidadeDeVinculos}</dd>
                <dt>Esquema</dt>
                <dd>
                  versão {previaDoBackup.previa.versaoDoEsquema}
                  {previaDoBackup.previa.versaoMigrada
                    ? ` (migrado para ${VERSAO_DO_ESQUEMA})`
                    : ''}
                </dd>
              </dl>
            </div>

            {previaDoBackup.previa.planos.length > 0 ? (
              <div className="cartao-info">
                <h3 className="cartao-info__titulo">Planos no arquivo</h3>
                <ul className="lista-simples">
                  {previaDoBackup.previa.planos.map((plano) => (
                    <li key={plano.id}>
                      {plano.nome}
                      {plano.ativo ? ' (ativo)' : ''} — {plano.quantidadeDeBlocos} itens,{' '}
                      {plano.quantidadeDeRefeicoes} refeições,{' '}
                      {plano.quantidadeDeAlteracoes === 1
                        ? '1 alteração'
                        : `${plano.quantidadeDeAlteracoes} alterações`}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {previaDoBackup.avisos.length > 0 ? (
              <div className="cartao-info">
                <h3 className="cartao-info__titulo">Avisos</h3>
                <ul className="lista-simples">
                  {previaDoBackup.avisos.map((aviso) => (
                    <li key={aviso}>{aviso}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="nota">
              Restaurar troca <strong>toda</strong> a coleção de planos pela do arquivo. Exporte um
              backup antes se quiser guardar o estado atual.
            </p>
          </>
        ) : null}
      </Gaveta>
    </div>
  );
}

