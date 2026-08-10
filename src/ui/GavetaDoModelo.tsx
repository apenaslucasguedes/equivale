import { useState } from 'react';
import type { Alimento } from '../domain/types';
import { gerarModeloMarkdown, NOME_DO_ARQUIVO_MODELO } from '../importacao/modelo';
import { baixarTexto } from './arquivos';
import { Gaveta } from './Gaveta';

const PROMPT = `Converta o arquivo da minha dieta para o formato Markdown do Equivale.

Use o arquivo modelo do Equivale como estrutura obrigatória. Preserve exatamente os alimentos, quantidades, medidas, refeições e calorias informados na minha dieta. Não crie alimentos, calorias, metas ou recomendações. Quando algum dado não estiver claro, mantenha o texto original e sinalize o item para conferência. Entregue somente o conteúdo final do arquivo .md.`;

interface Props { aberta: boolean; alimentos: Alimento[]; aoFechar: () => void; aoImportar?: () => void; }

export function GavetaDoModelo({ aberta, alimentos, aoFechar, aoImportar }: Props) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    await navigator.clipboard.writeText(PROMPT);
    setCopiado(true);
  };
  const irParaImportacao = () => { aoFechar(); aoImportar?.(); };
  return (
    <Gaveta aberta={aberta} titulo="Prepare sua dieta com IA" subtitulo="Siga os passos, um de cada vez." aoFechar={aoFechar}>
      <div className="tutorial-ia">
        <section className="tutorial-ia__passo">
          <span className="tutorial-ia__numero">1</span><div><h3>Baixe o modelo do Equivale</h3><p>A IA usará este arquivo como estrutura para converter sua dieta.</p><button type="button" className="botao botao--primario" onClick={() => baixarTexto(NOME_DO_ARQUIVO_MODELO, gerarModeloMarkdown(alimentos), 'text/markdown')}>1. Baixar modelo</button></div>
        </section>
        <section className="tutorial-ia__passo">
          <span className="tutorial-ia__numero">2</span><div><h3>Abra o ChatGPT</h3><p>Envie o modelo que você baixou e também o arquivo ou uma foto legível da sua dieta.</p></div>
        </section>
        <section className="tutorial-ia__passo">
          <span className="tutorial-ia__numero">3</span><div><h3>Copie e envie este pedido</h3><div className="prompt-ia"><p>{PROMPT}</p><button type="button" className="botao botao--pequeno" onClick={() => void copiar()}>{copiado ? '✓ Prompt copiado' : 'Copiar prompt'}</button></div></div>
        </section>
        <section className="tutorial-ia__passo tutorial-ia__passo--final">
          <span className="tutorial-ia__numero">4</span><div><h3>Importe o arquivo pronto</h3><p>Baixe o .md gerado pela IA, confira o conteúdo e volte para importá-lo.</p><button type="button" className="botao botao--primario" onClick={irParaImportacao}>Ir para importar plano</button></div>
        </section>
      </div>
      <p className="nota nota--destaque">A IA deve apenas converter sua dieta, sem inventar alimentos, calorias ou recomendações.</p>
    </Gaveta>
  );
}
