# Estilização do frontend

A interface utiliza React, Bootstrap 5.3 e Recharts, alinhando a estilização e os gráficos às tecnologias previstas no documento do TCC. O Bootstrap é uma dependência do pacote `frontend`, instalada pelo workspace pnpm e registrada no lockfile da raiz. Não depende de CDN.

## Carregamento e responsabilidades

`frontend/src/main.tsx` importa `bootstrap/dist/css/bootstrap.min.css` antes de `styles.css`. O Vite inclui ambos no build. Utilizamos o CSS já compilado, sem configuração de Sass.

A fonte **Source Sans 3** é fornecida pelo pacote `@fontsource/source-sans-3`, com os pesos 400, 600 e 700 e o subconjunto latino. Os arquivos acompanham o build e usam `font-display: swap`, sem requisições a serviços externos de fontes. Segoe UI e a fonte do sistema são alternativas de carregamento.

## Identidade visual

O painel prioriza consulta e comparação. O cabeçalho apresenta “Evasão no ensino superior” e o contexto institucional; os dados ocupam o espaço antes reservado à abertura de apresentação. O link “Ir para o conteúdo” aparece ao receber foco de teclado. Explicações metodológicas ficam em “Como interpretar os dados”, um elemento nativo `details`.

| Token                | Valor     | Uso                                |
| -------------------- | --------- | ---------------------------------- |
| `--panel-green`      | `#153F35` | Marca, ações, foco e primeira taxa |
| `--panel-ink`        | `#172E29` | Texto principal                    |
| `--panel-muted`      | `#52675F` | Rótulos e informações auxiliares   |
| `--panel-background` | `#F5F7F7` | Fundo da aplicação                 |
| `--panel-surface`    | `#FFFFFF` | Áreas de leitura e controles       |
| `--panel-secondary`  | `#805128` | Segunda taxa e série               |

A escala tipográfica usa título de 28–32 px, seções de 20 px, texto de 16 px e informações auxiliares de 14 px. Espaçamentos seguem 4, 8, 12, 16, 24 e 32 px. Números de indicadores e tabela usam algarismos de largura uniforme. As duas taxas têm o mesmo peso visual, diferenciadas por cor e nome; os totais usam uma faixa com divisórias. Controles têm cantos de 4 px e painéis de 8 px.

| Camada       | Responsabilidade                                                                                   |
| ------------ | -------------------------------------------------------------------------------------------------- |
| Bootstrap    | Reset, formulários, botões, validação visual, alertas, grade de filtros e tabela responsiva        |
| `styles.css` | Cores e tipografia do projeto, cabeçalho, cartões de indicadores, seções e apresentação do gráfico |
| React        | Seleções, eventos, estado, validação do período e requisições à API                                |
| Recharts     | Renderização das taxas, eixos, legenda e tooltip do gráfico                                        |

Os plugins JavaScript do Bootstrap não são importados: os componentes atuais funcionam com controles nativos e estado React. O tooltip do gráfico pertence ao Recharts. Não foi adicionado React Bootstrap, Tailwind ou shadcn/ui; a menção a shadcn/ui no documento acadêmico ainda precisa ser conciliada com a implementação.

## Uso nos módulos

- **Indicadores:** `row` e `col-12 col-sm-6 col-lg-4` distribuem os filtros em uma, duas ou três colunas. `form-label` e `form-select` estilizam os controles; `btn btn-outline-success` estiliza as ações.
- **Análises:** a grade distribui os campos de período e o botão de aplicação. `form-control`, `is-invalid` e `alert alert-danger` apresentam validação e falhas. `table` e `table-responsive` permitem consultar a série em telas estreitas; `caption-top` mantém o título antes dos dados.
- **Tema:** variáveis `--bs-body-*` preservam fonte, fundo e cor do texto. Variáveis `--bs-btn-*` personalizam os botões; variáveis `--bs-table-*` mantêm as cores da tabela. Regras duplicadas de select, botão e grade foram removidas do CSS próprio.

O framework não altera os contratos HTTP, os cálculos, o comportamento dos filtros ou as responsabilidades dos módulos. Não há configuração adicional no backend ou na pipeline.

## Acessibilidade e manutenção

Preserve rótulos associados aos campos, `aria-invalid`, descrição dos erros, foco visível, estados `disabled` e avisos acessíveis ao editar componentes. A validação continua em `periodo.ts`; a classe `is-invalid` apenas apresenta seu resultado. A tabela mantém cabeçalhos semânticos e pode receber foco para rolagem pelo teclado.

Prefira as classes existentes do Bootstrap para novos controles. Coloque ajustes de identidade visual em `styles.css`, carregado depois do framework, e mantenha componentes e eventos dentro do módulo responsável.

## Execução e verificação

Após atualizar a branch, execute `pnpm install --frozen-lockfile`. Para conferir a interface com dados sintéticos, execute `pnpm dev:demo` e abra `http://127.0.0.1:5173/`.

`pnpm check` verifica tipos, testes e build. Para mudanças de estilo, confira também no navegador: grade de filtros em desktop e celular, foco de teclado, campos desabilitados, intervalo inválido, tabela com rolagem e gráfico. A integração é somente visual; não exige novos testes das fórmulas da API.

Na validação de 22/11/2026, os 30 testes, tipos e build passaram. A interface foi conferida em 1280 px e 390 px com dados sintéticos, incluindo a mensagem de intervalo inválido, limpeza dos filtros, botão desabilitado e tabela acessível com rolagem horizontal. O console não apresentou erros ou avisos. Permanece o aviso de build sobre o tamanho do bundle JavaScript com Recharts, anterior à adoção do Bootstrap.

Referências oficiais: [Bootstrap com Vite](https://getbootstrap.com/docs/5.3/getting-started/vite/) e [variáveis CSS](https://getbootstrap.com/docs/5.3/customize/css-variables/).
