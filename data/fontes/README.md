# Fontes nutricionais auditadas

## TACO — fonte primária da base v1

- **Publicação:** Tabela Brasileira de Composição de Alimentos — TACO
- **Edição:** 4ª edição ampliada e revisada
- **Responsável:** Núcleo de Estudos e Pesquisas em Alimentação (NEPA), Universidade Estadual de Campinas (Unicamp)
- **Página oficial:** https://nepa.unicamp.br/publicacoes/tabela-taco-excel/
- **Planilha oficial:** https://www.nepa.unicamp.br/wp-content/uploads/sites/27/2023/10/Taco-4a-Edicao.xlsx
- **Data de acesso:** 2026-08-03
- **Arquivo local:** `data/fontes/taco/Taco-4a-Edicao.xlsx`
- **SHA-256:** `a66b8ec528daeabc63bc2b015fc9bd8c6d76b941c2fc0ed93a4311d449302d14`
- **Condições observadas:** a página oficial declara que o projeto objetiva disponibilizar publicamente dados nacionais e regionais de composição nutricional. Não foi localizada, na página de download consultada, uma licença específica adicional. A base v1 preserva publicação, edição e código original e contém somente o recorte necessário ao Equivale.

A planilha bruta fica fora de `public/` e, portanto, não entra no bundle nem é servida pelo GitHub Pages. O aplicativo usa somente o JSON derivado e funciona offline após o carregamento dos assets.

## TBCA — complemento não utilizado nesta v1

- **Publicação consultada:** Tabela Brasileira de Composição de Alimentos (TBCA), versão 7.3
- **Responsáveis:** Universidade de São Paulo (USP) e Food Research Center (FoRC)
- **URL:** https://www.tbca.net.br/
- **Data de acesso:** 2026-08-03
- **Condições exibidas em “Como Citar”:** divulgação sem fins comerciais com citação; contato necessário para fins comerciais; CC BY-NC-ND 4.0; proibição declarada de reprodução total ou parcial e de alteração/comercialização.

**Decisão:** a TBCA não foi coletada, copiada nem usada para gerar registros nesta v1. Também não houve automação de páginas individuais. Um complemento futuro exige revisão humana/jurídica das condições ou autorização dos responsáveis e deverá manter seus valores em registros separados dos valores TACO.

## Medidas caseiras

A planilha TACO usada não fornece as medidas caseiras necessárias ao recorte. Porções presentes no JSON derivado são incluídas somente quando `incoming/data/catalogo-equivalencias-equivale.md` preserva quantidade e peso explícitos da lista de substituições ou dos planos da nutricionista. Cada porção registra sua referência e o id de origem. Medidas marcadas `REVIEW_REQUIRED` são excluídas.

## Reprodução

```bash
python -m pip install -r scripts/requirements-alimentos.txt
python scripts/gerar-base-alimentos.py
python scripts/gerar-base-alimentos.py --check
```
