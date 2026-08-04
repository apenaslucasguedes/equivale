import fs from 'node:fs';
import path from 'node:path';

const removerAcentos = (texto) =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const caminhoBase = process.argv[2] ?? 'public/data/alimentos.json';
const caminhoDieta = process.argv[3] ?? null;
const base = JSON.parse(fs.readFileSync(caminhoBase, 'utf8'));
const alimentos = Array.isArray(base.alimentos) ? base.alimentos : [];
const indice = new Map();
for (const alimento of alimentos) {
  for (const texto of [alimento.nome, ...(Array.isArray(alimento.aliases) ? alimento.aliases : [])]) {
    if (typeof texto !== 'string') continue;
    const chave = removerAcentos(texto);
    const lista = indice.get(chave) ?? [];
    if (!lista.some((opcao) => opcao.id === alimento.id)) {
      lista.push({ id: alimento.id, nome: alimento.nome });
    }
    indice.set(chave, lista);
  }
}

const itens = caminhoDieta
  ? fs
      .readFileSync(caminhoDieta, 'utf8')
      .split(/\r?\n/)
      .map((linha, indiceDaLinha) => ({ linha: indiceDaLinha + 1, texto: linha.trim() }))
      .filter(({ texto }) => /^[-*+]\s+/.test(texto) && texto.includes('|'))
      .map(({ linha, texto }) => ({ linha, nome: texto.replace(/^[-*+]\s+/, '').split('|')[0].trim() }))
  : [];

const resultado = {
  geradoEm: new Date().toISOString(),
  base: path.normalize(caminhoBase),
  fonte: typeof base.fonte === 'string' ? base.fonte : 'não informada',
  quantidadeDeAlimentos: alimentos.length,
  idsDuplicados: [...new Set(alimentos.map(({ id }) => id))]
    .filter((id) => alimentos.filter((alimento) => alimento.id === id).length > 1),
  valoresAusentes: alimentos
    .filter((alimento) =>
      !alimento.id || !alimento.nome || !alimento.fonte || !alimento.codigoDaFonte || !alimento.atualizadoEm,
    )
    .map(({ id, nome }) => ({ id, nome })),
  valoresCaloricosInvalidos: alimentos
    .filter(({ kcalPor100g }) =>
      typeof kcalPor100g !== 'number' || !Number.isFinite(kcalPor100g) || kcalPor100g < 0,
    )
    .map(({ id, nome, kcalPor100g }) => ({ id, nome, kcalPor100g })),
  medidasCaseirasDisponiveis: alimentos.reduce(
    (total, alimento) => total + (Array.isArray(alimento.porcoesCaseiras) ? alimento.porcoesCaseiras.length : 0),
    0,
  ),
  dieta: caminhoDieta ? path.normalize(caminhoDieta) : null,
  itensSemCorrespondencia: itens.filter(({ nome }) => !indice.has(removerAcentos(nome))),
  correspondenciasAmbiguas: itens
    .map((item) => ({ ...item, opcoes: indice.get(removerAcentos(item.nome)) ?? [] }))
    .filter(({ opcoes }) => opcoes.length > 1),
  chavesAmbiguasNaBase: [...indice.entries()]
    .filter(([, opcoes]) => opcoes.length > 1)
    .map(([chave, opcoes]) => ({ chave, opcoes })),
};

process.stdout.write(`${JSON.stringify(resultado, null, 2)}\n`);
