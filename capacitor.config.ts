/**
 * Configuração do Capacitor para uma futura versão Android.
 *
 * IMPORTANTE: as dependências do Capacitor NÃO estão instaladas e NÃO são
 * necessárias para executar, testar ou publicar o MVP web. Este arquivo existe
 * apenas para que a conversão futura não exija decisões novas.
 *
 * Passos documentados na seção "Conversão futura para Android" do README.md.
 *
 * O tipo é declarado localmente de propósito, para o projeto não depender de
 * `@capacitor/cli` enquanto o Capacitor não for adotado.
 */

interface ConfiguracaoDoCapacitor {
  appId: string;
  appName: string;
  webDir: string;
  android?: { allowMixedContent?: boolean };
  server?: { androidScheme?: string };
}

const config: ConfiguracaoDoCapacitor = {
  appId: 'com.equivale.app',
  appName: 'Equivale',
  webDir: 'dist',
  android: {
    // O app é 100% local: nenhum conteúdo externo, misto ou não.
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
