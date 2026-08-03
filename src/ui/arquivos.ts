/** Leitura e download de arquivos — tudo local, nada é enviado para a rede. */

export function baixarTexto(nomeDoArquivo: string, conteudo: string, tipo: string): void {
  const blob = new Blob([conteudo], { type: `${tipo};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const ancora = document.createElement('a');
  ancora.href = url;
  ancora.download = nomeDoArquivo;
  document.body.appendChild(ancora);
  ancora.click();
  document.body.removeChild(ancora);
  // Espera o navegador iniciar o download antes de liberar a URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function lerArquivoComoTexto(arquivo: File): Promise<string> {
  return new Promise((resolver, rejeitar) => {
    const leitor = new FileReader();
    leitor.onload = () => resolver(String(leitor.result ?? ''));
    leitor.onerror = () => rejeitar(leitor.error ?? new Error('Não foi possível ler o arquivo.'));
    leitor.readAsText(arquivo, 'utf-8');
  });
}
