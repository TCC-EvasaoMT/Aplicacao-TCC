# Interatividade e filtragem cruzada

Resumo, evolução e comparação compartilham o recorte. Clicar num grupo aplica seu filtro ao resumo e à evolução; clicar num ano altera o resumo e a comparação. As ações usam as rotas públicas de catálogo, resumo e análises, com as fórmulas de evasão do backend. A demonstração usa números sintéticos.

## O que cada clique faz

| Onde                                   | Efeito                                                               |
| -------------------------------------- | -------------------------------------------------------------------- |
| Barra ou nome de grupo na comparação   | Aplica o grupo como filtro (ex.: `codigo_curso=001`); repetir remove |
| Botão na primeira coluna da comparação | O mesmo, pelo teclado e leitores de tela (`aria-pressed`)            |
| Ano no gráfico da evolução             | Escolhe o ano do resumo e da comparação                              |
| Botão de ano na tabela da evolução     | O mesmo, pelo teclado e leitores de tela                             |
| × num filtro da faixa do recorte       | Remove aquele filtro; **Limpar tudo** remove todos e mantém o ano    |
| **Desfazer última mudança**            | No estado vazio, volta ao recorte anterior                           |

O filtro aplicado pelo clique é um filtro comum: aparece no cartão de filtros, na faixa do recorte e na URL, e vale para resumo e evolução. Grupo sem identificador (**Não informado (sem identificador)**) não é filtrável, pois a API não aceita filtro por valor ausente.

## A comparação não filtra a si mesma

A comparação deixa de enviar à API o filtro da dimensão pela qual agrupa. Com `codigo_curso=001` e agrupamento por curso, a consulta da comparação sai sem `codigo_curso`: todos os cursos seguem visíveis, o 001 fica em destaque (contorno) e os demais esmaecem. Os outros filtros continuam valendo, e resumo e evolução recebem `codigo_curso=001` normalmente.

Essa regra mantém os outros grupos disponíveis para comparação após o clique. Se o grupo em destaque não aparece, por ausência de registros ou por ficar fora dos grupos retornados, a tela avisa.

## Variação contra o ano anterior

Os cartões do resumo mostram a variação contra o ano anterior com os mesmos filtros. O painel consulta `GET /api/v1/indicadores/resumo` também com `ano` menos um, numa chamada separada: o resumo aparece assim que chega e a variação depois. O ano anterior só é consultado se estiver no catálogo; fora dele, os cartões mostram "sem comparação" sem chamada extra.

- Taxas: diferença em pontos percentuais (`▲ 5 p.p. ante 2022`).
- Totais: variação relativa, só com base anterior positiva (`▼ 90% ante 2022`).
- Valor ausente em qualquer ano: "sem comparação", nunca zero. Falha na consulta do ano anterior não afeta o resumo.
- Um clique num grupo atualiza resumo e evolução. Há também uma consulta ao ano anterior quando ele existe no catálogo; a comparação não muda. O limite padrão da API é 120 chamadas por minuto por IP e processo, configurável. Ao receber `429`, os painéis orientam aguardar.
- Setas em texto e cor neutra: o painel não classifica a mudança como boa ou ruim.

É uma comparação de valores já calculados pela API; as fórmulas de evasão não mudam. Censos de anos diferentes não acompanham a mesma coorte.

## Faixa do recorte

Abaixo do cartão de filtros, uma faixa fica fixa no topo ao rolar a página. Mostra o ano, os filtros ativos (removíveis) e as duas taxas do recorte. Assim, quem clica num gráfico mais abaixo vê o efeito sem voltar ao início. No celular as taxas saem da faixa e, com mais de um filtro, a faixa fica numa linha: o valor do primeiro filtro (o campo fica no `title` e no ×) e **+N**. A lista aberta mostra todos os filtros e **Limpar tudo**, e recolhe ao rolar a página ou ao mudar um filtro. Mudanças feitas pela pessoa (filtro aplicado, removido ou ano escolhido) são anunciadas numa região `role="status"`; ajustes automáticos, como um link antigo saneado, não.

## Recarga sem piscar

Ao mudar o recorte, cada painel mantém os dados anteriores esmaecidos (`.is-refreshing`, com `aria-busy`) até a resposta chegar, em vez de trocar o conteúdo por "Carregando". O texto de carregamento aparece na primeira consulta e quando o último resumo exibido estava sem dados (`exibicao`, em `lib/exibicao.ts`).

A faixa do recorte tem uma limitação: durante uma consulta lenta, ela já mostra os novos filtros, mas pode manter as taxas anteriores sem sinalizar a espera. O resultado correto aparece após a resposta. Esse ajuste está adiado; a revisão o reproduziu com atraso controlado na base sintética.

## Ligação entre gráfico e tabela

Passar o mouse numa barra ou num ano destaca a linha da tabela; passar o mouse ou focar uma linha destaca a barra (contorno) ou o ano (linha tracejada). A linha selecionada tem fundo e barra lateral, sem depender só da cor.

## Detalhes de implementação

- `comparacoes.ts`: `serializarComparacao` omite o filtro da própria dimensão; `alternarFiltroGrupo` e `grupoEmDestaque`.
- `filtros.ts`: `filtrosAtivos` (rótulos dos filtros aplicados) e `selecionarAno`.
- `variacao.ts` (indicadores): `variacaoTaxa` e `variacaoTotal`, com arredondamento simétrico.
- `apresentacao.ts`: `anoNoClique` acha o ano pela posição horizontal do clique. O índice ativo do tooltip do Recharts chega atrasado em toques rápidos e o ponto sob o cursor é redesenhado ao passar o mouse, por isso o clique não depende dele.
- Na comparação, o clique fica na própria barra (`onClick` do `Bar`) e no nome do grupo no eixo, que dão o índice exato.
- `ChipsFiltros.tsx`: faixa do recorte. `PainelIndicadores` guarda o histórico das mudanças para desfazer (`empilhar`) e monta o anúncio (`anuncioMudanca`, em `filtros.ts`).
- `lib/http.ts`: `ErroHttp` guarda o status; `mensagemErro` dá a orientação própria do 429.

## Verificação

`pnpm test` cobre a omissão do filtro da própria dimensão, o clique que aplica e remove, grupo sem identificador, filtros ativos, ano escolhido no gráfico, ano pela posição do clique, as variações (ausência, base zero e arredondamento), o anúncio das mudanças, o dado exibido durante a recarga, o histórico para desfazer e a mensagem do 429. O descarte de respostas antigas (AbortController) foi conferido no navegador, não por teste automatizado.

Com a demonstração, use `?agrupar_por=curso`:

| Ação                               | Resultado esperado                                                                              |
| ---------------------------------- | ----------------------------------------------------------------------------------------------- |
| Clicar em Pedagogia (001)          | Faixa com "Curso: Pedagogia (001)"; resumo com 100 vínculos; 8 grupos visíveis, 001 em destaque |
| Cartões com 001 em 2023            | Curso ▲ 5 p.p., instituição ▲ 1 p.p., vínculos ▼ 90% ante 2022                                  |
| Clicar de novo em Pedagogia        | Filtro removido; 1.090,5 vínculos                                                               |
| Clicar no ano 2022 da evolução     | Resumo e comparação em 2022                                                                     |
| Escolher 2024 com Computação (002) | Estado vazio citando o filtro, com **Desfazer última mudança**                                  |
| Rolar até a comparação             | Faixa do recorte visível no topo                                                                |

Conferido com mouse, toque (emulado no Chrome) e teclado em 1280, 390 e 320 px, com axe-core sem violações. A conferência com leitor de tela real e em outros navegadores continua pendente.
