/**
 * Tela principal: as refeições do PLANO ATIVO, com arrastar e soltar e as
 * gavetas de ação. Só aparecem as refeições que existem na dieta do plano.
 *
 * Toda ação daqui vale exclusivamente para o plano ativo — os demais planos
 * mantêm as próprias refeições, itens, movimentações e substituições.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type {
  CollisionDetection,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import type { Alimento, BlocoCalorico } from '../domain/types';
import { blocosDaRefeicao, refeicoesOrdenadas, somaDeCalorias } from '../domain/blocos';
import type { DadosDaSubstituicao } from '../domain/blocos';
import { planoAtivo } from '../domain/planos';
import { useLoja } from '../estado/contexto';
import { BlocoDeRefeicao, PREFIXO_DESTINO } from '../ui/BlocoDeRefeicao';
import { CartaoDeItem, PREFIXO_ITEM_DESTINO } from '../ui/CartaoDeItem';
import { GavetaDeAcoes } from '../ui/GavetaDeAcoes';
import type { AcaoDoItem } from '../ui/GavetaDeAcoes';
import { GavetaDeMover } from '../ui/GavetaDeMover';
import { GavetaDeDetalhes } from '../ui/GavetaDeDetalhes';
import { GavetaDeSubstituicao } from '../ui/GavetaDeSubstituicao';
import { GavetaDeConferencia } from '../ui/GavetaDeConferencia';
import { GavetaDeConsumo } from '../ui/GavetaDeConsumo';
import { Confirmacao } from '../ui/Confirmacao';
import { novoId } from '../domain/identificadores';
import { normalizar } from '../domain/texto';
import { formatarNumero } from '../domain/texto';

type GavetaAberta = 'acoes' | 'substituir' | 'ajustar' | 'adicionar' | 'remover' | 'mover' | 'detalhes' | 'conferir' | null;

interface MovimentoParaDesfazer {
  blocoId: string;
  refeicaoId: string;
  posicao: number;
}

const coordenadasPorTeclado: KeyboardCoordinateGetter = (evento, { currentCoordinates }) => {
  const passo = 80;
  if (evento.code === 'ArrowDown') return { ...currentCoordinates, y: currentCoordinates.y + passo };
  if (evento.code === 'ArrowUp') return { ...currentCoordinates, y: currentCoordinates.y - passo };
  if (evento.code === 'ArrowRight') return { ...currentCoordinates, x: currentCoordinates.x + passo };
  if (evento.code === 'ArrowLeft') return { ...currentCoordinates, x: currentCoordinates.x - passo };
  return undefined;
};

const detectarDestino: CollisionDetection = (argumentos) => {
  const sobPonteiro = pointerWithin(argumentos);
  return sobPonteiro.length > 0 ? sobPonteiro : closestCenter(argumentos);
};

export interface PropsDaTelaInicio {
  aoAbrirImportacao: () => void;
}

export function TelaInicio({ aoAbrirImportacao }: PropsDaTelaInicio) {
  const { estado, despachar, alimentos } = useLoja();
  const plano = planoAtivo(estado);
  const dieta = plano?.dietaAtual ?? null;

  const [blocoAtivoId, setBlocoAtivoId] = useState<string | null>(null);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [gaveta, setGaveta] = useState<GavetaAberta>(null);
  const [refeicaoParaAdicionar, setRefeicaoParaAdicionar] = useState<string | null>(null);
  const [movimentoParaDesfazer, setMovimentoParaDesfazer] = useState<MovimentoParaDesfazer | null>(
    null,
  );
  const ultimoDestinoId = useRef<string | null>(null);

  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: coordenadasPorTeclado }),
  );

  const refeicoes = useMemo(() => (dieta ? refeicoesOrdenadas(dieta) : []), [dieta]);
  const selecionado = useMemo(
    () => dieta?.blocos.find((b) => b.id === selecionadoId) ?? null,
    [dieta, selecionadoId],
  );
  const blocoArrastado = useMemo(
    () => dieta?.blocos.find((b) => b.id === blocoAtivoId) ?? null,
    [dieta, blocoAtivoId],
  );
  const pendentes = useMemo(
    () => dieta?.blocos.filter((b) => b.origemDasCalorias === 'pendente') ?? [],
    [dieta],
  );

  useEffect(() => {
    if (!movimentoParaDesfazer) return;
    const identificador = window.setTimeout(() => setMovimentoParaDesfazer(null), 5000);
    return () => window.clearTimeout(identificador);
  }, [movimentoParaDesfazer]);

  if (!dieta) return null;

  const abrirItem = (bloco: BlocoCalorico, destino: GavetaAberta) => {
    setSelecionadoId(bloco.id);
    setGaveta(destino);
  };

  const fechar = () => {
    setGaveta(null);
    setSelecionadoId(null);
    setRefeicaoParaAdicionar(null);
  };

  const escolherAcao = (acao: AcaoDoItem) => {
    if (!selecionado) return;
    if (acao === 'restaurar') {
      despachar({ tipo: 'restaurarBloco', blocoId: selecionado.id });
      fechar();
      return;
    }
    if (acao === 'remover') {
      setGaveta('remover');
      return;
    }
    setGaveta(acao === 'detalhes' ? 'detalhes' : acao);
  };

  const aoIniciarArraste = (evento: DragStartEvent) => {
    ultimoDestinoId.current = null;
    setMovimentoParaDesfazer(null);
    setBlocoAtivoId(String(evento.active.id));
  };

  const aoPassarSobreDestino = (evento: DragOverEvent) => {
    ultimoDestinoId.current = typeof evento.over?.id === 'string' ? evento.over.id : null;
  };

  const aoTerminarArraste = (evento: DragEndEvent) => {
    setBlocoAtivoId(null);
    const blocoId = String(evento.active.id);
    const bloco = dieta.blocos.find((item) => item.id === blocoId);
    const destino = typeof evento.over?.id === 'string' ? evento.over.id : ultimoDestinoId.current;
    ultimoDestinoId.current = null;
    if (!bloco) return;
    if (typeof destino !== 'string') return;

    const origemId = bloco.atual.refeicaoId;
    const posicaoOriginal = blocosDaRefeicao(dieta, origemId).findIndex((item) => item.id === blocoId);

    if (destino.startsWith(PREFIXO_ITEM_DESTINO)) {
      const alvoId = destino.slice(PREFIXO_ITEM_DESTINO.length);
      const alvo = dieta.blocos.find((item) => item.id === alvoId);
      if (!alvo || alvo.id === blocoId) return;
      const posicao = blocosDaRefeicao(dieta, alvo.atual.refeicaoId).findIndex(
        (item) => item.id === alvo.id,
      );
      if (alvo.atual.refeicaoId === origemId && posicao === posicaoOriginal) return;

      // Os dois casos usam a operação de domínio persistida, sem uma lista
      // paralela exclusiva do drag and drop.
      if (alvo.atual.refeicaoId === origemId) {
        despachar({ tipo: 'moverBloco', blocoId, refeicaoId: origemId, posicao });
      } else {
        despachar({ tipo: 'moverBloco', blocoId, refeicaoId: alvo.atual.refeicaoId, posicao });
      }
      setMovimentoParaDesfazer({ blocoId, refeicaoId: origemId, posicao: posicaoOriginal });
      return;
    }
    if (!destino.startsWith(PREFIXO_DESTINO)) return;
    const refeicaoId = destino.slice(PREFIXO_DESTINO.length);
    if (refeicaoId === origemId) return;
    despachar({ tipo: 'moverBloco', blocoId, refeicaoId });
    setMovimentoParaDesfazer({ blocoId, refeicaoId: origemId, posicao: posicaoOriginal });
  };

  const substituir = (dados: DadosDaSubstituicao) => {
    if (!selecionado) return;
    despachar({ tipo: 'substituirAlimento', blocoId: selecionado.id, dados });
    fechar();
  };

  const vincular = (bloco: BlocoCalorico, alimento: Alimento, kcal: number) => {
    despachar({
      tipo: 'resolverPendencia',
      blocoId: bloco.id,
      alimentoId: alimento.id,
      nome: alimento.nome,
      kcal,
    });
    despachar({
      tipo: 'registrarVinculo',
      vinculo: {
        textoNormalizado: normalizar(bloco.original.alimentoNome),
        textoOriginal: bloco.original.alimentoNome,
        alimentoId: alimento.id,
        criadoEm: new Date().toISOString(),
      },
    });
    fechar();
  };

  const total = somaDeCalorias(dieta.blocos);
  const totalPrescrito = somaDeCalorias(plano?.dietaOriginal.blocos ?? []);
  const diferenca = total - totalPrescrito;

  return (
    <>
      {pendentes.length > 0 ? (
        <div className="faixa faixa--demonstracao faixa--pendencias" role="status">
          <span aria-hidden="true">⚑</span>
          <span className="faixa__texto">
            {pendentes.length === 1
              ? '1 item ficou a conferir'
              : `${pendentes.length} itens ficaram a conferir`}
            : sem calorias definidas. Toque no item marcado como “a conferir” para vinculá-lo.
          </span>
        </div>
      ) : null}

      <DndContext
        sensors={sensores}
        collisionDetection={detectarDestino}
        onDragStart={aoIniciarArraste}
        onDragOver={aoPassarSobreDestino}
        onDragCancel={() => {
          ultimoDestinoId.current = null;
          setBlocoAtivoId(null);
        }}
        onDragEnd={aoTerminarArraste}
      >
        <div className="refeicoes">
          {refeicoes.map((refeicao) => (
            <BlocoDeRefeicao
              key={refeicao.id}
              refeicao={refeicao}
              blocos={blocosDaRefeicao(dieta, refeicao.id)}
              configuracoes={estado.configuracoes}
              aoAbrirItem={(bloco) => abrirItem(bloco, bloco.origemDasCalorias === 'pendente' ? 'conferir' : 'substituir')}
              aoAbrirAcoesDoItem={(bloco) => abrirItem(bloco, 'acoes')}
              aoAdicionarAlimento={(refeicaoId) => { setRefeicaoParaAdicionar(refeicaoId); setGaveta('adicionar'); }}
              arrastando={blocoAtivoId !== null}
            />
          ))}
        </div>

        {/* Sem animação de soltura: se a aba estiver em segundo plano a
            animação não termina e o cartão flutuante fica preso na tela. */}
        <DragOverlay dropAnimation={null}>
          {blocoArrastado ? (
            <CartaoDeItem
              bloco={blocoArrastado}
              configuracoes={estado.configuracoes}
              aoAtivar={() => undefined}
              aoAbrirAcoes={() => undefined}
              estatico
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {movimentoParaDesfazer ? (
        <div className="feedback-movimento" role="status">
          <span>Alimento movido.</span>
          <button
            type="button"
            onClick={() => {
              despachar({ tipo: 'moverBloco', ...movimentoParaDesfazer });
              setMovimentoParaDesfazer(null);
            }}
          >
            Desfazer
          </button>
        </div>
      ) : null}

      <section className={`resumo-calorico ${diferenca > 0 ? 'resumo-calorico--acima' : 'resumo-calorico--dentro'}`} aria-label="Resumo de calorias do dia">
        <div><span>Hoje</span><strong>{formatarNumero(total, 0)} kcal</strong></div>
        <div><span>Prescrito: {formatarNumero(totalPrescrito, 0)} kcal</span><strong>{formatarNumero(totalPrescrito, 0)} kcal</strong></div>
        <p>{diferenca === 0 ? 'Você está exatamente no valor prescrito.' : diferenca > 0 ? `${formatarNumero(diferenca, 0)} kcal acima do prescrito.` : `${formatarNumero(Math.abs(diferenca), 0)} kcal abaixo do prescrito.`}</p>
      </section>
      <p className="rodape-discreto">
        Comparação informativa com a dieta importada. O Equivale não define metas nem julga escolhas.
        <br />
        <button
          type="button"
          className="botao botao--discreto botao--pequeno"
          onClick={aoAbrirImportacao}
        >
          Importar outro plano
        </button>
      </p>

      {selecionado ? (
        <>
          <GavetaDeAcoes
            aberta={gaveta === 'acoes'}
            bloco={selecionado}
            configuracoes={estado.configuracoes}
            aoEscolher={escolherAcao}
            aoFechar={fechar}
          />
          <GavetaDeSubstituicao
            aberta={gaveta === 'substituir'}
            bloco={selecionado}
            repositorio={alimentos}
            configuracoes={estado.configuracoes}
            aoSubstituir={substituir}
            aoFechar={fechar}
          />
          <GavetaDeMover
            aberta={gaveta === 'mover'}
            bloco={selecionado}
            refeicoes={refeicoes}
            posicaoAtual={blocosDaRefeicao(dieta, selecionado.atual.refeicaoId).findIndex(
              (bloco) => bloco.id === selecionado.id,
            )}
            totalNaRefeicao={blocosDaRefeicao(dieta, selecionado.atual.refeicaoId).length}
            aoReordenar={(posicao) => {
              despachar({
                tipo: 'moverBloco',
                blocoId: selecionado.id,
                refeicaoId: selecionado.atual.refeicaoId,
                posicao,
              });
              fechar();
            }}
            aoMover={(refeicaoId) => {
              despachar({ tipo: 'moverBloco', blocoId: selecionado.id, refeicaoId });
              fechar();
            }}
            aoFechar={fechar}
          />
          <GavetaDeDetalhes
            aberta={gaveta === 'detalhes'}
            bloco={selecionado}
            refeicoes={refeicoes}
            configuracoes={estado.configuracoes}
            aoFechar={fechar}
          />
          <GavetaDeConferencia
            aberta={gaveta === 'conferir'}
            bloco={selecionado}
            repositorio={alimentos}
            aoVincular={(alimento, kcal) => vincular(selecionado, alimento, kcal)}
            aoInformarCalorias={(kcal) => {
              despachar({ tipo: 'definirCalorias', blocoId: selecionado.id, kcal });
              fechar();
            }}
            aoFechar={fechar}
          />
          <GavetaDeConsumo
            aberta={gaveta === 'ajustar'}
            bloco={selecionado}
            refeicoes={refeicoes}
            repositorio={alimentos}
            aoSalvar={(dados) => despachar({ tipo: 'ajustarConsumo', blocoId: selecionado.id, dados })}
            aoFechar={fechar}
          />
          <Confirmacao
            aberta={gaveta === 'remover'}
            titulo="Remover do dia?"
            descricao={`${selecionado.atual.alimentoNome} deixará de contar na soma de hoje. A prescrição original continuará guardada.`}
            rotuloDeConfirmar="Remover do dia"
            aoCancelar={fechar}
            aoConfirmar={() => { despachar({ tipo: 'removerConsumo', blocoId: selecionado.id }); fechar(); }}
          />
        </>
      ) : null}
      <GavetaDeConsumo
        aberta={gaveta === 'adicionar'}
        refeicoes={refeicoes}
        refeicaoInicialId={refeicaoParaAdicionar}
        repositorio={alimentos}
        aoSalvar={(dados) => despachar({ tipo: 'adicionarConsumo', dados: { ...dados, id: novoId('consumo') } })}
        aoFechar={fechar}
      />
    </>
  );
}

