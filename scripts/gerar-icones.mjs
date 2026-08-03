/** Copia os SVGs auditáveis e deriva os PNGs oficiais do símbolo Equivale. */
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, '..');
const entrada = resolve(raiz, 'incoming', 'brand');
const marca = resolve(raiz, 'public', 'brand');
const icones = resolve(raiz, 'public', 'icons');
const simboloOrigem = resolve(entrada, 'equivale-simbolo.svg');

await mkdir(marca, { recursive: true });
await mkdir(icones, { recursive: true });
await copyFile(resolve(entrada, 'equivale-logo.svg'), resolve(marca, 'logo-completo.svg'));
await copyFile(simboloOrigem, resolve(marca, 'favicon.svg'));

const simbolo = await readFile(simboloOrigem);

async function gerar(nome, tamanho) {
  await sharp(simbolo)
    .resize(tamanho, tamanho, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(resolve(icones, nome));
  console.log(`ícone gerado: public/icons/${nome} (${tamanho}×${tamanho})`);
}

async function gerarMaskable() {
  const tamanho = 512;
  const areaSegura = 360; // símbolo inteiro dentro do círculo seguro central (~70%).
  const camada = await sharp(simbolo)
    .resize(areaSegura, areaSegura, { fit: 'contain' })
    .png()
    .toBuffer();
  await sharp({
    create: { width: tamanho, height: tamanho, channels: 4, background: '#ffffff' },
  })
    .composite([{ input: camada, gravity: 'center' }])
    .png()
    .toFile(resolve(icones, 'maskable-512.png'));
  console.log('ícone gerado: public/icons/maskable-512.png (512×512, margem segura)');
}

await gerar('favicon-32.png', 32);
await gerar('icon-192.png', 192);
await gerar('icon-512.png', 512);
await gerarMaskable();
