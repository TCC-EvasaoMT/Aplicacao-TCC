# Interatividade e filtragem cruzada

O painel liga resumo, evolução temporal e comparação: um clique num gráfico ou numa tabela muda o recorte dos outros painéis. Tudo usa as rotas existentes (`/api/v1/filtros`, `/api/v1/indicadores/resumo`, `/api/v1/analises/evolucao-temporal` e `/api/v1/analises/comparacoes`). Não há endpoint, parâmetro ou cálculo novo no backend. Os números da demonstração são sintéticos.

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

Sem essa regra, clicar numa barra deixaria uma barra só no gráfico clicado. É o comportamento usual de painéis com filtragem cruzada. Se o grupo em destaque não aparece (sem registros no ano ou fora dos 20 grupos exibidos), a tela avisa.

## Variação contra o ano anterior

Os cartões do resumo mostram a variação contra o ano anterior com os mesmos filtros. O painel consulta `GET /api/v1/indicadores/resumo` também com `ano` menos um, em paralelo. A rota responde mesmo para anos fora do catálogo, com `sem_dados`.

- Taxas: diferença em pontos percentuais (`▲ 5 p.p. ante 2022`).
- Totais: variação relativa, só com base anterior positiva (`▼ 90% ante 2022`).
- Valor ausente em qualquer ano: "sem comparação", nunca zero. Falha na consulta do ano anterior não afeta o resumo.
- Setas em texto e cor neutra: o painel não classifica a mudança como boa ou ruim.

É uma comparação de valores já calculados pela API; as fórmulas de evasão não mudam. Censos de anos diferentes não acompanham a mesma coorte.

## Faixa do recorte

Abaixo do cartão de filtros, uma faixa fica fixa no topo ao rolar a página. Mostra o ano, os filtros ativos (removíveis) e as duas taxas do recorte. Assim, quem clica num gráfico mais abaixo vê o efeito sem voltar ao início. No celular as taxas saem da faixa e, com mais de um filtro, os excedentes ficam em **+N**. Mudanças de filtro são anunciadas numa região `role="status"`.

## Recarga sem piscar

Ao mudar o recorte, cada painel mantém os dados anteriores esmaecidos (`.is-refreshing`) até a resposta chegar, em vez de trocar o conteúdo por "Carregando". O texto de carregamento só aparece na primeira consulta.

## Ligação entre gráfico e tabela

Passar o mouse numa barra ou num ano destaca a linha da tabela; passar o mouse ou focar uma linha destaca a barra (contorno) ou o ano (linha tracejada). A linha selecionada tem fundo e barra lateral, sem depender só da cor.

## Detalhes de implementação

- `comparacoes.ts`: `serializarComparacao` omite o filtro da própria dimensão; `alternarFiltroGrupo` e `grupoEmDestaque`.
- `filtros.ts`: `filtrosAtivos` (rótulos dos filtros aplicados) e `selecionarAno`.
- `variacao.ts` (indicadores): `variacaoTaxa` e `variacaoTotal`, com arredondamento simétrico.
- `apresentacao.ts`: `anoNoClique` acha o ano pela posição horizontal do clique. O índice ativo do tooltip do Recharts chega atrasado em toques rápidos e o ponto sob o cursor é redesenhado ao passar o mouse, por isso o clique não depende dele.
- Na comparação, o clique fica na própria barra (`onClick` do `Bar`) e no nome do grupo no eixo, que dão o índice exato.
- `ChipsFiltros.tsx`: faixa do recorte. `PainelIndicadores` guarda o histórico das mudanças para desfazer.

## Verificação

`pnpm test` cobre a omissão do filtro da própria dimensão, o clique que aplica e remove, grupo sem identificador, filtros ativos, ano escolhido no gráfico, ano pela posição do clique e as variações (ausência, base zero e arredondamento).

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
