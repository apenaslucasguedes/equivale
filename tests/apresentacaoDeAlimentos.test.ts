import { describe, expect, it } from 'vitest';
import {
  alimentoVisivelNoSeletor,
  nomeDoAlimentoNoSeletor,
  preparoDoAlimentoNoSeletor,
} from '../src/ui/apresentacaoDeAlimentos';
import { criarRepositorioSincrono } from './apoio/fabricas';

describe('apresentação dos alimentos no seletor', () => {
  const ovoCozido = criarRepositorioSincrono().todos().find((alimento) => alimento.id === 'TEST_ONLY_ovo_cozido')!;

  it('oferece uma única opção simplificada para ovo de galinha inteiro', () => {
    const opcoes = [
      ovoCozido,
      { ...ovoCozido, id: 'cru', nome: 'Ovo, de galinha, inteiro, cru', codigoDaFonte: '489' },
      { ...ovoCozido, id: 'frito', nome: 'Ovo, de galinha, inteiro, frito', codigoDaFonte: '490' },
      { ...ovoCozido, id: 'clara', nome: 'Ovo, de galinha, clara, cozida/10minutos', codigoDaFonte: '486' },
    ];
    const visiveis = opcoes.filter(alimentoVisivelNoSeletor);

    expect(visiveis).toHaveLength(1);
    expect(visiveis[0]?.id).toBe('TEST_ONLY_ovo_cozido');
    expect(nomeDoAlimentoNoSeletor(visiveis[0]!)).toBe('Ovo de galinha');
    expect(preparoDoAlimentoNoSeletor(visiveis[0]!)).toBeNull();
  });

  it('não esconde alimentos que apenas contêm ovos, como macarrão e maionese', () => {
    expect(alimentoVisivelNoSeletor({
      ...ovoCozido,
      id: 'massa',
      nome: 'Macarrão, trigo, cru, com ovos',
    })).toBe(true);
  });
});