# Formato de importação do Equivale (Markdown)

Este documento define, sem ambiguidade, como um arquivo `.md` precisa estar
escrito para ser importado pelo Equivale.

A importação é **100% local**: o arquivo é lido no próprio aparelho e nada é
enviado para servidores.

> Precisa de um ponto de partida? Use a ação **Baixar modelo** dentro do
> aplicativo — ela gera um `.md` já comentado neste formato.

---

## 1. Estrutura geral

```markdown
---
equivaleVersion: 1
planId: <identificador estável do plano>
planName: <nome do plano>
suggestedDays: <dias sugeridos>
---

# Dieta: <título do plano>

## <nome da refeição>

- <alimento> | <quantidade> <unidade> [| id: <ID da base>] [| peso <n> g] [| <n> kcal] [| obs: <texto>]
- <alimento livre> | à vontade [| id: <ID da base>] [| obs: <texto>]
- ...

## <outra refeição>

- ...
```

| Elemento                     | Sintaxe            | Obrigatório |
| ---------------------------- | ------------------ | ----------- |
| Metadados do plano           | `---` … `---`      | Não         |
| Título da dieta              | `# Dieta: ...`     | Não¹        |
| Refeição                     | `## ...`           | Sim         |
| Item (bloco calórico)        | `- ...`            | Sim         |

¹ Se ausente, o título vem de `planName`. Sem os dois, a dieta recebe o nome
“Dieta importada” e um aviso é exibido na prévia. O prefixo `Dieta:` é
opcional — `# Meu plano` também funciona.

Cada arquivo `.md` corresponde a **um plano alimentar**. Para manter “Dias
úteis” e “Fim de semana” ao mesmo tempo, use um arquivo para cada, com
`planId` diferente.

---

## 1.1. Metadados do plano (front matter)

Um bloco no **topo** do arquivo, delimitado por `---`, no formato
`chave: valor` (uma por linha). Todo o bloco é **opcional**, e cada campo
também. Aspas em volta do valor são aceitas e removidas.

| Campo             | Exemplo                          | Para que serve                                                                 |
| ----------------- | -------------------------------- | ------------------------------------------------------------------------------ |
| `equivaleVersion` | `1`                              | Versão do formato dos metadados. Hoje: **1**.                                   |
| `planId`          | `dias-uteis`                     | Identificador **estável** do plano. Permite atualizar este plano depois.        |
| `planName`        | `Dias úteis`                     | Nome exibido no seletor de planos do cabeçalho.                                 |
| `suggestedDays`   | `seg, ter, qua, qui, sex`        | Dias sugeridos pela nutricionista. **Anotação apenas.**                         |

```markdown
---
equivaleVersion: 1
planId: dias-uteis
planName: Dias úteis
suggestedDays: seg, ter, qua, qui, sex
---
```

**Dias aceitos** (sem diferenciar acentos ou maiúsculas), separados por
vírgula, ponto e vírgula, barra ou espaço:

`dom`/`domingo` · `seg`/`segunda`/`segunda-feira` · `ter`/`terça` ·
`qua`/`quarta` · `qui`/`quinta` · `sex`/`sexta` · `sáb`/`sábado`.
Números de `1` (domingo) a `7` (sábado) também funcionam.

Os dias são sempre normalizados para a ordem da semana, começando no domingo.

> **Importante:** `suggestedDays` **não** troca o plano automaticamente. Nesta
> versão a troca é sempre **manual**, pelo seletor do cabeçalho. Os dias
> aparecem apenas como legenda.

Metadados desconhecidos, valores inválidos e um bloco que não seja fechado
geram **avisos** na prévia e são ignorados — nunca invalidam a importação. Os
números de linha dos avisos e erros continuam correspondendo ao arquivo real.

### Como o `planId` é usado na importação

Ao importar, o Equivale mostra a prévia e oferece:

1. **Adicionar como novo plano** — sempre disponível.
2. **Substituir o plano “X”** — aparece **só** quando já existe um plano com o
   mesmo `planId`. Troca **apenas aquele plano**; os demais ficam intactos.
3. **Cancelar**.

A importação **nunca** substitui todos os planos, e nunca substitui nada sem
confirmação. Se você escolher “adicionar como novo plano” e o `planId` já
estiver em uso, o plano novo recebe um identificador local diferente, para não
sobrescrever o que já existe.

Um arquivo **sem** `planId` sempre vira um plano novo.

---

## 2. Título da dieta

A **primeira** linha iniciada por `#` (um único `#`) define o título.

```markdown
# Dieta: Plano de manutenção — Ana
```

O prefixo `Dieta:` (com ou sem dois-pontos) é removido do título final.

Quando o arquivo traz `planName` nos metadados, é ele que nomeia o plano no
seletor do cabeçalho; o título continua sendo o nome da dieta importada.

---

## 3. Refeições

Qualquer título de nível 2 ou maior (`##`, `###`, …) abre uma refeição. Todos
os itens seguintes pertencem a ela, até o próximo título.

Nomes reconhecidos (comparação sem acentos e sem diferenciar maiúsculas):

| Refeição canônica | Também aceita                              |
| ----------------- | ------------------------------------------ |
| Café da manhã     | `café`, `desjejum`, `primeira refeição`     |
| Lanche da manhã   | `colação`, `lanche manhã`                   |
| Almoço            | —                                          |
| Lanche da tarde   | `lanche`, `merenda`                        |
| Jantar            | `janta`                                    |
| Ceia              | `antes de dormir`                          |

Textos entre parênteses são ignorados no reconhecimento, então
`## Almoço (12h)` é reconhecido como **Almoço**.

Nomes fora dessa lista (por exemplo `## Pré-treino`) **são aceitos** e
preservados; aparecem depois das refeições canônicas, na ordem do arquivo.

Refeições declaradas sem nenhum item não aparecem na tela principal.

---

## 4. Itens (blocos calóricos)

Cada item é uma linha de lista (`-`, `*` ou `+`) com campos separados por
barra vertical `|`.

```markdown
- Pão francês | 1 unidade | peso 50 g | 150 kcal | obs: sem manteiga
```

### 4.1 Campos posicionais

| Posição | Campo                  | Obrigatório | Exemplos                       |
| ------- | ---------------------- | ----------- | ------------------------------ |
| 1º      | Nome do alimento       | **Sim**     | `Arroz branco cozido`          |
| 2º      | Quantidade + medida    | **Sim**     | `100 g`, `1 pedaço`, `1 bife`, `200 ml` |

A quantidade aceita vírgula ou ponto como separador decimal (`1,5` = `1.5`).
Se a unidade for omitida (`- Aveia | 30`), assume-se **g**.

Quando a prescrição disser **“à vontade”**, **“a vontade”** ou **“livre”**, o
segundo campo pode conter essa expressão sem número:

```markdown
- Tomate | à vontade | id: <ID exato do tomate no catálogo>
- Alface | livre
```

O item é preservado e exibido como **à vontade**, recebe origem `livre` e **não
entra na contabilização de calorias**. Não é uma pendência e não exige `peso` ou
`kcal`. Se houver correspondência exata no catálogo, o `id` ainda pode ser usado
para identificar corretamente o alimento.

Qualquer descrição textual depois da quantidade é aceita e preservada, por
exemplo `1 pedaço`, `1 bife`, `1 filé`, `1 pote`, `1 sachê`, `1 pacote`,
`1 xícara`, `1 escumadeira` ou `4 colheres de sopa`. As unidades históricas
(`g`, `ml`, `unidade`, `fatia`, `colher`, `concha`, `copo` e `porção`, com suas
abreviações e plurais) continuam reconhecidas.

`g` e `ml` são diretamente conversíveis. Para qualquer outra medida, o cálculo
automático exige uma porção caseira correspondente no registro do alimento ou
o campo explícito `peso 00 g`. Uma medida desconhecida **não gera erro e não
descarta a linha**: o item é importado e fica pendente se peso e kcal não puderem
ser determinados. O Equivale nunca inventa o peso.

### 4.2 Campos nomeados (opcionais, em qualquer ordem)

| Campo   | Sintaxe                       | Para que serve                                      |
| ------- | ----------------------------- | --------------------------------------------------- |
| `peso`  | `peso 50 g` ou `peso: 50g`    | Peso em gramas quando a unidade não é `g`/`ml`.      |
| `id`    | `id: taco-3`                   | ID exato da base; tem prioridade sobre nome/alias.   |
| `kcal`  | `150 kcal` ou `kcal: 150`     | Calorias prescritas do item.                        |
| `obs`   | `obs: sem açúcar`             | Observação livre, exibida nos detalhes.             |

Campos não reconhecidos **não invalidam a linha**: geram um aviso na prévia e
são ignorados.

---

## 5. Como o Equivale determina as calorias do bloco

Cada item vira um **bloco calórico** com energia **fixa**. A origem desse valor
segue esta ordem:

1. **Informada** — o campo `kcal` existe na linha. Tem prioridade sobre tudo.
2. **Calculada** — não há `kcal`, mas existe correspondência **confiável** com
   um alimento da base (nome ou *alias* idêntico após normalização, ou um
   ID exato informado no arquivo, ou um vínculo manual já registrado) **e** dá para determinar as gramas
   (campo `peso`, unidade `g`/`ml`, ou uma medida caseira conhecida do
   alimento). O cálculo é
   `kcal = gramas × kcalPor100g ÷ 100`.
3. **Pendente** — nenhuma das duas anteriores. O item **não é descartado**:
   ele aparece na etapa de **conferência**, onde você o vincula manualmente a
   um alimento da base ou informa as calorias.
4. **Livre** — a medida é `à vontade`, `a vontade` ou `livre`. O item aparece no
   plano, mas suas calorias são deliberadamente desconsideradas.

### 5.1 Instrução para conversão por IA

O modelo baixado pelo aplicativo inclui, dentro de um comentário HTML, o
catálogo no formato `ID | NOME CANÔNICO | ALIASES`. Ao pedir que uma IA converta
um PDF, envie **o modelo completo junto com o PDF** e peça para ela obedecer às
instruções do comentário. A IA deve:

1. copiar apenas IDs que existam exatamente no catálogo, sem inventar ou editar;
2. usar o ID somente quando a correspondência com o alimento da prescrição for
   inequívoca, respeitando também o preparo (cru, cozido, grelhado etc.);
3. preservar o nome e a quantidade da prescrição, sem resumir alimentos
   específicos como “Fruta”, “Proteína” ou “Legumes”;
4. quando a própria prescrição for genérica, manter o texto genérico e omitir o
   ID, em vez de escolher uma opção arbitrária;
5. nunca inventar peso ou calorias; copiar esses valores apenas quando estiverem
   no documento de origem; e
6. escrever `| à vontade` quando a dieta usar “à vontade” ou “livre”.

O ícone não comprova vínculo nutricional: ele pode ser escolhido apenas pelo
texto. As calorias automáticas dependem do ID exato (ou de nome/alias exato) **e**
de uma quantidade convertível em gramas.

### 5.2 Correspondência exata com a base

O Equivale nunca adivinha por semelhança aproximada de nome.
Nomes e múltiplos aliases são comparados após normalização de caixa, acentos e
espaços. Variações controladas de nomenclatura e preparo (por exemplo `arroz
branco cozido`, `banana-maçã crua` e `patinho sem gordura grelhado`) devem ser
cadastradas explicitamente como nome ou alias. Se a mesma chave exata apontar
para mais de um alimento, o item permanece pendente e as opções são exibidas.

As pendências usam motivos específicos: **Base nutricional não carregada**,
**Alimento não encontrado na base**, **Medida sem peso conhecido** ou **Mais de
uma correspondência encontrada**.

### 5.3 Processo auditável da base nutricional

Antes de substituir `public/data/alimentos.json`, execute
`npm run alimentos:auditar -- public/data/alimentos.json caminho/da/dieta.md` e
guarde a saída JSON no processo de revisão. O relatório informa fonte, contagem,
itens ausentes e aliases ambíguos. A inclusão só pode usar uma fonte nutricional
validada e rastreável; fixtures `TEST_ONLY` não são dados reais. Cada registro
deve trazer nome, aliases controlados, preparo, `kcalPor100g`, porções caseiras
documentadas, fonte, código da fonte e data de atualização.

---

## 6. Linhas ignoradas

São ignoradas silenciosamente:

- linhas em branco;
- comentários HTML (`<!-- ... -->`);
- citações (linhas iniciadas por `>`);
- linhas horizontais (`---`, `***`);
- blocos de código delimitados por ` ``` `.

Qualquer outra linha solta gera um **aviso** informando que não virou item.

---

## 7. Prévia antes de adicionar ou substituir um plano

A importação **nunca** substitui nada sem confirmação, e nunca mexe em mais de
um plano. Antes de qualquer coisa, o aplicativo mostra:

- o nome do plano encontrado (`planName` ou o título);
- os metadados lidos (`planId`, `planName`, `suggestedDays`, `equivaleVersion`);
- se já existe um plano com aquele `planId`;
- as refeições encontradas e quantos itens cada uma tem;
- quantos itens foram reconhecidos, quantos ficaram pendentes;
- a lista de **avisos** (com o número da linha);
- a lista de **erros** (com o número da linha).

Só então você escolhe entre **adicionar como novo plano**, **substituir o
plano de mesmo `planId`** (com uma segunda confirmação) ou **cancelar**.

Itens com erro não viram blocos. Itens pendentes viram blocos e vão para a
conferência.

---

## 8. Exemplo completo válido

```markdown
---
equivaleVersion: 1
planId: dias-uteis
planName: Dias úteis
suggestedDays: seg, ter, qua, qui, sex
---

# Dieta: Plano de manutenção

## Café da manhã

- Pão francês | 1 unidade | peso 50 g | 150 kcal | obs: sem manteiga
- Mamão papaia | 100 g | 40 kcal
- Café com leite | 200 ml | 90 kcal

## Almoço (12h)

- Arroz branco cozido | 100 g | 128 kcal
- Feijão carioca cozido | 1 concha | peso 80 g | 61 kcal
- Peito de frango grelhado | 120 g | 198 kcal

## Pré-treino

- Banana prata | 1 unidade | peso 70 g | 70 kcal
```

---

## 9. Exemplos de linhas que geram erro

| Linha                                   | Motivo                                    |
| --------------------------------------- | ----------------------------------------- |
| `- Arroz`                               | Falta a quantidade.                       |
| `- Arroz \| muito`                      | Quantidade não numérica.                  |
| `- Arroz \| 100 g` antes de qualquer `##` | Item fora de refeição.                  |
| arquivo sem nenhum `##`                 | Nenhuma refeição encontrada.              |

---

## 10. O que o formato **não** tem

Por decisão de produto, o formato não representa — e o aplicativo não cria —
horários obrigatórios, marcação de refeição feita, metas, déficit calórico,
diário alimentar nem histórico de adesão. O Equivale organiza e adapta uma
dieta **já prescrita**.

`suggestedDays` é a única menção a dias da semana, e é **descritiva**: não
existe troca automática de plano por dia, nem agenda, nem lembrete.

A **lista de substituições da nutricionista** (grupos de trocas equivalentes)
ainda não faz parte deste formato: a camada de dados existe no código, mas não
há importação nesta versão. Ver a seção correspondente no `README.md`.
