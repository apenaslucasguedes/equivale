import { access, readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const CAMPOS_FRONT_MATTER = ['schemaVersion', 'documentType', 'app', 'title'];
const CAMPOS_NUMERICOS = ['quantidadeNumerica', 'pesoGramas', 'quantidadeMedidaCaseira', 'quantidade', 'multiplicadorPorcaoLista'];
const CAMPOS_PUBLICOS_DA_OPCAO = [
  'id', 'nomePadronizado', 'nomeOriginal', 'aliases', 'preparo',
  'quantidadeNumerica', 'unidadePrincipal', 'pesoGramas',
  'medidaCaseira', 'quantidadeMedidaCaseira', 'observacoes',
];

function erro(mensagem, linha = null) { return { mensagem, linha }; }
function valorYaml(valor) {
  const limpo = valor.trim();
  if (limpo === 'null') return null;
  if (/^-?\d+(?:\.\d+)?$/.test(limpo)) return Number(limpo);
  return limpo.replace(/^(["'])(.*)\1$/, '$2');
}

function frontMatter(markdown, erros) {
  const linhas = markdown.split(/\r?\n/);
  if (linhas[0] !== '---') { erros.push(erro('Front matter ausente ou não iniciado na primeira linha', 1)); return {}; }
  const fim = linhas.indexOf('---', 1);
  if (fim < 0) { erros.push(erro('Front matter não fechado', 1)); return {}; }
  const resultado = {};
  for (let i = 1; i < fim; i += 1) {
    const match = linhas[i].match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (match && match[2] !== '') resultado[match[1]] = valorYaml(match[2]);
  }
  for (const campo of CAMPOS_FRONT_MATTER) if (resultado[campo] === undefined) erros.push(erro(`Front matter: campo essencial ${campo} ausente`));
  if (resultado.schemaVersion !== 1) erros.push(erro('Front matter: schemaVersion deve ser 1'));
  if (resultado.documentType !== 'substitution-catalog') erros.push(erro('Front matter: documentType deve ser substitution-catalog'));
  return resultado;
}

function validarNumero(objeto, campo, linha, erros) {
  const valor = objeto[campo];
  if (valor === undefined || valor === null) return;
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0) erros.push(erro(`${campo} deve ser número finito e maior que zero`, linha));
}

export function compilarCatalogo(markdown, origem = 'incoming/data/catalogo-equivalencias-equivale.md') {
  const erros = [];
  const avisos = [];
  const metadados = frontMatter(markdown, erros);
  const linhas = markdown.split(/\r?\n/);
  const grupos = [];
  const registrosInline = [];
  const ids = new Map();
  const optionIds = new Set();
  const referencias = [];
  const reviewRequired = [];
  let grupo = null;
  let secao = '';

  const registrarId = (id, linha, tipo) => {
    if (typeof id !== 'string' || !id.trim()) { erros.push(erro(`${tipo}: id ausente ou inválido`, linha)); return; }
    if (ids.has(id)) erros.push(erro(`ID global duplicado: ${id} (linhas ${ids.get(id)} e ${linha})`, linha));
    else ids.set(id, linha);
  };

  linhas.forEach((texto, indice) => {
    const linha = indice + 1;
    const h3 = texto.match(/^### (.+?)(?: - Grupo (\d+))?$/);
    if (h3 && h3[2]) {
      grupo = { titulo: h3[1], numero: Number(h3[2]), id: null, nome: null, porcaoBaseId: null, opcoes: [], registros: [] };
      grupos.push(grupo); secao = 'grupo'; return;
    }
    const heading = texto.match(/^#{2,4}\s+(.+)$/);
    if (heading) { secao = heading[1]; if (!/^Opções equivalentes$|^Porções prescritas nos planos$/.test(secao)) grupo = grupo && heading[0].startsWith('####') ? grupo : null; return; }
    if (grupo && secao === 'grupo') {
      const meta = texto.match(/^- (id|nome|nomeOriginal|categoriaFuncional|descricao|porcaoBaseId|regraBase|origem):\s*(.+)$/);
      if (meta) {
        const valor = meta[2].replace(/^`|`$/g, '');
        grupo[meta[1]] = valor === 'null' ? null : valor;
        if (meta[1] === 'id') registrarId(valor, linha, 'grupo');
        return;
      }
    }
    const jsonMatch = texto.match(/^\s*-\s*(\{.*\})\s*$/);
    if (jsonMatch) {
      try {
        const dado = JSON.parse(jsonMatch[1]);
        const registro = { linha, secao, grupoId: grupo?.id ?? null, dado };
        registrosInline.push(registro);
        if (grupo) grupo.registros.push(registro);
        if (grupo && secao === 'Opções equivalentes') {
          grupo.opcoes.push(dado);
          registrarId(dado.id, linha, 'opção');
          if (typeof dado.id === 'string') optionIds.add(dado.id);
          for (const campo of ['nomePadronizado', 'nomeOriginal']) if (typeof dado[campo] !== 'string' || !dado[campo].trim()) erros.push(erro(`Opção ${dado.id ?? '?'}: ${campo} ausente`, linha));
          if (dado.quantidadeNumerica == null || dado.unidadePrincipal == null) avisos.push(erro(`Opção ${dado.id}: quantidade/unidade não informada; requer revisão explícita`, linha));
        } else if (dado.id) registrarId(dado.id, linha, 'registro');
        for (const campo of CAMPOS_NUMERICOS) validarNumero(dado, campo, linha, erros);
        if (dado.optionId) referencias.push({ optionId: dado.optionId, linha });
      } catch (causa) { erros.push(erro(`JSON inline inválido: ${causa.message}`, linha)); }
    }
    const idBloco = texto.match(/^\s*- id:\s*`([^`]+)`/);
    if (idBloco && !(grupo && secao === 'grupo')) registrarId(idBloco[1], linha, 'bloco');
    const mult = texto.match(/multiplicadorPorcaoLista:\s*([^\s]+)/);
    if (mult) validarNumero({ multiplicadorPorcaoLista: valorYaml(mult[1]) }, 'multiplicadorPorcaoLista', linha, erros);
    if (texto.includes('REVIEW_REQUIRED')) reviewRequired.push({ linha, texto: texto.trim() });
  });

  if (!grupos.length) erros.push(erro('Nenhum grupo de equivalência encontrado'));
  const numeros = new Set();
  for (const g of grupos) {
    if (!g.id || !g.nome || !g.porcaoBaseId) erros.push(erro(`Grupo ${g.numero}: estrutura essencial incompleta`));
    if (!g.opcoes.length) erros.push(erro(`Grupo ${g.numero}: nenhuma opção equivalente`));
    if (numeros.has(g.numero)) erros.push(erro(`Conflito estrutural: Grupo ${g.numero} repetido`));
    numeros.add(g.numero);
  }
  for (const ref of referencias) if (!optionIds.has(ref.optionId)) erros.push(erro(`Referência optionId inexistente: ${ref.optionId}`, ref.linha));
  if (!reviewRequired.length && markdown.includes('Itens não resolvidos')) avisos.push(erro('Seção de itens não resolvidos existe, mas nenhum REVIEW_REQUIRED foi coletado'));

  const catalogo = { ...metadados, source: origem, grupos, registrosInline, reviewRequired };
  return { catalogo, erros, avisos };
}

export function gerarRelatorio(resultado) {
  const opcoes = resultado.catalogo.grupos.reduce((total, grupo) => total + grupo.opcoes.length, 0);
  const linhas = ['# Relatório do catálogo de equivalências', '', `- Fonte: \`${resultado.catalogo.source}\``, `- Grupos: **${resultado.catalogo.grupos.length}**`, `- Opções equivalentes: **${opcoes}**`, `- Registros JSON inline preservados: **${resultado.catalogo.registrosInline.length}**`, `- Erros: **${resultado.erros.length}**`, `- Avisos: **${resultado.avisos.length}**`, `- REVIEW_REQUIRED: **${resultado.catalogo.reviewRequired.length}**`, ''];
  for (const [titulo, itens] of [['Erros', resultado.erros], ['Avisos', resultado.avisos], ['REVIEW_REQUIRED', resultado.catalogo.reviewRequired]]) {
    linhas.push(`## ${titulo}`, '');
    if (!itens.length) linhas.push('- Nenhum.');
    else for (const item of itens) linhas.push(`- Linha ${item.linha ?? '—'}: ${item.mensagem ?? item.texto}`);
    linhas.push('');
  }
  linhas.push('## Garantias', '', '- Nenhuma kcal ou estimativa nutricional é adicionada.', '- Números e textos dos objetos JSON inline são serializados sem cálculos ou arredondamentos.', '- Pendências `REVIEW_REQUIRED` permanecem explícitas no JSON e neste relatório.', '');
  return linhas.join('\n');
}

export function sanitizarCatalogo(catalogo) {
  return {
    schemaVersion: catalogo.schemaVersion,
    documentType: catalogo.documentType,
    app: 'Equivale',
    title: 'Catálogo público de equivalências',
    grupos: catalogo.grupos.map((grupo) => ({
      id: grupo.id,
      numero: grupo.numero,
      nome: grupo.nome,
      categoriaFuncional: grupo.categoriaFuncional,
      descricao: grupo.descricao,
      porcaoBaseId: grupo.porcaoBaseId,
      regraBase: grupo.regraBase,
      opcoes: grupo.opcoes.map((opcao) => Object.fromEntries(
        CAMPOS_PUBLICOS_DA_OPCAO
          .filter((campo) => opcao[campo] !== undefined)
          .map((campo) => [campo, opcao[campo]]),
      )),
    })),
  };
}

async function executar() {
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const entrada = path.join(raiz, 'incoming/data/catalogo-equivalencias-equivale.md');
  const saida = path.join(raiz, 'public/data/catalogo-equivalencias.json');
  const entradaLocalDisponivel = await access(entrada).then(() => true, () => false);
  if (!entradaLocalDisponivel) {
    const catalogoPublico = JSON.parse(await readFile(saida, 'utf8'));
    if (catalogoPublico.schemaVersion !== 1 || catalogoPublico.documentType !== 'substitution-catalog' || !Array.isArray(catalogoPublico.grupos)) {
      throw new Error('Catálogo público sanitizado ausente ou inválido.');
    }
    console.log(`Catálogo público sanitizado: ${catalogoPublico.grupos.length} grupos.`);
    return;
  }
  const markdown = await readFile(entrada, 'utf8');
  const resultado = compilarCatalogo(markdown);
  const apenasValidar = process.argv.includes('--validate');
  if (!apenasValidar) {
    await mkdir(path.join(raiz, 'public/data'), { recursive: true });
    await mkdir(path.join(raiz, 'docs'), { recursive: true });
    await writeFile(saida, `${JSON.stringify(sanitizarCatalogo(resultado.catalogo), null, 2)}\n`);
    await writeFile(path.join(raiz, 'docs/catalogo-relatorio.md'), gerarRelatorio(resultado));
  }
  console.log(`Catálogo: ${resultado.catalogo.grupos.length} grupos; ${resultado.catalogo.registrosInline.length} registros inline; ${resultado.catalogo.reviewRequired.length} REVIEW_REQUIRED; ${resultado.erros.length} erros.`);
  if (resultado.erros.length) { for (const item of resultado.erros) console.error(`- linha ${item.linha ?? '—'}: ${item.mensagem}`); process.exitCode = 1; }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await executar();
