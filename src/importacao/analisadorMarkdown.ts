/**
 * Analisador do formato de importação em Markdown.
 *
 * O formato completo está documentado em `docs/import-format.md`. Resumo:
 *
 *   ---
 *   equivaleVersion: 1
 *   planId: dias-uteis
 *   planName: Dias úteis
 *   suggestedDays: seg, ter, qua, qui, sex
 *   ---
 *
 *   # Dieta: Nome do plano
 *
 *   ## Café da manhã
 *   - Pão francês | 1 unidade | peso 50 g | 150 kcal | obs: sem manteiga
 *   - Mamão papaia | 100 g | 40 kcal
 *
 * Regras:
 * - O bloco de metadados no topo é opcional e identifica o PLANO (ver
 *   `frontMatter.ts`).
 * - Campo 1 = alimento; campo 2 = quantidade + unidade; demais campos são
 *   nomeados (`peso`, `kcal`, `obs`) e podem vir em qualquer ordem.
 * - Nada é descartado em silêncio: linhas problemáticas viram avisos ou erros
 *   com o número da linha.
 */

import type { Unidade } from '../domain/types';
import { lerNumero, normalizar } from '../domain/texto';
import type { RefeicaoReconhecida } from './refeicoes';
import { ordenarRefeicoes, reconhecerRefeicao } from './refeicoes';
import type { Refeicao } from '../domain/types';
import type { MetadadosDoPlano } from './frontMatter';
import { lerFrontMatter } from './frontMatter';

export interface OcorrenciaDaAnalise {
  linha: number;
  mensagem: string;
  conteudo: string;
}

export interface ItemImportado {
  linha: number;
  refeicaoId: string;
  nomeAlimento: string;
  /** ID exato da base nutricional, quando fornecido pelo modelo/IA. */
  alimentoIdInformado: string | null;
  quantidade: number;
  unidade: Unidade;
  descricaoMedidaOriginal: string | null;
  /** Peso explícito em gramas, quando a unidade não é g/ml. */
  gramas: number | null;
  /** Calorias prescritas informadas no arquivo. */
  kcalInformada: number | null;
  observacao: string | null;
  /** Item prescrito à vontade/livre, sem contabilização calórica. */
  livre: boolean;
}

export interface ResultadoDaAnalise {
  titulo: string;
  /** Metadados do plano lidos no front matter (todos opcionais). */
  metadados: MetadadosDoPlano;
  /** `true` quando o arquivo trazia o bloco de metadados. */
  temMetadados: boolean;
  refeicoes: Refeicao[];
  itens: ItemImportado[];
  avisos: OcorrenciaDaAnalise[];
  erros: OcorrenciaDaAnalise[];
}

const UNIDADES_RECONHECIDAS: Record<string, Unidade> = {
  g: 'g',
  gr: 'g',
  grama: 'g',
  gramas: 'g',
  ml: 'ml',
  mililitro: 'ml',
  mililitros: 'ml',
  un: 'unidade',
  und: 'unidade',
  uni: 'unidade',
  unidade: 'unidade',
  unidades: 'unidade',
  fatia: 'fatia',
  fatias: 'fatia',
  colher: 'colher',
  colheres: 'colher',
  concha: 'concha',
  conchas: 'concha',
  copo: 'copo',
  copos: 'copo',
  porcao: 'porção',
  porcoes: 'porção',
};

function interpretarUnidade(bruto: string): Unidade | null {
  const chave = normalizar(bruto).replace(/\s+/g, ' ').trim();
  if (!chave) return null;
  if (UNIDADES_RECONHECIDAS[chave]) return UNIDADES_RECONHECIDAS[chave];
  // "colher de sopa", "copo americano", "porção pequena"...
  const primeira = chave.split(' ')[0] ?? '';
  return UNIDADES_RECONHECIDAS[primeira] ?? null;
}

interface QuantidadeLida {
  quantidade: number;
  unidade: Unidade;
  descricaoMedidaOriginal: string | null;
}

/** Lê "120 g", "1 unidade", "1,5 colher de sopa", "200ml". */
function lerQuantidade(bruto: string): QuantidadeLida | null {
  const texto = bruto.trim();
  if (['a vontade', 'livre'].includes(normalizar(texto))) {
    return { quantidade: 0, unidade: 'à vontade', descricaoMedidaOriginal: 'à vontade' };
  }
  const casamento = texto.match(/^([\d.,]+)\s*(.*)$/);
  if (!casamento) return null;

  const quantidade = lerNumero(casamento[1] ?? '');
  if (quantidade === null || quantidade < 0) return null;

  const restante = (casamento[2] ?? '').trim();
  const unidade = restante ? (interpretarUnidade(restante) ?? restante) : 'g';

  return { quantidade, unidade, descricaoMedidaOriginal: restante || null };
}

/** Lê "peso 50 g", "peso: 50g", "50 g". Devolve gramas. */
function lerPeso(bruto: string): number | null {
  const texto = bruto.replace(/^peso\s*:?\s*/i, '').trim();
  const casamento = texto.match(/^([\d.,]+)\s*(g|gr|gramas?|ml)?$/i);
  if (!casamento) return null;
  const valor = lerNumero(casamento[1] ?? '');
  return valor !== null && valor >= 0 ? valor : null;
}

/** Lê "250 kcal", "kcal: 250", "250kcal". */
function lerCalorias(bruto: string): number | null {
  const texto = bruto.replace(/^kcal\s*:?\s*/i, '').replace(/kcal$/i, '').trim();
  const valor = lerNumero(texto);
  return valor !== null && valor >= 0 ? valor : null;
}

function ehLinhaIgnoravel(linha: string): boolean {
  const t = linha.trim();
  if (t === '') return true;
  if (t.startsWith('>')) return true; // citação = comentário do modelo
  if (/^[-*_]{3,}$/.test(t)) return true; // linha horizontal
  return false;
}

export function analisarMarkdown(conteudo: string): ResultadoDaAnalise {
  const frontMatter = lerFrontMatter(conteudo);

  const avisos: OcorrenciaDaAnalise[] = [...frontMatter.avisos];
  const erros: OcorrenciaDaAnalise[] = [];
  const itens: ItemImportado[] = [];
  const refeicoesVistas: RefeicaoReconhecida[] = [];
  const idsVistos = new Set<string>();

  let titulo = '';
  let refeicaoAtual: RefeicaoReconhecida | null = null;
  let dentroDeBlocoDeCodigo = false;
  let dentroDeComentario = false;

  const linhas = frontMatter.corpo.split('\n');

  linhas.forEach((linhaBruta, indice) => {
    const numeroDaLinha = indice + 1;
    const linha = linhaBruta.trim();

    // Comentários HTML podem ocupar várias linhas (o modelo usa isso).
    if (dentroDeComentario) {
      if (linha.includes('-->')) dentroDeComentario = false;
      return;
    }
    if (linha.includes('<!--')) {
      if (!linha.includes('-->')) dentroDeComentario = true;
      return;
    }

    if (linha.startsWith('```')) {
      dentroDeBlocoDeCodigo = !dentroDeBlocoDeCodigo;
      return;
    }
    if (dentroDeBlocoDeCodigo || ehLinhaIgnoravel(linha)) return;

    // Título da dieta
    if (/^#\s+/.test(linha)) {
      const bruto = linha.replace(/^#\s+/, '').trim();
      titulo = bruto.replace(/^dieta\s*:?\s*/i, '').trim() || bruto;
      return;
    }

    // Refeição
    if (/^#{2,}\s+/.test(linha)) {
      const nome = linha.replace(/^#{2,}\s+/, '').trim();
      const reconhecida = reconhecerRefeicao(nome);
      refeicaoAtual = reconhecida;
      if (!idsVistos.has(reconhecida.id)) {
        idsVistos.add(reconhecida.id);
        refeicoesVistas.push(reconhecida);
      }
      return;
    }

    // Item
    if (/^[-*+]\s+/.test(linha)) {
      const conteudoDoItem = linha.replace(/^[-*+]\s+/, '').trim();

      if (!refeicaoAtual) {
        erros.push({
          linha: numeroDaLinha,
          mensagem: 'Item fora de qualquer refeição. Adicione um título "## Refeição" antes dele.',
          conteudo: conteudoDoItem,
        });
        return;
      }

      const campos = conteudoDoItem
        .split('|')
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

      const nomeAlimento = campos[0] ?? '';
      if (!nomeAlimento) {
        erros.push({
          linha: numeroDaLinha,
          mensagem: 'Item sem nome de alimento.',
          conteudo: conteudoDoItem,
        });
        return;
      }

      const quantidadeBruta = campos[1];
      if (!quantidadeBruta) {
        erros.push({
          linha: numeroDaLinha,
          mensagem: `"${nomeAlimento}": falta a quantidade. Use, por exemplo: ${nomeAlimento} | 100 g | 150 kcal`,
          conteudo: conteudoDoItem,
        });
        return;
      }

      const quantidade = lerQuantidade(quantidadeBruta);
      if (!quantidade) {
        erros.push({
          linha: numeroDaLinha,
          mensagem: `"${nomeAlimento}": não entendi a quantidade "${quantidadeBruta}".`,
          conteudo: conteudoDoItem,
        });
        return;
      }

      let gramas: number | null = null;
      let kcalInformada: number | null = null;
      let observacao: string | null = null;
      let alimentoIdInformado: string | null = null;

      for (const campo of campos.slice(2)) {
        const chave = normalizar(campo);
        if (chave.startsWith('id alimento') || chave.startsWith('alimento id') || chave.startsWith('id ')) {
          alimentoIdInformado = campo
            .replace(/^(id\s*(do\s+)?alimento|alimento\s*id|id)\s*:?\s*/i, '')
            .trim() || null;
        } else if (chave.startsWith('peso')) {
          const peso = lerPeso(campo);
          if (peso === null) {
            avisos.push({
              linha: numeroDaLinha,
              mensagem: `"${nomeAlimento}": peso "${campo}" ignorado (esperado algo como "peso 50 g").`,
              conteudo: conteudoDoItem,
            });
          } else {
            gramas = peso;
          }
        } else if (chave.startsWith('obs')) {
          observacao = campo.replace(/^obs(ervacao|ervação)?\s*:?\s*/i, '').trim() || null;
        } else if (chave.includes('kcal') || chave.includes('cal')) {
          const kcal = lerCalorias(campo);
          if (kcal === null) {
            avisos.push({
              linha: numeroDaLinha,
              mensagem: `"${nomeAlimento}": calorias "${campo}" não reconhecidas.`,
              conteudo: conteudoDoItem,
            });
          } else {
            kcalInformada = kcal;
          }
        } else {
          avisos.push({
            linha: numeroDaLinha,
            mensagem: `"${nomeAlimento}": campo "${campo}" não reconhecido e ignorado.`,
            conteudo: conteudoDoItem,
          });
        }
      }

      if (gramas === null && (quantidade.unidade === 'g' || quantidade.unidade === 'ml')) {
        gramas = quantidade.quantidade;
      }

      itens.push({
        linha: numeroDaLinha,
        refeicaoId: refeicaoAtual.id,
        nomeAlimento,
        alimentoIdInformado,
        quantidade: quantidade.quantidade,
        unidade: quantidade.unidade,
        descricaoMedidaOriginal: quantidade.descricaoMedidaOriginal,
        gramas,
        kcalInformada,
        observacao,
        livre: quantidade.unidade === 'à vontade',
      });
      return;
    }

    // Texto solto: não é erro, mas o usuário precisa saber que não virou item.
    avisos.push({
      linha: numeroDaLinha,
      mensagem: 'Linha ignorada: não é título de refeição nem item de lista.',
      conteudo: linha,
    });
  });

  // Sem "# Dieta: ...", o `planName` dos metadados serve de título.
  if (!titulo && frontMatter.metadados.planName) {
    titulo = frontMatter.metadados.planName;
  }

  if (!titulo) {
    titulo = 'Dieta importada';
    avisos.push({
      linha: 0,
      mensagem:
        'O arquivo não tem um título "# Dieta: ..." nem "planName" nos metadados. Usamos "Dieta importada".',
      conteudo: '',
    });
  }

  if (refeicoesVistas.length === 0) {
    erros.push({
      linha: 0,
      mensagem: 'Nenhuma refeição encontrada. Use títulos de segundo nível, como "## Almoço".',
      conteudo: '',
    });
  }

  return {
    titulo,
    metadados: frontMatter.metadados,
    temMetadados: frontMatter.presente,
    refeicoes: ordenarRefeicoes(refeicoesVistas),
    itens,
    avisos,
    erros,
  };
}
