import { describe, expect, it } from 'vitest';
import { criarIndiceCatalogo, normalizarNome } from '../src/catalogo/catalogo';

const catalogo = {
  schemaVersion: 1,
  documentType: 'substitution-catalog',
  grupos: [{ id: 'g1', nome: 'Frutas', opcoes: [
    { id: 'a', nomePadronizado: 'Maçã', nomeOriginal: 'Maçã', aliases: ['maca gala'] },
    { id: 'b', nomePadronizado: 'Maca', nomeOriginal: 'Maca peruana', aliases: ['maca'] },
    { id: 'c', nomePadronizado: 'Banana prata', nomeOriginal: 'Banana prata', aliases: ['banana'] },
  ] }],
};

describe('consulta do catálogo', () => {
  it('normaliza acentos, caixa e espaços', () => {
    expect(normalizarNome('  MAÇÃ   Gala ')).toBe('maca gala');
  });

  it('retorna sugestões por nome e aliases', () => {
    const indice = criarIndiceCatalogo(catalogo);
    expect(indice.sugerir('BANANA').map((item) => item.id)).toContain('c');
  });

  it('não escolhe automaticamente quando a chave é ambígua', () => {
    const indice = criarIndiceCatalogo(catalogo);
    expect(indice.correspondenciaExata('maçã')).toEqual({ tipo: 'ambiguo', opcoes: expect.arrayContaining([expect.objectContaining({ id: 'a' }), expect.objectContaining({ id: 'b' })]) });
  });
});
