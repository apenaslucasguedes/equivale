import { useMemo, useState } from 'react';
import type { Alimento, BlocoCalorico, Refeicao } from '../domain/types';
import type { RepositorioDeAlimentos } from '../data/alimentos/repositorio';
import type { DadosDoConsumo } from '../domain/blocos';
import { formatarNumero } from '../domain/texto';
import { Gaveta } from './Gaveta';
import { SeletorDeAlimento } from './SeletorDeAlimento';

interface Props {
  aberta: boolean;
  bloco?: BlocoCalorico | null;
  refeicoes: Refeicao[];
  refeicaoInicialId?: string | null;
  repositorio: RepositorioDeAlimentos;
  aoSalvar: (dados: DadosDoConsumo & { refeicaoId: string }) => void;
  aoFechar: () => void;
}

export function GavetaDeConsumo({ aberta, bloco, refeicoes, refeicaoInicialId, repositorio, aoSalvar, aoFechar }: Props) {
  const [alimento, setAlimento] = useState<Alimento | null>(null);
  const [gramas, setGramas] = useState('');
  const [refeicaoId, setRefeicaoId] = useState('');
  const alimentoDoBloco = bloco?.atual.alimentoId ? repositorio.porId(bloco.atual.alimentoId) ?? null : null;
  const escolhido = alimento ?? alimentoDoBloco;
  const quantidade = Number(gramas);
  const kcal = useMemo(() => escolhido && quantidade > 0 ? quantidade * escolhido.kcalPor100g / 100 : 0, [escolhido, quantidade]);
  const destino = (bloco?.atual.refeicaoId ?? refeicaoInicialId ?? refeicaoId) || refeicoes[0]?.id || '';
  const fechar = () => { setAlimento(null); setGramas(''); setRefeicaoId(''); aoFechar(); };
  const nomeDestino = refeicoes.find((refeicao) => refeicao.id === destino)?.nome;

  return (
    <Gaveta aberta={aberta} titulo={bloco ? 'Registrar quantidade real' : 'Adicionar alimento'} subtitulo={bloco ? `Prescrito: ${bloco.original.alimentoNome} · ${formatarNumero(bloco.kcalOriginal ?? bloco.kcal, 0)} kcal` : nomeDestino ? `Novo item em ${nomeDestino}` : 'Registre algo que não estava na dieta.'} aoFechar={fechar}
      rodape={<button type="button" className="botao botao--primario botao--largo" disabled={!escolhido || quantidade <= 0 || !destino} onClick={() => { if (escolhido) aoSalvar({ alimento: { id: escolhido.id, nome: escolhido.nome }, quantidade, kcal, refeicaoId: destino }); fechar(); }}>Salvar no dia · {formatarNumero(kcal, 0)} kcal</button>}>
      {!escolhido ? (
        <SeletorDeAlimento repositorio={repositorio} aoEscolher={setAlimento} rotuloDaBusca="Buscar alimento consumido" />
      ) : (
        <div className="formulario-consumo">
          <div className="consumo__alimento"><div><span>Alimento escolhido</span><strong>{escolhido.nome}</strong></div>{!bloco ? <button type="button" className="botao botao--discreto botao--pequeno" onClick={() => { setAlimento(null); setGramas(''); }}>Trocar</button> : null}</div>
          {!bloco && !refeicaoInicialId ? <label className="campo"><span className="campo__rotulo">Refeição</span><select className="entrada" value={refeicaoId} onChange={(evento) => setRefeicaoId(evento.target.value)}><option value="">Escolha...</option>{refeicoes.map((refeicao) => <option key={refeicao.id} value={refeicao.id}>{refeicao.nome}</option>)}</select></label> : null}
          <label className="campo"><span className="campo__rotulo">Quantidade consumida (g)</span><input className="entrada" type="number" min="0.1" step="0.1" value={gramas} onChange={(evento) => setGramas(evento.target.value)} autoFocus /></label>
          <div className="calculo-consumo"><strong>{formatarNumero(kcal, 0)} kcal</strong><span>{formatarNumero(escolhido.kcalPor100g, 1)} kcal por 100 g</span></div>
        </div>
      )}
    </Gaveta>
  );
}
