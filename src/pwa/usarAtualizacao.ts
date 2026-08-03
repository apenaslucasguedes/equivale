/**
 * Registro do service worker e aviso de atualização disponível.
 *
 * O app funciona offline depois da primeira visita. Quando uma nova versão é
 * publicada, o usuário decide quando recarregar — nada é trocado por baixo dele.
 */

import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

export interface EstadoDaAtualizacao {
  atualizacaoDisponivel: boolean;
  prontoParaOffline: boolean;
  aplicarAtualizacao: () => void;
  descartar: () => void;
}

export function useAtualizacao(): EstadoDaAtualizacao {
  const [atualizacaoDisponivel, setAtualizacaoDisponivel] = useState(false);
  const [prontoParaOffline, setProntoParaOffline] = useState(false);
  const [aplicar, setAplicar] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const atualizar = registerSW({
      immediate: true,
      onNeedRefresh: () => setAtualizacaoDisponivel(true),
      onOfflineReady: () => setProntoParaOffline(true),
    });
    setAplicar(() => () => void atualizar(true));
  }, []);

  return {
    atualizacaoDisponivel,
    prontoParaOffline,
    aplicarAtualizacao: () => aplicar?.(),
    descartar: () => setAtualizacaoDisponivel(false),
  };
}
