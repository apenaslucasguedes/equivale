import { execFileSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

const raiz = resolve(import.meta.dirname, '..');

describe('ativos da marca', () => {
  it('preserva os SVGs fornecidos e gera os PNGs nos tamanhos PWA', async () => {
    execFileSync(process.execPath, ['scripts/gerar-icones.mjs'], { cwd: raiz });

    const logoPublico = resolve(raiz, 'public/brand/logo-completo.svg');
    const simboloPublico = resolve(raiz, 'public/brand/favicon.svg');
    const fontesLocaisDisponiveis = await access(resolve(raiz, 'incoming/brand/equivale-logo.svg'))
      .then(() => true, () => false);

    if (fontesLocaisDisponiveis) {
      const logoOrigem = await readFile(resolve(raiz, 'incoming/brand/equivale-logo.svg'), 'utf8');
      const simboloOrigem = await readFile(resolve(raiz, 'incoming/brand/equivale-simbolo.svg'), 'utf8');
      await expect(readFile(logoPublico, 'utf8')).resolves.toBe(logoOrigem);
      await expect(readFile(simboloPublico, 'utf8')).resolves.toBe(simboloOrigem);
    } else {
      await expect(readFile(logoPublico, 'utf8')).resolves.toContain('<svg');
      await expect(readFile(simboloPublico, 'utf8')).resolves.toContain('<svg');
    }

    for (const [arquivo, tamanho] of [
      ['favicon-32.png', 32],
      ['icon-192.png', 192],
      ['icon-512.png', 512],
      ['maskable-512.png', 512],
    ] as const) {
      const metadados = await sharp(resolve(raiz, 'public/icons', arquivo)).metadata();
      expect([metadados.width, metadados.height]).toEqual([tamanho, tamanho]);
    }
  });
});
