/**
 * Front matter do Markdown de importação.
 *
 * Um bloco YAML simples (só `chave: valor`) no topo do arquivo, delimitado por
 * `---`, identifica o PLANO ao qual o arquivo pertence:
 *
 *   ---
 *   equivaleVersion: 1
 *   planId: dias-uteis
 *   planName: Dias úteis
 *   suggestedDays: seg, ter, qua, qui, sex
 *   ---
 *
 * Tudo é opcional: um arquivo sem front matter continua importável e vira um
 * plano novo. O `planId` é o que permite ao usuário escolher SUBSTITUIR um
 * plano existente em vez de criar outro — e nunca substitui sozinho.
 */

import type { DiaDaSemana } from '../domain/types';
import { DIAS_DA_SEMANA } from '../domain/types';
import { lerNumero, normalizar } from '../domain/texto';
import type { OcorrenciaDaAnalise } from './analisadorMarkdown';

/** Versão do contrato de metadados que o Equivale escreve e entende. */
export const VERSAO_DOS_METADADOS = 1;

export interface MetadadosDoPlano {
  /** Versão do formato de metadados declarada no arquivo. */
  equivaleVersion: number | null;
  /** Identificador estável do plano, escolhido por quem escreveu o arquivo. */
  planId: string | null;
  planName: string | null;
  suggestedDays: DiaDaSemana[];
}

export interface FrontMatterLido {
  metadados: MetadadosDoPlano;
  /**
   * Conteúdo sem o front matter, com o bloco trocado por linhas em branco —
   * assim os números de linha dos avisos e erros continuam batendo com o
   * arquivo que o usuário tem na mão.
   */
  corpo: string;
  /** `true` quando o arquivo realmente trazia um bloco de metadados. */
  presente: boolean;
  avisos: OcorrenciaDaAnalise[];
}

const APELIDOS_DE_DIA: Record<string, DiaDaSemana> = {
  dom: 'domingo',
  domingo: 'domingo',
  seg: 'segunda',
  segunda: 'segunda',
  'segunda feira': 'segunda',
  ter: 'terca',
  terca: 'terca',
  'terca feira': 'terca',
  qua: 'quarta',
  quarta: 'quarta',
  'quarta feira': 'quarta',
  qui: 'quinta',
  quinta: 'quinta',
  'quinta feira': 'quinta',
  sex: 'sexta',
  sexta: 'sexta',
  'sexta feira': 'sexta',
  sab: 'sabado',
  sabado: 'sabado',
};

/** Também aceitamos “1..7” (1 = domingo), como em várias planilhas. */
const POR_NUMERO: Record<number, DiaDaSemana> = {
  1: 'domingo',
  2: 'segunda',
  3: 'terca',
  4: 'quarta',
  5: 'quinta',
  6: 'sexta',
  7: 'sabado',
};

function interpretarDia(bruto: string): DiaDaSemana | null {
  const chave = normalizar(bruto);
  if (!chave) return null;
  if (APELIDOS_DE_DIA[chave]) return APELIDOS_DE_DIA[chave];
  const numero = lerNumero(chave);
  if (numero !== null && Number.isInteger(numero)) return POR_NUMERO[numero] ?? null;
  return null;
}

/** Lê "seg, ter, qua", "segunda-feira; sexta", "seg ter qua", "2 3 4 5 6". */
export function interpretarDiasSugeridos(bruto: string): {
  dias: DiaDaSemana[];
  naoReconhecidos: string[];
} {
  const encontrados = new Set<DiaDaSemana>();
  const naoReconhecidos: string[] = [];

  const partes = bruto
    .replace(/^\[|\]$/g, '')
    .split(/[,;|/]+/)
    .map((parte) => parte.trim())
    .filter((parte) => parte.length > 0);

  for (const parte of partes) {
    const dia = interpretarDia(parte);
    if (dia) {
      encontrados.add(dia);
      continue;
    }
    // "seg ter qua" ou "2 3 4": separado só por espaços. Formas com espaço
    // interno ("segunda feira") já foram resolvidas acima.
    const pedacos = parte.split(/\s+/);
    if (pedacos.length > 1) {
      for (const pedaco of pedacos) {
        const diaDoPedaco = interpretarDia(pedaco);
        if (diaDoPedaco) encontrados.add(diaDoPedaco);
        else naoReconhecidos.push(pedaco);
      }
      continue;
    }
    naoReconhecidos.push(parte);
  }

  return {
    dias: DIAS_DA_SEMANA.filter((dia) => encontrados.has(dia)),
    naoReconhecidos,
  };
}

function limparValor(bruto: string): string {
  const semComentario = bruto.trim();
  // Aspas simples ou duplas envolvendo todo o valor são opcionais.
  const casamento = semComentario.match(/^(['"])(.*)\1$/);
  return (casamento?.[2] ?? semComentario).trim();
}

const METADADOS_VAZIOS: MetadadosDoPlano = {
  equivaleVersion: null,
  planId: null,
  planName: null,
  suggestedDays: [],
};

/**
 * Separa o front matter do corpo. Nunca lança e nunca invalida o arquivo:
 * metadados problemáticos viram avisos com o número da linha.
 */
export function lerFrontMatter(conteudo: string): FrontMatterLido {
  const normalizado = conteudo.replace(/\r\n?/g, '\n');
  const linhas = normalizado.split('\n');

  // O bloco precisa abrir na primeira linha útil do arquivo.
  let inicio = 0;
  while (inicio < linhas.length && linhas[inicio]?.trim() === '') inicio += 1;
  if (linhas[inicio]?.trim() !== '---') {
    return { metadados: { ...METADADOS_VAZIOS }, corpo: normalizado, presente: false, avisos: [] };
  }

  let fim = -1;
  for (let i = inicio + 1; i < linhas.length; i += 1) {
    if (linhas[i]?.trim() === '---') {
      fim = i;
      break;
    }
  }

  if (fim === -1) {
    return {
      metadados: { ...METADADOS_VAZIOS },
      corpo: normalizado,
      presente: false,
      avisos: [
        {
          linha: inicio + 1,
          mensagem:
            'O bloco de metadados começa com "---" mas não é fechado por outro "---". Ele foi ignorado.',
          conteudo: '---',
        },
      ],
    };
  }

  const avisos: OcorrenciaDaAnalise[] = [];
  const metadados: MetadadosDoPlano = { ...METADADOS_VAZIOS };

  for (let i = inicio + 1; i < fim; i += 1) {
    const linha = linhas[i] ?? '';
    const conteudoDaLinha = linha.trim();
    if (conteudoDaLinha === '' || conteudoDaLinha.startsWith('#')) continue;

    const separador = conteudoDaLinha.indexOf(':');
    if (separador <= 0) {
      avisos.push({
        linha: i + 1,
        mensagem: `Metadado "${conteudoDaLinha}" ignorado: use o formato "chave: valor".`,
        conteudo: conteudoDaLinha,
      });
      continue;
    }

    const chave = conteudoDaLinha.slice(0, separador).trim();
    const valor = limparValor(conteudoDaLinha.slice(separador + 1));
    const chaveNormalizada = normalizar(chave).replace(/\s+/g, '');

    switch (chaveNormalizada) {
      case 'equivaleversion': {
        const numero = lerNumero(valor);
        if (numero === null) {
          avisos.push({
            linha: i + 1,
            mensagem: `"equivaleVersion: ${valor}" não é um número. O metadado foi ignorado.`,
            conteudo: conteudoDaLinha,
          });
        } else {
          metadados.equivaleVersion = numero;
          if (numero > VERSAO_DOS_METADADOS) {
            avisos.push({
              linha: i + 1,
              mensagem: `Os metadados são da versão ${numero}; esta versão do Equivale entende até a ${VERSAO_DOS_METADADOS}. Campos desconhecidos são ignorados.`,
              conteudo: conteudoDaLinha,
            });
          }
        }
        break;
      }
      case 'planid':
        metadados.planId = valor || null;
        break;
      case 'planname':
        metadados.planName = valor || null;
        break;
      case 'suggesteddays': {
        const { dias, naoReconhecidos } = interpretarDiasSugeridos(valor);
        metadados.suggestedDays = dias;
        if (naoReconhecidos.length > 0) {
          avisos.push({
            linha: i + 1,
            mensagem: `Dias não reconhecidos em "suggestedDays": ${naoReconhecidos.join(', ')}. Use seg, ter, qua, qui, sex, sáb, dom.`,
            conteudo: conteudoDaLinha,
          });
        }
        break;
      }
      default:
        avisos.push({
          linha: i + 1,
          mensagem: `Metadado "${chave}" não é reconhecido e foi ignorado.`,
          conteudo: conteudoDaLinha,
        });
    }
  }

  // Troca o bloco por linhas em branco para preservar a numeração das linhas.
  const corpo = linhas.map((linha, i) => (i >= inicio && i <= fim ? '' : linha)).join('\n');

  return { metadados, corpo, presente: true, avisos };
}
