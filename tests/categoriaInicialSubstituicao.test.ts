import { describe, expect, it } from 'vitest';
import { encontrarCategoriaInicial } from '../src/ui/categoriaInicialSubstituicao';
import { criarBloco, criarRepositorioSincrono } from './apoio/fabricas';

describe('categoria inicial da substituição', () => {
  const repositorio = criarRepositorioSincrono();

  it('prioriza o alimento atual quando ele já possui vínculo', () => {
    const bloco = criarBloco({ alimentoId: 'TEST_ONLY_ovo_cozido', nome: 'Ovo cozido' });
    expect(encontrarCategoriaInicial(bloco, repositorio)).toBe('proteinas');
  });

  it('descobre a categoria por nome quando o item importado não possui vínculo', () => {
    const bloco = criarBloco({ alimentoId: null, nome: 'Banana prata' });
    expect(encontrarCategoriaInicial(bloco, repositorio)).toBe('frutas');
  });

  it('abre ovo genérico em proteínas mesmo quando há várias preparações na base', () => {
    const bloco = criarBloco({ alimentoId: null, nome: 'Ovo, de galinha, unidade' });
    expect(encontrarCategoriaInicial(bloco, repositorio)).toBe('proteinas');
  });
});
