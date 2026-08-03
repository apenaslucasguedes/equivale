# Pipeline do catálogo de equivalências

O catálogo publicado é derivado exclusivamente de `incoming/data/catalogo-equivalencias-equivale.md`. O arquivo de entrada é fonte auditável e não deve ser apagado nem editado por geração automática.

## Comandos

- `npm run catalogo:validar`: analisa a fonte sem escrever artefatos e falha quando há erros.
- `npm run catalogo:gerar`: valida e escreve `public/data/catalogo-equivalencias.json` e `docs/catalogo-relatorio.md`.
- `npm run build`: gera o catálogo antes do typecheck/build do Vite.

## Validações

A pipeline confere front matter (`schemaVersion`, `documentType`, `app` e `title`), estrutura e numeração de grupos, metadados essenciais, opções, unicidade global de IDs, JSON inline, números positivos para pesos/medidas/quantidades/multiplicadores e referências `optionId`. Conflitos estruturais interrompem a geração. Valores nulos explicitamente preservados (como bebidas sem quantidade na fonte) geram aviso, não estimativa.

Todas as ocorrências de `REVIEW_REQUIRED` são coletadas no JSON e apresentadas no relatório. A geração não calcula calorias, não arredonda decimais e não cria equivalências ou estimativas ausentes no Markdown.

## Consulta no aplicativo

`src/catalogo/catalogo.ts` expõe:

- `carregarCatalogo()` para carregar o JSON publicado;
- `normalizarNome()` para busca sem diferença de caixa, acentos ou espaços;
- `criarIndiceCatalogo()` para criar uma vez o índice em memória e consultar nomes/aliases;
- `correspondenciaExata()`, cujo resultado é discriminado como `nenhuma`, `unica` ou `ambiguo`. Uma chave ambígua nunca é escolhida automaticamente;
- `sugerir()` para resultados limitados por nome normalizado e aliases.

O módulo não está acoplado à UI; o consumidor deve exigir decisão explícita quando receber `ambiguo`.
