# Finalização do frontend

Este incremento fecha pendências de interface do painel público: tamanho do bundle, leitura dos gráficos, uso no celular, acessibilidade, exportação e link compartilhável. Não altera a API, os cálculos, os contratos HTTP nem a pipeline. As taxas continuam calculadas no backend; a interface apenas apresenta os valores recebidos.

## O que muda para quem usa

- **Primeira tela com dados.** Sem ano escolhido e sem filtros, o painel abre no ano mais recente com dados de alunos. Se o último ano do catálogo só tem docentes, a tela recua e informa o ano pulado. Escolher um ano desliga esse ajuste.
- **Estado vazio com ação.** Um recorte sem alunos mostra título, explicação curta e os botões **Ver ano anterior** e **Limpar filtros**, quando aplicáveis.
- **Filtros no celular.** Abaixo de 576 px, os sete filtros ficam recolhidos em **Mostrar filtros**. Com os campos recolhidos, os filtros ativos aparecem resumidos. A contagem de filtros fica no cabeçalho do bloco.
- **Link da visão.** Ano, filtros, período aplicado e comparação aplicada ficam na URL, com os nomes de parâmetros da API. Recarregar mantém a visão; **Copiar link** copia o endereço.
- **Exportação.** Cada tabela tem **Baixar CSV**, gerado no navegador com os dados já carregados.
- **Gráficos.** A escala das taxas inclui o zero e usa passos arredondados, também com valores negativos. A evolução mostra o valor ao lado de pontos isolados. A comparação mostra o valor no fim de cada barra e, abaixo de 576 px, o nome do grupo acima das barras, sem rolagem lateral.
- **Tabelas.** Dado ausente aparece como `...`, a convenção do IBGE para dado numérico não disponível. Leitores de tela ouvem "Não disponível", e uma nota abaixo da tabela explica o símbolo. Colunas numéricas não quebram linha.
- **Textos.** Concordância de número ("1 registro", "4 grupos") e rótulo de grupo no formato dos filtros: `Nome (código)`.
- **Ações principais.** **Aplicar período** e **Comparar grupos** usam botão sólido; as demais ações seguem com contorno.

## Parâmetros na URL

| Parâmetro                          | Painel     | Observação                                             |
| ---------------------------------- | ---------- | ------------------------------------------------------ |
| `ano` e os sete filtros de recorte | Resumo     | Saneados pelo catálogo, como em **Atualizar dados**    |
| `ano_inicial`, `ano_final`         | Evolução   | Só quando um período foi aplicado; inválido é ignorado |
| `agrupar_por`, `grupos` (repetido) | Comparação | Só quando difere do padrão; até 20 grupos, sem repetir |

Cada painel grava apenas as próprias chaves com `history.replaceState`, sem criar entradas no histórico. Um ano fora do catálogo volta ao mais recente com dados e exibe o aviso de seleção ajustada.

## CSV

O arquivo atende planilhas em português: separador `;`, vírgula decimal, UTF-8 com BOM e finais de linha CRLF. Textos que começam com `=`, `+`, `-` ou `@` recebem um apóstrofo, para não virarem fórmulas.

- `evasao-mt-evolucao-<inicial>-<final>.csv`: uma linha por ano.
- `evasao-mt-comparacao-<dimensao>-<ano>.csv`: uma linha por grupo, com código e nome.

As colunas trazem os quatro totais, a base de risco, as duas taxas como proporção da API (0,1 = 10%), sem arredondamento, e as marcas de qualidade. Ausências ficam vazias, nunca zero. A última coluna descreve o recorte com os nomes dos parâmetros, por exemplo `ano_inicial=2022; ano_final=2024; codigo_curso=001`.

## Desempenho

Os gráficos são carregados com `React.lazy`. O Recharts fica em um chunk próprio, baixado em paralelo com a primeira consulta, e o bundle inicial cai de 722 kB para cerca de 252 kB de JavaScript (79 kB com gzip). O build não emite mais o aviso de chunk acima de 500 kB. Enquanto o chunk carrega, a área do gráfico mantém a altura reservada. Um limite de erro isola falhas do gráfico; filtros, resumo e tabelas continuam utilizáveis.

## Organização

| Arquivo                                      | Responsabilidade                                             |
| -------------------------------------------- | ------------------------------------------------------------ |
| `lib/url.ts`                                 | Leitura e gravação das chaves de cada painel na URL          |
| `lib/useMedia.ts`                            | Media query como estado React (layout do celular)            |
| `lib/Estados.tsx`                            | Indicador de carregamento e espaço reservado do gráfico      |
| `lib/LimiteErro.tsx`                         | Limite de erro dos gráficos carregados sob demanda           |
| `analises/Celulas.tsx`                       | Células numéricas, ausência `...`, nota e botão de CSV       |
| `analises/exportacao.ts`                     | Geração do CSV e descrição do recorte                        |
| `analises/apresentacao.ts`                   | Também `escalaTaxas` (eixo dos gráficos) e `plural`          |
| `filtros.ts`, `periodo.ts`, `comparacoes.ts` | `lerSelecao`, `lerPeriodo` e `lerComparacao` a partir da URL |

## Verificação

`pnpm test` inclui `exportacao.test.ts` (CSV, fórmulas, ausências, negativos e decimais), `url.test.ts` (leitura e saneamento da URL) e testes de escala e concordância em `analises.test.ts`.

Na base de demonstração, confira:

| Ação                                                               | Resultado esperado                                         |
| ------------------------------------------------------------------ | ---------------------------------------------------------- |
| Abrir sem parâmetros                                               | Ano 2023 e aviso de que 2024 ainda não tem dados de alunos |
| Escolher 2024                                                      | Estado vazio com **Ver 2023**                              |
| Curso `001`, 2022, período 2021 a 2024, por modalidade, recarregar | A mesma visão volta pela URL                               |
| `?ano=1999&codigo_curso=999`                                       | 2023, aviso de seleção ajustada                            |
| Curso `001`, **Baixar CSV** da evolução                            | 2022 com 0,1 e 0,09; 2023 com 0,15 e 0,1; 2024 vazio       |
| Curso `005`                                                        | Eixo de -15% a 5%, zero marcado e valores dos pontos       |
| 320 px                                                             | Sem rolagem lateral da página; comparação cabe na tela     |

Na conferência local de 23/11/2026, `pnpm check` passou com 55 testes (31 backend e 24 frontend), tipos e build, sem o aviso de chunk. O build compilado, servido pelo Fastify com a política de segurança de conteúdo ativa, foi conferido em 1280, 390 e 320 px com dados sintéticos: sem rolagem lateral da página, sem erros no console e sem violações do axe-core. A validação com dados reais do INEP, o desempenho no volume da pipeline e a conferência com leitor de tela continuam pendentes.
