# Estado da tela, exportação e carregamento

O painel permite compartilhar o estado da tela pela URL e exportar os dados carregados em CSV. Este guia descreve essas ações, a apresentação em telas pequenas e o carregamento dos gráficos. A API calcula as taxas de evasão; o frontend apresenta os resultados recebidos.

## Comportamento da interface

Sem ano escolhido e sem filtros, o painel abre no ano mais recente com dados de alunos. Se o último ano do catálogo só tem docentes, a tela recua e informa o ano pulado. Escolher um ano desliga esse ajuste. Recortes sem alunos mostram uma explicação e ações para voltar ao ano anterior, desfazer a última mudança ou limpar filtros, quando aplicáveis.

Abaixo de 576 px, os sete filtros ficam recolhidos em **Mostrar filtros**. A contagem aparece no cabeçalho do bloco e as seleções ficam na faixa do recorte, descrita em [interatividade](INTERATIVIDADE.md).

Ano, filtros, período e comparação aplicada ficam na URL. Recarregar restaura a seleção; **Copiar link** copia o endereço. Cada tabela oferece **Baixar CSV**, gerado no navegador com os dados já carregados.

Os gráficos incluem zero no eixo e preservam valores negativos. A evolução mostra valores junto aos pontos isolados. A comparação mostra o valor de cada barra e, no celular, o nome do grupo acima delas. Dados ausentes aparecem como `...` nas tabelas, acompanhados do texto acessível "Não disponível" e de uma nota explicativa. As colunas numéricas não quebram linha.

Os rótulos seguem o formato `Nome (código)`, e os textos distinguem singular e plural. **Aplicar período** e **Comparar grupos** usam botões sólidos; as demais ações usam contorno.

## Parâmetros na URL

| Parâmetro                          | Painel     | Observação                                             |
| ---------------------------------- | ---------- | ------------------------------------------------------ |
| `ano` e os sete filtros de recorte | Resumo     | Saneados pelo catálogo, como em **Atualizar dados**    |
| `ano_inicial`, `ano_final`         | Evolução   | Só quando um período foi aplicado; inválido é ignorado |
| `agrupar_por`, `grupos` (repetido) | Comparação | Só quando difere do padrão; até 20 grupos, sem repetir |

Cada painel grava apenas as próprias chaves com `history.replaceState`, sem criar entradas no histórico. Um ano fora do catálogo é ajustado ao mais recente disponível, com aviso. Sem filtros, a seleção automática pode recuar até um ano com dados de alunos.

## CSV

O arquivo atende planilhas em português: separador `;`, vírgula decimal, UTF-8 com BOM e finais de linha CRLF. Textos que começam com `=`, `+`, `-` ou `@` recebem um apóstrofo, para não virarem fórmulas.

- `evasao-mt-evolucao-<inicial>-<final>.csv`: uma linha por ano.
- `evasao-mt-comparacao-<dimensao>-<ano>.csv`: uma linha por grupo, com código e nome.

As colunas trazem os quatro totais, a base de risco, as duas taxas como proporção da API (0,1 = 10%), sem arredondamento, e as marcas de qualidade. Ausências ficam vazias, nunca zero. A última coluna descreve o recorte com os nomes dos parâmetros, por exemplo `ano_inicial=2022; ano_final=2024; codigo_curso=001`.

Na comparação, o CSV contém apenas os grupos carregados. Se houver truncamento, selecione os grupos desejados antes de exportar; o arquivo não busca os demais resultados. Códigos são escritos com seus zeros iniciais. Ao importar numa planilha, defina essas colunas como texto para evitar a conversão automática em números.

## Desempenho

Os componentes dos gráficos usam `React.lazy`, e o download começa em paralelo com a primeira consulta. Enquanto carregam, a interface reserva espaço para o gráfico. A distribuição dos arquivos depende do build. O PrimeReact fica num arquivo próprio (`manualChunks` em `vite.config.ts`). Na revisão de 24/11/2026, após a migração, os maiores arquivos JavaScript tinham cerca de 449 kB (Recharts e código compartilhado), 256 kB (aplicação e React) e 219 kB (PrimeReact), sem o aviso de chunk acima de 500 kB; o CSS caiu de cerca de 244 para 31 kB. Isso não comprova carregamento rápido numa conexão real.

`LimiteErro` impede que uma falha do componente derrube o restante do painel. Porém, gráfico, tabela e CSV pertencem ao mesmo componente lazy: uma falha nesse arquivo também oculta a tabela e a exportação da seção. Filtros e resumo permanecem disponíveis. Separar esses elementos é um ajuste adiado, registrado no [guia de validação](../operacao/VALIDACAO.md#ajustes-adiados).

## Organização

| Arquivo                                      | Responsabilidade                                             |
| -------------------------------------------- | ------------------------------------------------------------ |
| `lib/url.ts`                                 | Leitura e gravação das chaves de cada painel na URL          |
| `lib/useMedia.ts`                            | Media query como estado React (layout do celular)            |
| `lib/Estados.tsx`                            | Indicador de carregamento e espaço reservado do gráfico      |
| `lib/ui.tsx`                                 | Blocos, textos auxiliares, avisos e esmaecimento na recarga  |
| `lib/LimiteErro.tsx`                         | Limite de erro dos gráficos carregados sob demanda           |
| `analises/Celulas.tsx`                       | Tabela, células numéricas, ausência `...` e botão de CSV     |
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

O aceite original deste incremento registrou 55 testes, tipos e build aprovados, além de uma conferência em 1280, 390 e 320 px sem rolagem lateral da página, erros no console ou violações reportadas pelo axe-core. Esse é um registro da entrega, não uma nova auditoria de acessibilidade. A revisão posterior da `main` passou com 66 testes; consulte [evidências e limites](../operacao/VALIDACAO.md). Dados reais, desempenho no volume da pipeline e uso com leitor de tela permanecem pendentes.
