/** Primeira abertura: ainda não há nenhum plano alimentar importado. */

import { NOME_DO_ARQUIVO_MODELO, gerarModeloMarkdown } from '../importacao/modelo';
import { baixarTexto } from '../ui/arquivos';
import { useLoja } from '../estado/contexto';

export interface PropsDoEstadoVazio {
  aoImportar: () => void;
}

export function EstadoVazio({ aoImportar }: PropsDoEstadoVazio) {
  const { alimentos } = useLoja();
  return (
    <div className="vazio">
      <div className="vazio__ilustracao" aria-hidden="true">
        <div className="vazio__trilho vazio__trilho--superior">
          <span className="vazio__peca vazio__peca--azul"><i /><i /></span>
          <span className="vazio__movimento vazio__movimento--direita" />
          <span className="vazio__peca vazio__peca--neutra"><i /><i /><i /></span>
        </div>
        <div className="vazio__trilho vazio__trilho--inferior">
          <span className="vazio__peca vazio__peca--verde"><i /><i /></span>
          <span className="vazio__movimento vazio__movimento--esquerda" />
          <span className="vazio__peca vazio__peca--pequena"><i /></span>
        </div>
      </div>
      <p className="vazio__titulo">Nenhum plano por aqui ainda</p>
      <p className="vazio__texto">
        O Equivale organiza uma dieta que <strong>você já recebeu</strong>. Importe o arquivo em
        Markdown para trocar alimentos por equivalentes calóricos e mover itens entre refeições.
        Cada arquivo vira um <strong>plano</strong>, e você pode manter vários — por exemplo “Dias
        úteis” e “Fim de semana”.
      </p>
      <div className="vazio__acoes">
        <button type="button" className="botao botao--primario botao--largo" onClick={aoImportar}>
          Importar plano (.md)
        </button>
        <button
          type="button"
          className="botao botao--largo"
          onClick={() => baixarTexto(NOME_DO_ARQUIVO_MODELO, gerarModeloMarkdown(alimentos.todos()), 'text/markdown')}
        >
          Baixar modelo
        </button>
      </div>
      <div className="vazio__transparencia">
        <span className="vazio__transparencia-icone" aria-hidden="true" />
        <p className="nota">
          O Equivale não cria dietas, não sugere restrição alimentar, não define metas corporais e não
          julga escolhas. Tudo fica no seu aparelho.
        </p>
      </div>
    </div>
  );
}
