/** Detalhes do bloco: o que foi prescrito, o que está valendo agora. */

import type { BlocoCalorico, Configuracoes, Refeicao } from '../domain/types';
import { foiMovido, foiSubstituido } from '../domain/blocos';
import { Gaveta } from './Gaveta';
import { descreverEnergia, descreverQuantidade, descreverQuantidadeOriginal } from './formatacao';

const ROTULO_ORIGEM: Record<BlocoCalorico['origemDasCalorias'], string> = {
  informada: 'informada no arquivo importado',
  calculada: 'calculada pela base de alimentos',
  pendente: 'ainda não definida — item a conferir',
};

export interface PropsDosDetalhes {
  aberta: boolean;
  bloco: BlocoCalorico;
  refeicoes: Refeicao[];
  configuracoes: Configuracoes;
  aoFechar: () => void;
}

export function GavetaDeDetalhes({
  aberta,
  bloco,
  refeicoes,
  configuracoes,
  aoFechar,
}: PropsDosDetalhes) {
  const nomeDaRefeicao = (id: string) => refeicoes.find((r) => r.id === id)?.nome ?? id;
  const substituido = foiSubstituido(bloco);
  const movido = foiMovido(bloco);

  return (
    <Gaveta aberta={aberta} titulo="Detalhes do item" aoFechar={aoFechar}>
      <div className="cartao-info">
        <h3 className="cartao-info__titulo">Agora</h3>
        <dl className="definicoes">
          <dt>Alimento</dt>
          <dd>{bloco.atual.alimentoNome}</dd>
          <dt>Quantidade</dt>
          <dd>{descreverQuantidade(bloco, configuracoes)}</dd>
          <dt>Refeição</dt>
          <dd>{nomeDaRefeicao(bloco.atual.refeicaoId)}</dd>
        </dl>
      </div>

      <div className="cartao-info">
        <h3 className="cartao-info__titulo">Como foi prescrito</h3>
        <dl className="definicoes">
          <dt>Alimento</dt>
          <dd>{bloco.original.alimentoNome}</dd>
          <dt>Quantidade</dt>
          <dd>{descreverQuantidadeOriginal(bloco)}</dd>
          <dt>Refeição</dt>
          <dd>{nomeDaRefeicao(bloco.original.refeicaoId)}</dd>
        </dl>
      </div>

      <div className="cartao-info">
        <h3 className="cartao-info__titulo">Bloco calórico</h3>
        <dl className="definicoes">
          <dt>Energia fixa</dt>
          <dd>{descreverEnergia(bloco.kcal)}</dd>
          <dt>Origem</dt>
          <dd>{ROTULO_ORIGEM[bloco.origemDasCalorias]}</dd>
          {bloco.origemDasCalorias === 'pendente' ? (
            <>
              <dt>Pendência</dt>
              <dd>{bloco.motivoPendencia ?? 'Calorias pendentes'}</dd>
            </>
          ) : null}
          <dt>Alterações</dt>
          <dd>
            {substituido || movido
              ? [substituido ? 'alimento substituído' : null, movido ? 'movido de refeição' : null]
                  .filter(Boolean)
                  .join(' · ')
              : 'nenhuma'}
          </dd>
        </dl>
        <p className="nota" style={{ marginTop: 8 }}>
          As calorias deste bloco não mudam ao substituir o alimento nem ao mover entre refeições.
        </p>
      </div>

      {bloco.observacao ? (
        <div className="cartao-info">
          <h3 className="cartao-info__titulo">Observação da dieta</h3>
          <p style={{ margin: 0, fontSize: 14 }}>{bloco.observacao}</p>
        </div>
      ) : null}
    </Gaveta>
  );
}
