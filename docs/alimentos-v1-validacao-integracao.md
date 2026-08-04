# Validação de integração da base nutricional v1

## Escopo disponível

Os PDFs originais dos planos não estão no repositório. A validação usa um recorte Markdown auditável em `tests/fixtures/plano-real-recorte.md`, transcrito exclusivamente das evidências diretas preservadas em `incoming/data/catalogo-equivalencias-equivale.md`. Nenhuma quantidade ou peso foi estimado.

## Resultado do recorte

- Itens importados: **7**
- Resolvidos automaticamente: **5**
- Pendentes: **2**
- Ambiguidades: **0**

### Resolvidos

1. Pão francês — `1 unidade`, peso documentado de 50 g.
2. Banana, maçã, crua — `1 pedaço`, peso documentado de 45 g.
3. Mamão, Papaia, cru — `3 colheres de sopa cheias`, peso documentado de 100 g.
4. Patinho, sem gordura, grelhado — `1 bife pequeno`, peso documentado de 60 g.
5. Peito de frango sem pele, grelhado — `1 filé pequeno`, peso documentado de 65 g.

### Pendentes preservados

1. **Atum sólido ao natural conservado** — alimento não encontrado na TACO usada. O registro TACO “Atum, conserva em óleo” não foi tratado como equivalente.
2. **Batata doce assada** — preparo ausente na TACO usada. “Batata, doce, cozida” não foi tratado como equivalente.

## Comandos de prova

```bash
npm run alimentos:auditar -- public/data/alimentos.json tests/fixtures/plano-real-recorte.md
npm run test -- --run tests/baseAlimentosProducao.test.ts
```

O relatório amplo do inventário registra **279 nomes normalizados ainda sem correspondência confiável**. Esse número cobre catálogo, evidências dos planos e modelo; não representa 279 linhas de um único plano. Dos nomes inventariados com correspondência e peso explícito, **128** podem ser resolvidos automaticamente.
