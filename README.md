# Equivale

**troque, mova, escolha**

Aplicativo web mobile-first (PWA) para **organizar e adaptar uma dieta que já foi
prescrita**. Cada item da dieta vira um **bloco calórico** com energia fixa: você
pode trocar o alimento por outro de quantidade caloricamente equivalente e mover
o bloco entre refeições — sem que as calorias do bloco mudem.

Dá para manter **vários planos alimentares independentes** ao mesmo tempo — por
exemplo “Dias úteis” e “Fim de semana” — e alternar entre eles pelo seletor do
cabeçalho.

O Equivale **não** cria dietas, **não** sugere restrição alimentar, **não** define
metas corporais e **não** julga escolhas.

## O que ele não tem (de propósito)

Sem login. Sem servidor, API externa, telemetria ou banco remoto. Sem marcação de
“refeição feita” ou “alimento consumido”. Sem calendário, diário alimentar,
progresso, metas, déficit calórico, contagem de calorias restantes, histórico de
adesão ou gamificação. Sem troca automática de plano por dia da semana.

Os dias sugeridos de cada plano são só uma anotação vinda da prescrição: trocar
de plano é sempre uma escolha manual.

Tudo — planos, movimentações, substituições, preferências e backups — fica no seu
aparelho, em IndexedDB.

---

## Instalação

Requisitos: **Node.js 20+** (testado no 24) e npm.

```bash
npm install
```

## Execução em desenvolvimento

```bash
npm run dev
```

Abre em `http://localhost:5173`.

## Testes

```bash
npm test
```

Modo interativo:

```bash
npm run test:watch
```

## Verificações de qualidade

```bash
npm run lint
```

```bash
npm run typecheck
```

Tudo de uma vez (lint + tipos + testes + build):

```bash
npm run verificar
```

## Build de produção

```bash
npm run build
```

O resultado fica em `dist/`. Para conferir localmente o build (inclusive o
service worker):

```bash
npm run preview
```

Os ícones são derivados do símbolo oficial em `incoming/brand/equivale-simbolo.svg`:

```bash
npm run icons
```

O script preserva cópias SVG em `public/brand/` e gera favicon PNG, ícones PWA
192×192/512×512 e maskable 512×512 com margem segura. Para trocar a marca,
substitua os dois SVGs em `incoming/brand/`, mantendo os nomes, e rode o comando.

## Catálogo de sugestões da prescrição

`incoming/data/catalogo-equivalencias-equivale.md` é a fonte auditável. O navegador
não interpreta esse Markdown: antes do build, `npm run catalogo:gerar` valida e gera
`public/data/catalogo-equivalencias.json` e `docs/catalogo-relatorio.md`.

```bash
npm run catalogo:validar  # valida sem gravar
npm run catalogo:gerar    # valida e gera JSON + relatório
```

Erros de esquema, IDs duplicados, referências quebradas, grupos/opções inválidos e
conflitos impedem a geração. `REVIEW_REQUIRED` permanece explícito no relatório e
na interface. As **Sugestões da prescrição** preservam porções e relações do
catálogo e não contêm kcal. A **equivalência calórica livre** é outra função e só
opera quando houver base nutricional com `kcalPor100g`; nenhum valor é estimado.
Detalhes: [`docs/catalogo-equivalencias.md`](docs/catalogo-equivalencias.md).

---

## Estrutura de arquivos

```
Equivale/
├─ docs/
│  └─ import-format.md          Formato de importação em Markdown (normativo)
├─ public/
│  ├─ data/alimentos.json       Base nutricional (VAZIA de propósito)
│  └─ icons/                    Ícones PWA provisórios (gerados por script)
├─ scripts/
│  └─ gerar-icones.mjs          Gerador de PNG sem dependências
├─ src/
│  ├─ domain/                   Núcleo puro, sem React
│  │  ├─ types.ts               Modelos: Alimento, BlocoCalorico, Dieta,
│  │  │                         PlanoAlimentar, DiaDaSemana, ...
│  │  ├─ equivalencia.ts        Cálculo de equivalência e arredondamento
│  │  ├─ blocos.ts              Substituir, mover, restaurar (funções puras)
│  │  ├─ planos.ts              Coleção de planos: criar, ativar, renomear,
│  │  │                         substituir, excluir, restaurar
│  │  ├─ listaDeSubstituicoes.ts Lista da nutricionista (camada futura)
│  │  ├─ receitas.ts            Estrutura de receitas (recurso futuro)
│  │  ├─ texto.ts               Normalização sem acentos e números pt-BR
│  │  └─ identificadores.ts
│  ├─ data/alimentos/
│  │  ├─ repositorio.ts         Interface + índice invertido de busca
│  │  ├─ fonte.ts               Carregamento (produção × demonstração)
│  │  └─ TEST_ONLY.fixtures.ts  ⚠️ dados fictícios, só para teste/demonstração
│  ├─ persistencia/
│  │  ├─ armazenamento.ts       Interface desacoplada
│  │  ├─ indexeddb.ts           Implementação IndexedDB (sem bibliotecas)
│  │  ├─ memoria.ts             Implementação em memória (testes/reserva)
│  │  ├─ migracoes.ts           Validação e migração de versão de esquema
│  │  │                         (inclui dieta única → coleção de planos)
│  │  └─ repositorioDeEstado.ts Carregar/salvar/apagar
│  ├─ importacao/
│  │  ├─ analisadorMarkdown.ts  Parser do formato .md
│  │  ├─ frontMatter.ts         Metadados do plano no topo do .md
│  │  ├─ refeicoes.ts           Reconhecimento e ordenação das refeições
│  │  ├─ resolucao.ts           Calorias informadas × calculadas × pendentes
│  │  └─ modelo.ts              Gerador do arquivo "Baixar modelo"
│  ├─ backup/backup.ts          Exportação/restauração JSON com prévia
│  ├─ estado/                   Redutor, contexto e provedor
│  ├─ telas/                    Início, importação, ajustes, estado vazio
│  ├─ ui/                       Componentes reutilizáveis (gavetas, cartões)
│  ├─ pwa/usarAtualizacao.ts    Service worker e aviso de nova versão
│  └─ estilos/global.css
└─ tests/                       Vitest (unitários + componentes)
```

---

## Formato dos dados

### Planos alimentares (múltiplos)

O Equivale guarda uma **coleção de planos independentes**, não uma dieta só.
Cada plano é um `PlanoAlimentar`:

| Campo           | Conteúdo                                                          |
| --------------- | ----------------------------------------------------------------- |
| `id`            | identificador estável (vem do `planId` do arquivo ou é gerado)     |
| `nome`          | nome exibido no seletor do cabeçalho                              |
| `descricao`     | texto livre opcional (`null` quando não houver)                   |
| `diasSugeridos` | dias sugeridos pela nutricionista — **anotação**, não automação   |
| `importadoEm`   | ISO 8601 do momento da importação                                 |
| `dietaOriginal` | a dieta **como prescrita**, com todas as alterações desfeitas      |
| `dietaAtual`    | o **estado atual**: substituições e movimentações aplicadas        |

O estado persistido guarda os planos e qual deles está ativo:

```jsonc
{
  "versaoDoEsquema": 2,
  "planos": [ /* PlanoAlimentar[] */ ],
  "planoAtivoId": "dias-uteis",
  "configuracoes": { /* compartilhadas */ },
  "vinculos": [ /* compartilhados */ ]
}
```

**O que é por plano e o que é compartilhado:**

| Por plano                                        | Compartilhado por todos os planos     |
| ------------------------------------------------ | ------------------------------------- |
| refeições, itens (blocos calóricos)               | modo de arredondamento                |
| movimentações entre refeições                     | modo de demonstração                  |
| substituições de alimento                         | base de alimentos                     |
| restauração da dieta original                     | vínculos manuais de alimento          |
| nome, descrição, dias sugeridos                   |                                       |

Alternar de plano é **manual**, pelo seletor compacto do cabeçalho. O plano
ativo é persistido, então o app reabre onde você parou. Não há (ainda) troca
automática por dia da semana.

Em **Ajustes → Planos alimentares** dá para trocar de plano, **renomear** e
**excluir** um plano. A exclusão pede confirmação e remove **apenas aquele
plano** — os demais, os vínculos e as configurações continuam intactos.

#### Migração automática da versão anterior

Quem já usava o Equivale com uma dieta única (esquema 1) **não perde nada**: ao
abrir o app, a dieta guardada vira automaticamente um plano chamado
**“Plano principal”**, com todos os itens e todas as alterações preservadas, e
já ativo. A migração está em `src/persistencia/migracoes.ts`, é idempotente e
tem testes dedicados em `tests/migracaoDePlanos.test.ts`. Ela vale tanto para o
IndexedDB quanto para **backups antigos** restaurados a partir de arquivo.

### Dieta importada (Markdown)

Documentado em [`docs/import-format.md`](docs/import-format.md). Resumo:

```markdown
---
equivaleVersion: 1
planId: dias-uteis
planName: Dias úteis
suggestedDays: seg, ter, qua, qui, sex
---

# Dieta: Nome do plano

## Café da manhã

- Pão francês | 1 unidade | peso 50 g | 150 kcal | obs: sem manteiga
- Mamão papaia | 100 g | 40 kcal
- Tomate | à vontade
```

A ação **Baixar modelo** dentro do aplicativo gera um `.md` já comentado, com o
front matter e o catálogo exato de IDs incluídos. Ao converter um PDF com IA,
envie o modelo completo junto com o PDF: a IA deve copiar apenas IDs existentes,
preservar alimentos específicos e nunca inventar peso ou calorias. Itens escritos
como `| à vontade`, `| a vontade` ou `| livre` aparecem no plano sem contabilizar
calorias e sem virar pendência.

#### Front matter (metadados do plano)

O bloco entre `---` no topo do arquivo identifica o plano. Ele é **opcional**,
e cada campo também:

| Campo             | Exemplo                   | Para que serve                                                         |
| ----------------- | ------------------------- | ---------------------------------------------------------------------- |
| `equivaleVersion` | `1`                       | Versão do formato dos metadados. Hoje: **1**.                          |
| `planId`          | `dias-uteis`              | Identificador **estável**: permite atualizar este plano depois.        |
| `planName`        | `Dias úteis`              | Nome no seletor de planos (também serve de título, se não houver `#`). |
| `suggestedDays`   | `seg, ter, qua, qui, sex` | Dias sugeridos. **Anotação apenas** — não troca o plano sozinho.       |

Dias aceitos: `dom`, `seg`, `ter`, `qua`, `qui`, `sex`, `sáb`, os nomes por
extenso (`segunda`, `segunda-feira`, …) ou números de `1` (domingo) a `7`.

Metadados desconhecidos ou inválidos viram **avisos** na prévia e são
ignorados — nunca invalidam o arquivo. O bloco é descontado de forma a manter
os números de linha dos avisos e erros iguais aos do arquivo real.

#### O que acontece ao importar

A prévia mostra os metadados lidos e, só então, oferece três caminhos:

1. **Adicionar como novo plano** — sempre disponível.
2. **Substituir o plano “X”** — aparece somente quando já existe um plano com o
   mesmo `planId`. Troca **apenas aquele plano**, com uma segunda confirmação.
3. **Cancelar**.

A importação **nunca** substitui todos os planos e nunca substitui nada em
silêncio. Ao escolher “adicionar como novo plano” com um `planId` já em uso, o
plano novo recebe um id local diferente, para não sobrescrever o existente. Um
arquivo sem `planId` sempre vira um plano novo.

### Bloco calórico

Cada item importado vira um bloco com **energia fixa** e dois estados:

| Campo      | Conteúdo                                                     |
| ---------- | ------------------------------------------------------------ |
| `id`       | identificador estável, nunca muda                            |
| `original` | alimento, quantidade, unidade e refeição **como prescritos** |
| `atual`    | alimento, quantidade, unidade e refeição **agora**           |
| `kcal`     | valor energético fixo do bloco                               |

Substituir altera só o `atual` do alimento/quantidade; mover altera só a refeição
do `atual`. `kcal`, `id` e `original` permanecem intactos — por isso “Restaurar
item original” e “Restaurar dieta original” sempre funcionam.

### Cálculo de equivalência

```
quantidade equivalente (g) = kcal fixas do bloco × 100 ÷ kcal por 100 g do alimento
```

A precisão decimal completa é mantida internamente; o arredondamento acontece
**apenas na apresentação**, conforme a preferência escolhida em Ajustes: valor
exato, grama inteira, múltiplos de 5 g ou medida caseira aproximada. Medidas
caseiras são sempre aproximações — o cálculo principal continua em gramas.

### Base de alimentos (JSON)

`public/data/alimentos.json`:

```json
{
  "versao": 1,
  "fonte": "TACO 4ª edição",
  "somenteParaTeste": false,
  "alimentos": [
    {
      "id": "taco_063",
      "nome": "Arroz, tipo 1, cozido",
      "aliases": ["arroz branco"],
      "categoria": "cereais-paes-massas-tuberculos",
      "preparo": "cozido",
      "kcalPor100g": 128,
      "porcoesCaseiras": [{ "medida": "colher de sopa", "quantidade": 1, "gramas": 25 }],
      "fonte": "TACO 4ª edição",
      "codigoDaFonte": "63",
      "atualizadoEm": "2011-01-01"
    }
  ]
}
```

Categorias válidas (apenas organizacionais, **nunca** restringem substituição):
`cereais-paes-massas-tuberculos`, `leguminosas`, `proteinas`, `laticinios`,
`frutas`, `hortalicas`, `gorduras`, `acucares-e-doces`, `bebidas`,
`industrializados`, `receitas`.

### Backup (JSON)

O backup carrega a coleção inteira:

```jsonc
{
  "aplicativo": "equivale",
  "versaoDoEsquema": 2,
  "geradoEm": "2026-08-03T12:00:00.000Z",
  "planos": [
    {
      "id": "dias-uteis",
      "nome": "Dias úteis",
      "descricao": null,
      "diasSugeridos": ["segunda", "terca", "quarta", "quinta", "sexta"],
      "importadoEm": "2026-08-01T09:00:00.000Z",
      "dietaOriginal": { /* como prescrita */ },
      "dietaAtual": { /* com as alterações */ }
    }
  ],
  "planoAtivoId": "dias-uteis",
  "vinculos": [ /* vínculos de alimentos, compartilhados */ ],
  "configuracoes": { /* compartilhadas */ }
}
```

Ao restaurar, o aplicativo valida, migra a versão se necessário e mostra uma
**prévia** antes de aplicar — com a quantidade de planos, qual estava ativo e,
para cada plano, itens, refeições e alterações. Restaurar troca **toda** a
coleção pela do arquivo.

Backups do esquema 1 (`dietaOriginal` + `estadoAtual`, dieta única) continuam
sendo aceitos: viram um plano “Plano principal”, com um aviso na prévia.
Um plano ilegível é descartado sem derrubar os demais, e planos com id repetido
recebem ids novos para que um não sobrescreva o outro.

---

## Como substituir as fixtures pela futura base validada

O aplicativo **não inclui base nutricional própria e não inventa números**. Por
isso `public/data/alimentos.json` vem vazio, e o que existe em
`src/data/alimentos/TEST_ONLY.fixtures.ts` são **valores fictícios**, usados
somente nos testes e no **modo de demonstração** (que é sinalizado por uma faixa
de aviso na tela).

Para usar uma base real:

1. Obtenha uma tabela nutricional validada e cuja licença permita a redistribuição
   (por exemplo TACO/Unicamp ou as tabelas do IBGE).
2. Converta-a para o formato acima, preenchendo `fonte`, `codigoDaFonte` e
   `atualizadoEm` de cada registro. `kcalPor100g` precisa ser numérico e finito —
   registros incompletos são descartados por `validarBase` em vez de virarem
   cálculo errado.
3. Grave o resultado em `public/data/alimentos.json` com
   `"somenteParaTeste": false`.
4. Rode `npm run build`. Nenhuma tela precisa mudar: a aplicação conversa apenas
   com a interface `RepositorioDeAlimentos`.
5. Opcional: apague `src/data/alimentos/TEST_ONLY.fixtures.ts` e o modo de
   demonstração se não quiser mais dados fictícios no projeto — os testes de
   domínio que dependem deles usam `tests/apoio/fabricas.ts`.

A busca é normalizada (sem acentos), usa `aliases` e um índice invertido montado
uma única vez no carregamento, dimensionado para milhares de alimentos.

---

## Lista de substituições da nutricionista (camada preparada)

Algumas prescrições vêm com uma lista própria de trocas — “no grupo dos
cereais, 1 fatia de pão (50 g) equivale a 2 colheres de arroz (50 g)”. O
Equivale já traz a **camada de dados** para receber esse material, em
`src/domain/listaDeSubstituicoes.ts`:

```ts
ListaDeSubstituicoes {
  id, nome, origem, criadaEm,
  grupos: GrupoDeSubstituicoes[]      // id, nome, descricao, alimentos
}
AlimentoDaLista {
  id, nome, alimentoId,               // vínculo opcional com a base nutricional
  quantidade, unidade, medidaCaseira, // porção definida pela nutricionista
  kcal, observacao
}
```

O módulo traz consultas puras (`gruposDoAlimento`, `alternativasSugeridas`,
`contarAlimentos`) e o saneamento de dados não confiáveis
(`sanearListaDeSubstituicoes`), com testes em
`tests/listaDeSubstituicoes.test.ts`.

**O que ainda não existe, de propósito:** não há importação dessa lista (nem
Markdown, nem JSON, nem tela), e ela não é persistida no estado. Quando a
importação chegar, a lista será uma **sugestão adicional** — a regra do
Equivale continua valendo: qualquer alimento pode substituir qualquer outro
pela equivalência calórica, e grupos/categorias **nunca** bloqueiam uma troca.

---

## Como publicar a pasta `dist` em hospedagem estática

`npm run build` gera uma pasta `dist/` totalmente estática (o `base` do Vite é
`./`, então funciona também em subdiretórios).

- **Netlify**: arraste `dist/` em app.netlify.com/drop, ou configure build
  `npm run build` e diretório de publicação `dist`.
- **Vercel**: framework “Vite”, build `npm run build`, output `dist`.
- **GitHub Pages**: publique o conteúdo de `dist/` na branch `gh-pages`
  (ex.: `npx gh-pages -d dist`).
- **Cloudflare Pages**: build `npm run build`, diretório `dist`.
- **Servidor próprio**: copie `dist/` para a raiz servida. Sirva por **HTTPS** —
  service worker e instalação da PWA exigem contexto seguro (exceto
  `localhost`).

Configure o servidor para devolver `index.html` em rotas desconhecidas (SPA
fallback). Não é preciso nenhuma variável de ambiente, banco ou API.

---

## PWA

- Instalável (manifesto, ícones 192/512 e maskable).
- Funciona **offline** depois da primeira visita: todos os arquivos do build são
  pré-cacheados; não há requisição de rede em tempo de execução.
- Quando há versão nova, aparece uma faixa **“Uma nova versão do Equivale está
  disponível”** com o botão *Atualizar* — a troca só acontece quando você decide.

---

## Acessibilidade e interação

- Áreas de toque de no mínimo 44 px.
- Arrastar e soltar com **toque real**: pressão longa de 250 ms com tolerância de
  8 px, de modo que um deslize vertical continue rolando a página. A refeição de
  destino é destacada durante o arraste.
- Todo arraste tem alternativa acessível: a gaveta do item traz
  **“Mover para...”**, que funciona com toque, mouse e teclado. O pegador (⠿)
  também é focável pelo teclado.
- Gavetas são diálogos modais com foco preso, `Esc` para fechar e rótulos
  acessíveis.
- O seletor de plano do cabeçalho é um `<select>` nativo, rotulado como
  **“Plano atual”**: funciona com toque, mouse, teclado e leitor de tela. Com um
  único plano ele some e sobra apenas o nome, para não virar ruído.

---

## Limitações conhecidas

- **Não há base nutricional embarcada.** Sem instalar uma base real, a
  substituição só funciona no modo de demonstração, com valores fictícios.
- O reconhecimento de alimentos na importação exige correspondência **exata**
  (nome ou alias, após normalização). Não há busca aproximada — itens sem
  correspondência vão para a conferência manual, e o vínculo escolhido é
  reaproveitado nas próximas importações.
- **“Minhas receitas” é recurso futuro**: existe o modelo de dados, a conversão
  para alimento e os testes, mas não há editor de receitas nesta versão.
- **Não há troca automática de plano por dia da semana.** `suggestedDays` é
  exibido como legenda no seletor; a troca continua manual.
- **A lista de substituições da nutricionista é recurso futuro**: a camada de
  dados existe (ver abaixo), mas não há importação nesta versão.
- Um plano não pode ser criado vazio nem editado item a item pela interface: os
  itens sempre vêm de um arquivo importado.
- O arraste move o bloco para o **fim** da refeição de destino; reordenar dentro
  da mesma refeição ainda não está exposto na interface (a operação já existe no
  domínio, com `posicao`).
- A importação aceita `.md`, `.markdown` e `.txt`; PDF, DOCX e imagens não são
  suportados.
- O modo de arredondamento “medida caseira” arredonda as gramas para inteiro e
  destaca as aproximações caseiras; ele não converte o cartão para medidas.
- Sem sincronização entre aparelhos — mover os dados é feito por backup JSON.
- Os ícones são provisórios (um símbolo de troca gerado por script).

---

## Conversão futura para Android (Capacitor) — opcional

O projeto **não precisa** de Android Studio nem do SDK Android para rodar ou
concluir o MVP web. A configuração do Capacitor já está pronta em
`capacitor.config.ts` (`appId: com.equivale.app`, `appName: Equivale`,
`webDir: dist`), mas as dependências **não** estão instaladas.

Para gerar o projeto Android depois:

```bash
npm install -D @capacitor/cli && npm install @capacitor/core @capacitor/android
```

```bash
npm run build && npx cap add android
```

```bash
npm run build && npx cap sync android
```

```bash
npx cap open android
```

Nada no código depende do Capacitor: a persistência já está atrás da interface
`Armazenamento`, então trocar IndexedDB por um armazenamento nativo é uma
implementação nova, sem alterar telas.

---

## Licença

Defina a licença antes de distribuir. Atenção especial à licença da base
nutricional que você embarcar em `public/data/alimentos.json`.
