# Estilização do frontend

A interface usa React, Bootstrap 5.3 e Recharts. O Bootstrap é uma dependência do pacote `frontend`, instalada pelo workspace pnpm e registrada no lockfile da raiz. Seus arquivos são servidos pela aplicação, sem CDN. A [comparação com o TCC](../tcc/RASTREABILIDADE.md) registra a diferença entre essa escolha e a previsão de usar também shadcn/ui.

## Carregamento e responsabilidades

`frontend/src/main.tsx` importa `bootstrap/dist/css/bootstrap.min.css` antes de `styles.css`. O Vite inclui ambos no build. Utilizamos o CSS já compilado, sem configuração de Sass.

A fonte **Source Sans 3** é fornecida pelo pacote `@fontsource/source-sans-3`, com os pesos 400, 600 e 700 e o subconjunto latino. Os arquivos acompanham o build e usam `font-display: swap`, sem requisições a serviços externos de fontes. Segoe UI e a fonte do sistema são alternativas de carregamento.

## Identidade visual

O cabeçalho apresenta “Evasão no ensino superior” e o contexto institucional. A sequência da página é filtros, resumo, evolução e comparação. O link “Ir para o conteúdo” aparece ao receber foco de teclado. As explicações metodológicas ficam em “Como interpretar os dados”, um elemento nativo `details`.

| Token                | Valor     | Uso                                |
| -------------------- | --------- | ---------------------------------- |
| `--panel-green`      | `#153F35` | Marca, ações, foco e primeira taxa |
| `--panel-ink`        | `#172E29` | Texto principal                    |
| `--panel-muted`      | `#52675F` | Rótulos e informações auxiliares   |
| `--panel-background` | `#F5F7F7` | Fundo da aplicação                 |
| `--panel-surface`    | `#FFFFFF` | Áreas de leitura e controles       |
| `--panel-secondary`  | `#805128` | Segunda taxa e série               |

A escala tipográfica usa título de 28 a 32 px, seções de 20 px, texto de 16 px e informações auxiliares de 14 px. Espaçamentos seguem 4, 8, 12, 16, 24 e 32 px. Números de indicadores e tabela usam algarismos de largura uniforme. As duas taxas têm o mesmo peso visual, diferenciadas por cor e nome; os totais usam uma faixa com divisórias. Controles têm cantos de 4 px e painéis de 8 px.

| Camada       | Responsabilidade                                                                                   |
| ------------ | -------------------------------------------------------------------------------------------------- |
| Bootstrap    | Reset, formulários, botões, validação visual, alertas, grade de filtros e tabela responsiva        |
| `styles.css` | Cores e tipografia do projeto, cabeçalho, cartões de indicadores, seções e apresentação do gráfico |
| React        | Seleções, eventos, estado, validação do período e requisições à API                                |
| Recharts     | Renderização das taxas, eixos, legenda e tooltip do gráfico                                        |

Os plugins JavaScript do Bootstrap não são importados: os componentes atuais funcionam com controles nativos e estado React. O tooltip do gráfico pertence ao Recharts. Não foi adicionado React Bootstrap, Tailwind ou shadcn/ui; a menção a shadcn/ui no documento acadêmico ainda precisa ser conciliada com a implementação.

## Uso nos módulos

- **Indicadores:** a grade `row` reserva meia linha ao curso e um quarto aos demais filtros a partir de 768 px. Em telas menores, usa uma ou duas colunas. O seletor de ano fica no cabeçalho do resumo. `form-label` e `form-select` estilizam os controles; `btn btn-outline-success` estiliza as ações.
- **Análises:** a grade distribui os campos de período e o botão de aplicação. `form-control`, `is-invalid` e `alert alert-danger` apresentam validação e falhas. `table` e `table-responsive` permitem consultar as séries e comparações em telas estreitas; `caption-top` mantém o título antes dos dados. A comparação usa `details` para a seleção opcional, checkboxes nativos com `form-check-input` e barras horizontais nas mesmas cores das taxas. O eixo inclui zero. A tabela possui rolagem horizontal própria, sem ampliar a página; abaixo de 576 px o gráfico de comparação coloca o nome do grupo acima das barras. Estados vazio, carregando e erro, botões principais sólidos e filtros recolhidos no celular estão em [Estado e exportação](ESTADO_E_EXPORTACAO.md). Veja [Comparações na interface](COMPARACOES.md).
- **Tema:** variáveis `--bs-body-*` preservam fonte, fundo e cor do texto. Variáveis `--bs-btn-*` personalizam os botões; variáveis `--bs-table-*` mantêm as cores da tabela. Regras duplicadas de select, botão e grade foram removidas do CSS próprio.

O framework não altera os contratos HTTP, os cálculos, o comportamento dos filtros ou as responsabilidades dos módulos. Não há configuração adicional no backend ou na pipeline.

## Acessibilidade e manutenção

Preserve rótulos associados aos campos, `aria-invalid`, descrição dos erros, foco visível, estados `disabled` e avisos acessíveis ao editar componentes. A validação continua em `periodo.ts`; a classe `is-invalid` apenas apresenta seu resultado. A tabela mantém cabeçalhos semânticos e pode receber foco para rolagem pelo teclado.

`campoInvalidoPeriodo` reutiliza a validação para identificar onde corrigir um intervalo. `PainelEvolucao` mantém referências aos inputs e foca esse campo ao rejeitar a aplicação do período. A classe de erro e `aria-invalid` identificam o mesmo campo. Não há alteração nas fórmulas, na serialização dos filtros ou no contrato HTTP.

Prefira as classes existentes do Bootstrap para novos controles. Coloque ajustes de identidade visual em `styles.css`, carregado depois do framework, e mantenha componentes e eventos dentro do módulo responsável.

## Execução e verificação

Após atualizar a branch, execute `pnpm install --frozen-lockfile`. Para conferir a interface com dados sintéticos, execute `pnpm dev:demo` e abra `http://127.0.0.1:5173/`.

`pnpm check` verifica tipos, testes e build. Para mudanças de estilo, confira também no navegador: grade de filtros em desktop e celular, foco de teclado, campos desabilitados, intervalo inválido, tabela com rolagem e gráfico. A integração é somente visual; não exige novos testes das fórmulas da API.

O aceite do refinamento em 22/11/2026 registrou 31 testes, tipos e build aprovados. A interface foi conferida em 1280, 390 e 320 px com dados sintéticos: fonte local, ordem dos indicadores, foco dos erros, atalho para o conteúdo, filtros, ausência, valores negativos e tabela com rolagem própria. Não houve rolagem horizontal da página em 320 px nem erros ou avisos no console. O aviso de tamanho do bundle existia naquele build; não apareceu na revisão de 23/11/2026. Consulte o [registro de validação](../operacao/VALIDACAO.md) para os limites dessas verificações.

Referências oficiais: [Bootstrap com Vite](https://getbootstrap.com/docs/5.3/getting-started/vite/) e [variáveis CSS](https://getbootstrap.com/docs/5.3/customize/css-variables/).
