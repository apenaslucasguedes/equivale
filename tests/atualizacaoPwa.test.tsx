import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerSW } from 'virtual:pwa-register';
import { useAtualizacao } from '../src/pwa/usarAtualizacao';

describe('atualização da PWA', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {},
    });
    vi.mocked(registerSW).mockReturnValue(async () => undefined);
  });

  it('registra imediatamente e procura uma versão nova ao abrir', async () => {
    const atualizarRegistro = vi.fn().mockResolvedValue(undefined);

    renderHook(() => useAtualizacao());

    expect(registerSW).toHaveBeenCalledOnce();
    const opcoes = vi.mocked(registerSW).mock.calls[0]?.[0];
    expect(opcoes?.immediate).toBe(true);

    await act(async () => {
      await opcoes?.onRegisteredSW?.(
        '/equivale/sw.js',
        { update: atualizarRegistro } as unknown as ServiceWorkerRegistration,
      );
    });

    expect(atualizarRegistro).toHaveBeenCalledOnce();
  });
});