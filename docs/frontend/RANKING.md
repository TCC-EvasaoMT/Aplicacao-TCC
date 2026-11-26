# Ranking de áreas e modalidades na interface

O painel **Ranking de áreas e modalidades** fica no topo da aba **Comparação**, antes da comparação entre grupos, e atende ao RF12: mostra as duas classificações ao mesmo tempo, uma tabela para áreas gerais CINE e outra para modalidades. Cada tabela faz uma consulta a `GET /api/v1/analises/ranking`. Contrato, critérios e resultados esperados estão na [API de ranking](../api/RANKING.md).

O painel não ganhou aba própria porque uma quinta aba não cabe no cabeçalho em 320 px. A comparação continua como estava: uma dimensão por vez, em ordem de código, com até 20 grupos.

## Ano, filtros e taxa

O ano é o mesmo do resumo, da comparação e da dispersão. Os filtros do painel se aplicam às duas tabelas, exceto o da própria dimensão: o ranking de áreas ignora o filtro de área e destaca a área filtrada, e o de modalidades faz o mesmo com a modalidade. Assim, filtrar Computação mantém todas as áreas no primeiro ranking e restringe o segundo às modalidades de Computação.

**Ordenar por** alterna entre evasão do curso e evasão da instituição, nas duas tabelas ao mesmo tempo. A escolha fica na URL (`taxa_ranking`), e a evasão do curso é o padrão. Trocar a taxa refaz as consultas, porque a ordem e as posições mudam.

## Tabelas

Cada tabela tem posição, categoria, taxa escolhida, base de risco e qualidade. A taxa vem com uma barra proporcional à maior taxa classificada, decorativa (`aria-hidden`): o valor está sempre escrito ao lado. Grupos sem posição e taxas negativas não têm barra.

| Posição         | Significado                                                                      |
| --------------- | -------------------------------------------------------------------------------- |
| `1º`, `2º`      | Classificada, da maior para a menor taxa                                         |
| `2º (empate)`   | Mesma taxa de outra categoria; a seguinte pula posições (1º, 2º, 2º, 4º)         |
| `—`             | Sem posição; o motivo é o primeiro aviso da coluna de qualidade                  |
| `Sem registros` | Categoria do catálogo sem registros no ano e recorte; nenhuma medida é inventada |

Os motivos sem posição são "base de risco abaixo do mínimo" (menos de 30), "taxa indisponível" e "categoria sem identificador". A coluna de qualidade traz em seguida os mesmos avisos do resumo para aquela categoria. As linhas "Sem registros" vêm das áreas e modalidades do catálogo de filtros que a resposta não trouxe, para a tabela cobrir todas as categorias. Acima de cada tabela, um texto informa quantas categorias há e quantas foram classificadas.

O nome da categoria é um botão que aplica ou remove o filtro (`codigo_area_geral` ou `modalidade`) no painel inteiro, em todas as abas, com `aria-pressed` e `title` "Filtrar o painel inteiro por …". A linha selecionada ganha o destaque das outras tabelas, e uma linha acima da tabela informa "Painel filtrado por Educação (01). Clique de novo no nome para remover." A ajuda do painel explica o mesmo. O grupo sem identificador não tem botão, porque não há valor para filtrar.

## Layout

As duas tabelas ficam empilhadas até 1.399 px e lado a lado a partir de 1.400 px, largura em que as duas cabem sem rolagem. Posição, categoria e base de risco usam células sem a largura mínima das outras tabelas (`classesTabelaCompacta`), e a barra é estreita para caber em meia largura. Em telas pequenas, a tabela rola dentro da própria região, que recebe foco pelo teclado; a página não ganha rolagem lateral.

## CSV

Cada tabela tem seu botão de exportação: `evasao-mt-ranking-area_geral-<ano>.csv` e `evasao-mt-ranking-modalidade-<ano>.csv`. As colunas são posição, empate, situação, código e nome, seguidas dos mesmos totais, taxas e marcas de qualidade da comparação, conforme as regras de [estado e exportação](ESTADO_E_EXPORTACAO.md#csv). As linhas "Sem registros" ficam fora do CSV, que contém só o que a API devolveu.

## Organização do código

| Arquivo (`src/modules/analises/`) | Responsabilidade                                                                                    |
| --------------------------------- | --------------------------------------------------------------------------------------------------- |
| `api.ts`                          | Tipos da resposta e `consultarRanking`                                                              |
| `ranking.ts`                      | Funções puras: consulta sem o filtro da dimensão, taxa da URL, rótulos, motivos, categorias e barra |
| `PainelRanking.tsx`               | Taxa, consultas canceláveis, estados, tabelas e CSV                                                 |
| `Celulas.tsx`                     | Classes das células, incluindo `classesTabelaCompacta`                                              |
| `exportacao.ts`                   | `csvRanking`                                                                                        |

Enquanto um novo recorte carrega, o último ranking fica na tela, esmaecido. Uma falha numa tabela mostra a mensagem e o botão de tentar de novo só nela.

## Validação

`test/ranking.test.ts` cobre a omissão do filtro da própria dimensão, os rótulos de posição e de empate, os motivos, as categorias sem registros, a barra, a taxa lida da URL, o rótulo das categorias e o CSV.

Em 26/11/2026, com `pnpm dev:demo`, no navegador do aplicativo (Chromium):

- 2023 sem filtros: áreas com Computação (06) em 1º, 24,79%, Educação (01) sem taxa e o grupo sem identificador; modalidades com A distância em 1º, 25%, e as outras duas sem taxa;
- clique em Computação aplicando o filtro: o ranking de áreas mantém as três linhas com o destaque, e o de modalidades passa a A distância em 1º e Presencial em 2º, com "Não informado" como sem registros;
- troca de taxa pelo teclado, gravada na URL e refletida nas legendas;
- 320, 390, 1.024 e 1.280 px empilhados sem rolagem lateral da página; 1.440 px lado a lado sem rolagem nas tabelas.

Não foram verificados leitor de tela real, axe-core, Firefox, Safari nem dados reais.
