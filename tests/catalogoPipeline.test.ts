import { describe, expect, it } from 'vitest';
import { compilarCatalogo, sanitizarCatalogo } from '../scripts/catalogo-equivalencias.mjs';

const base = `---
schemaVersion: 1
documentType: substitution-catalog
app: Equivale
title: Teste
generatedAt: "REVIEW_REQUIRED: data"
---
# Catálogo
## Grupos de equivalência
### Frutas - Grupo 1
- id: \`grupo-01-frutas\`
- nome: Frutas
- porcaoBaseId: \`grupo-01-frutas-porcao-1\`
#### Opções equivalentes
- {"id":"banana","nomePadronizado":"Banana","nomeOriginal":"Banana prata","aliases":["banana-prata"],"quantidadeNumerica":1,"unidadePrincipal":"unidade","pesoGramas":80,"medidaCaseira":"unidade","quantidadeMedidaCaseira":1,"observacoes":null}
#### Porções prescritas nos planos
- id: \`p1\`
  - multiplicadorPorcaoLista: 1
  - evidenciasDiretas:
    - {"optionId":"banana","quantidade":1,"pesoGramas":80}
## Itens não resolvidos
### unresolved-01
- status: REVIEW_REQUIRED
- descricao: conferir data
`;

describe('pipeline do catálogo', () => {
  it('preserva os valores explícitos e coleta revisões', () => {
    const resultado = compilarCatalogo(base, 'fixture.md');
    expect(resultado.erros).toEqual([]);
    expect(resultado.catalogo.grupos[0]).toMatchObject({ id: 'grupo-01-frutas', nome: 'Frutas' });
    expect(resultado.catalogo.grupos[0]?.opcoes[0]).toMatchObject({ nomeOriginal: 'Banana prata', pesoGramas: 80 });
    expect(resultado.catalogo.reviewRequired.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(resultado.catalogo)).not.toMatch(/kcal/i);
  });

  it('gera catálogo público sem metadados pessoais da fonte', () => {
    const compilado = compilarCatalogo(
      base.replace(
        '"observacoes":null',
        '"observacoes":"REVIEW_REQUIRED","referencia":"PRIVATE_SOURCE_FILENAME","planosEmQueAparece":["PRIVATE_PLAN_USAGE"]',
      ),
      'PRIVATE_SOURCE_FILENAME',
    ).catalogo;
    const serializado = JSON.stringify(sanitizarCatalogo(compilado));

    expect(serializado).toContain('REVIEW_REQUIRED');
    expect(serializado).not.toMatch(/PRIVATE_SOURCE_FILENAME|PRIVATE_PLAN_USAGE|referencia|planosEmQueAparece|source|registrosInline/);
  });

  it('rejeita IDs globais duplicados e optionId inexistente', () => {
    const invalido = base.replace('"id":"banana"', '"id":"grupo-01-frutas"').replace('"optionId":"banana"', '"optionId":"ausente"');
    const mensagens = compilarCatalogo(invalido, 'fixture.md').erros.map((erro: { mensagem: string }) => erro.mensagem).join(' ');
    expect(mensagens).toMatch(/ID global duplicado/);
    expect(mensagens).toMatch(/optionId.*ausente/);
  });

  it('rejeita schema essencial e quantidades inválidas', () => {
    const invalido = base.replace('documentType: substitution-catalog', 'documentType: outro').replace('"quantidadeNumerica":1', '"quantidadeNumerica":0');
    const mensagens = compilarCatalogo(invalido, 'fixture.md').erros.map((erro: { mensagem: string }) => erro.mensagem).join(' ');
    expect(mensagens).toMatch(/documentType/);
    expect(mensagens).toMatch(/quantidadeNumerica/);
  });
});
