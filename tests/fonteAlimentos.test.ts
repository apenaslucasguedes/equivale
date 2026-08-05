import { afterEach, describe, expect, it, vi } from 'vitest';
import { carregarBaseDeProducao } from '../src/data/alimentos/fonte';

const BASE = {
  versao: 1,
  fonte: 'teste',
  somenteParaTeste: false,
  alimentos: [{
    id: 'banana', nome: 'Banana', aliases: [], categoria: 'frutas', preparo: 'cru',
    kcalPor100g: 89, porcoesCaseiras: [], fonte: 'teste', codigoDaFonte: '1',
    atualizadoEm: '2026-01-01',
  }],
};

afterEach(() => vi.unstubAllGlobals());

describe('carregarBaseDeProducao', () => {
  it('repete a carga quando a primeira tentativa falha', async () => {
    const fetch = vi.fn()
      .mockRejectedValueOnce(new Error('falha transitória'))
      .mockResolvedValueOnce({ ok: true, json: async () => BASE });
    vi.stubGlobal('fetch', fetch);

    const base = await carregarBaseDeProducao();

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(base.alimentos[0]?.id).toBe('banana');
  });

  it('não transforma falha definitiva em uma base vazia aparentemente pronta', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(carregarBaseDeProducao()).rejects.toThrow('Não foi possível carregar a base de alimentos');
  });
});
