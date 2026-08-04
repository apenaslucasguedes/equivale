import type { Alimento, BlocoCalorico } from '../domain/types';
import type { RepositorioDeAlimentos } from '../data/alimentos/repositorio';
import { normalizar } from '../domain/texto';

export function encontrarCategoriaInicial(
  bloco: BlocoCalorico,
  repositorio: RepositorioDeAlimentos,
): Alimento['categoria'] | null {
  for (const id of [bloco.atual.alimentoId, bloco.original.alimentoId]) {
    if (!id) continue;
    const alimento = repositorio.porId(id);
    if (alimento) return alimento.categoria;
  }
  const resultados = repositorio.buscar(bloco.atual.alimentoNome, { limite: 2 });
  if (resultados.length === 1) return resultados[0]?.alimento.categoria ?? null;

  // Nomes genéricos da prescrição podem corresponder a vários preparos da base.
  // A categoria serve apenas para abrir o filtro; não escolhe um alimento nem suas kcal.
  const nome = normalizar(bloco.atual.alimentoNome);
  if (/\bovo\b/.test(nome)) return 'proteinas';
  return null;
}
