/** Substituto do módulo virtual do vite-plugin-pwa durante os testes. */

import { vi } from 'vitest';

interface OpcoesDeRegistro {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegisteredSW?: (url: string, registro: ServiceWorkerRegistration | undefined) => void;
}

export const registerSW = vi.fn(
  (_opcoes?: OpcoesDeRegistro): ((recarregar?: boolean) => Promise<void>) => async () => undefined,
);
