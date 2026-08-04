# Relatório pré-preenchimento da base nutricional

Gerado antes de qualquer alteração em `public/data/alimentos.json`.

## Estado atual

- **Quantidade de alimentos:** 0
- **Fonte declarada:** `nenhuma base carregada`
- **Base de produção:** vazia de propósito; nenhum dado nutricional real está disponível para resolução automática.
- **Fixtures:** `src/data/alimentos/TEST_ONLY.fixtures.ts` não foi usada como fonte e não deve ser copiada para produção.

## Dieta de referência auditada

Não há no repositório um arquivo cujo nome identifique uma “dieta de teste”. Para tornar a auditoria reproduzível sem presumir um arquivo externo, este relatório usa o modelo Markdown distribuído pelo próprio aplicativo (`src/importacao/modelo.ts`). Com a base vazia, todos os 13 alimentos do modelo ficam sem correspondência nutricional:

1. Pão francês
2. Mamão papaia
3. Café com leite
4. Banana prata
5. Arroz branco cozido
6. Feijão carioca cozido
7. Peito de frango grelhado
8. Salada de folhas
9. Iogurte natural
10. Aveia em flocos
11. Batata-doce cozida
12. Tilápia assada
13. Leite desnatado

O modelo informa kcal explicitamente, portanto esses itens não ficam pendentes ao importar o modelo, apesar de não terem correspondência na base.

## Condição para preencher a base

A base só deve ser alterada a partir de uma fonte nutricional validada e rastreável. Cada registro deve informar nome, aliases controlados, preparo, `kcalPor100g`, porções caseiras documentadas, fonte, código na fonte e data de atualização. Pesos e calorias ausentes não podem ser inferidos.
