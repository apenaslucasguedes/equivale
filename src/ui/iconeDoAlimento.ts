import type { Categoria } from '../domain/types';
import { ICONE_CATEGORIA } from '../domain/types';

/** Emoji do próprio alimento quando há correspondência; categoria como fallback. */
export function iconeDoAlimento(nome: string, categoria?: Categoria): string {
  const alimento = nome.toLocaleLowerCase('pt-BR');
  if (alimento.includes('café')) return '☕';
  if (alimento.includes('queijo') || alimento.includes('muçarela') || alimento.includes('mussarela')) return '🧀';
  if (alimento.includes('banana')) return '🍌';
  if (alimento.includes('maçã')) return '🍎';
  if (alimento.includes('mamão') || alimento.includes('melão')) return '🍈';
  if (alimento.includes('morango')) return '🍓';
  if (alimento.includes('uva')) return '🍇';
  if (alimento.includes('laranja') || alimento.includes('tangerina')) return '🍊';
  if (alimento.includes('abacaxi')) return '🍍';
  if (alimento.includes('melancia')) return '🍉';
  if (alimento.includes('abacate')) return '🥑';
  if (alimento.includes('ovo')) return '🥚';
  if (alimento.includes('pão') || alimento.includes('torrada')) return '🥖';
  if (alimento.includes('leite')) return '🥛';
  if (alimento.includes('iogurte')) return '🥣';
  if (alimento.includes('arroz')) return '🍚';
  if (alimento.includes('feijão')) return '🫘';
  if (alimento.includes('frango')) return '🍗';
  if (alimento.includes('carne')) return '🥩';
  if (alimento.includes('peixe') || alimento.includes('atum') || alimento.includes('sardinha')) return '🐟';
  if (alimento.includes('salada') || alimento.includes('alface')) return '🥗';
  if (alimento.includes('brócolis') || alimento.includes('couve')) return '🥦';
  if (alimento.includes('batata')) return '🥔';
  if (alimento.includes('milho') || alimento.includes('cuscuz')) return '🌽';
  if (alimento.includes('suco')) return '🧃';
  if (alimento.includes('água')) return '💧';
  if (alimento.includes('castanha') || alimento.includes('amendoim')) return '🥜';
  return categoria ? ICONE_CATEGORIA[categoria] : '🍴';
}