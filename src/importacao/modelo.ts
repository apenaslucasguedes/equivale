/** Gera o arquivo Markdown de modelo oferecido pela ação "Baixar modelo". */

export const NOME_DO_ARQUIVO_MODELO = 'modelo-dieta-equivale.md';

export function gerarModeloMarkdown(): string {
  return `---
equivaleVersion: 1
planId: plano-principal
planName: Nome do plano
suggestedDays: seg, ter, qua, qui, sex
---

# Dieta: Nome do plano

<!--
  MODELO DE IMPORTAÇÃO DO EQUIVALE
  ================================

  Como preencher:

  0. O bloco entre "---" no topo (front matter) identifica o PLANO. Tudo nele é
     opcional; sem ele o arquivo vira um plano novo a cada importação.

     • equivaleVersion — versão do formato dos metadados. Hoje: 1.
     • planId — identificador ESTÁVEL do plano (ex.: dias-uteis, fim-de-semana).
       É o que permite, numa importação futura, ATUALIZAR este plano em vez de
       criar outro. A escolha continua sua: o Equivale sempre pergunta antes,
       e nunca substitui os outros planos.
     • planName — nome exibido no seletor de planos do cabeçalho.
     • suggestedDays — dias sugeridos pela nutricionista (seg, ter, qua, qui,
       sex, sáb, dom). São apenas uma anotação: a troca de plano é MANUAL;
       o Equivale não troca de plano sozinho conforme o dia da semana.

     Para manter dois planos (por exemplo "Dias úteis" e "Fim de semana"),
     use um arquivo para cada um, com planId diferente.

  1. O título ("# Dieta: ...") nomeia o plano quando não há planName.
  2. Cada refeição é um título de segundo nível: "## Café da manhã".
     Refeições reconhecidas: Café da manhã, Lanche da manhã, Almoço,
     Lanche da tarde, Jantar e Ceia. Outros nomes também funcionam
     (ex.: "## Pré-treino") e aparecem depois das refeições do dia.
  3. Cada alimento é um item de lista, com campos separados por "|":

     - Alimento | Quantidade e unidade | peso 00 g | 000 kcal | obs: texto

     • Alimento (obrigatório) — sempre o primeiro campo.
     • Quantidade e unidade (obrigatório) — sempre o segundo campo.
       Unidades aceitas: g, ml, unidade, fatia, colher, concha, copo, porção.
     • peso 00 g (opcional) — o peso em gramas, quando a unidade não é g/ml.
     • 000 kcal (opcional, mas RECOMENDADO) — as calorias prescritas do item.
       Sem esse campo, o Equivale tenta calcular pela base de alimentos; se não
       houver correspondência confiável, o item vai para a conferência manual.
     • obs: texto (opcional) — qualquer observação do plano.

     Os campos opcionais podem vir em qualquer ordem.

  4. Linhas em branco, comentários e citações (>) são ignorados.
  5. Apague as refeições que não fizerem parte do seu plano.

  Este arquivo fica no seu aparelho. A importação é local: nada é enviado
  para a internet.
-->

## Café da manhã

- Pão francês | 1 unidade | peso 50 g | 150 kcal | obs: sem manteiga
- Mamão papaia | 100 g | 40 kcal
- Café com leite | 200 ml | 90 kcal

## Lanche da manhã

- Banana prata | 1 unidade | peso 70 g | 70 kcal

## Almoço

- Arroz branco cozido | 100 g | 128 kcal
- Feijão carioca cozido | 80 g | 61 kcal
- Peito de frango grelhado | 120 g | 198 kcal
- Salada de folhas | 1 porção | peso 80 g | 15 kcal

## Lanche da tarde

- Iogurte natural | 170 g | 107 kcal
- Aveia em flocos | 1 colher | peso 15 g | 59 kcal

## Jantar

- Batata-doce cozida | 150 g | 116 kcal
- Tilápia assada | 120 g | 154 kcal

## Ceia

- Leite desnatado | 200 ml | 70 kcal
`;
}
