/** Primeira abertura: ainda não há nenhum plano alimentar importado. */

import { NOME_DO_ARQUIVO_MODELO, gerarModeloMarkdown } from '../importacao/modelo';
import { baixarTexto } from '../ui/arquivos';

export interface PropsDoEstadoVazio {
  aoImportar: () => void;
}

export function EstadoVazio({ aoImportar }: PropsDoEstadoVazio) {
  return (
    <div className="vazio">
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
          onClick={() => baixarTexto(NOME_DO_ARQUIVO_MODELO, gerarModeloMarkdown(), 'text/markdown')}
        >
          Baixar modelo
        </button>
      </div>
      <p className="nota" style={{ marginTop: 20 }}>
        O Equivale não cria dietas, não sugere restrição alimentar, não define metas corporais e não
        julga escolhas. Tudo fica no seu aparelho.
      </p>
    </div>
  );
}
