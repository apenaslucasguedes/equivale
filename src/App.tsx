/** Casca do aplicativo: cabeçalho compacto, faixas de aviso e navegação simples. */

import { useState } from 'react';
import { useLoja } from './estado/contexto';
import { planoAtivo } from './domain/planos';
import { useAtualizacao } from './pwa/usarAtualizacao';
import { EstadoVazio } from './telas/EstadoVazio';
import { TelaInicio } from './telas/TelaInicio';
import { TelaImportacao } from './telas/TelaImportacao';
import { TelaAjustes } from './telas/TelaAjustes';
import { SeletorDePlano } from './ui/SeletorDePlano';

type Tela = 'inicio' | 'importar' | 'ajustes';

export function App() {
  const { estado, despachar, carregando, alimentos, aviso, descartarAviso } = useLoja();
  const { atualizacaoDisponivel, aplicarAtualizacao, descartar } = useAtualizacao();
  const [tela, setTela] = useState<Tela>('inicio');

  const emDemonstracao = estado.configuracoes.modoDemonstracao || alimentos.somenteParaTeste();
  const plano = planoAtivo(estado);

  return (
    <div className="app">
      <header className="cabecalho">
        {tela !== 'inicio' ? (
          <button
            type="button"
            className="botao botao--icone"
            onClick={() => setTela('inicio')}
            aria-label="Voltar para as refeições"
          >
            ←
          </button>
        ) : null}
        <div className="cabecalho__marca">
          <h1 className="cabecalho__nome">
            <img src={`${import.meta.env.BASE_URL}brand/logo-completo.svg`} alt="Equivale" />
          </h1>
          {estado.planos.length === 0 ? (
            <span className="cabecalho__assinatura">troque, mova, escolha</span>
          ) : null}
        </div>
        <div className="cabecalho__acoes">
          {tela !== 'ajustes' ? (
            <button
              type="button"
              className="botao botao--icone"
              onClick={() => setTela('ajustes')}
              aria-label="Abrir ajustes"
            >
              ⚙
            </button>
          ) : null}
        </div>
        {estado.planos.length > 0 ? (
          <div className="cabecalho__planos">
            <SeletorDePlano
              planos={estado.planos}
              planoAtivoId={estado.planoAtivoId}
              aoTrocar={(planoId) => despachar({ tipo: 'planoAtivado', planoId })}
            />
          </div>
        ) : null}
      </header>

      {emDemonstracao ? (
        <div className="faixa faixa--demonstracao" role="status">
          <span aria-hidden="true">⚠️</span>
          <span className="faixa__texto">
            <strong>Modo de demonstração.</strong> Os alimentos e as calorias exibidos são fictícios
            (TEST_ONLY) e servem só para experimentar o aplicativo. Não use para decidir nada na vida
            real.
          </span>
        </div>
      ) : null}

      {atualizacaoDisponivel ? (
        <div className="faixa faixa--atualizacao" role="status">
          <span className="faixa__texto">Uma nova versão do Equivale está disponível.</span>
          <button type="button" className="botao botao--pequeno" onClick={aplicarAtualizacao}>
            Atualizar
          </button>
          <button
            type="button"
            className="botao botao--icone"
            onClick={descartar}
            aria-label="Agora não"
          >
            ✕
          </button>
        </div>
      ) : null}

      {aviso ? (
        <div className="faixa faixa--erro" role="alert">
          <span className="faixa__texto">{aviso}</span>
          <button
            type="button"
            className="botao botao--icone"
            onClick={descartarAviso}
            aria-label="Fechar aviso"
          >
            ✕
          </button>
        </div>
      ) : null}

      <main className="conteudo">
        {carregando ? (
          <p className="nota" role="status">
            Recuperando seus dados…
          </p>
        ) : tela === 'ajustes' ? (
          <TelaAjustes aoVoltar={() => setTela('inicio')} />
        ) : tela === 'importar' ? (
          <TelaImportacao
            aoConcluir={() => setTela('inicio')}
            aoCancelar={() => setTela('inicio')}
          />
        ) : plano ? (
          <TelaInicio aoAbrirImportacao={() => setTela('importar')} />
        ) : (
          <EstadoVazio aoImportar={() => setTela('importar')} />
        )}
      </main>
    </div>
  );
}

