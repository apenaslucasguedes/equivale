/** Substituto do módulo virtual do vite-plugin-pwa durante os testes. */

export function registerSW(_opcoes?: {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
}): (recarregar?: boolean) => Promise<void> {
  return async () => undefined;
}
