# Estilização do frontend

A interface usa React, PrimeReact 10, Tailwind CSS 4 e Recharts. PrimeReact fornece os controles interativos (botões, listas de seleção, campos, caixas de marcação, mensagens de erro, indicador de carregamento e painéis recolhíveis); Tailwind fornece o layout e toda a aparência, inclusive a desses controles. As dependências pertencem ao pacote `frontend`, ficam registradas no lockfile da raiz e são servidas pela aplicação, sem CDN. A migração substituiu o Bootstrap 5.3 em 24/11/2026; a [comparação com o TCC](../tcc/RASTREABILIDADE.md) registra a relação dessa escolha com o texto acadêmico.

## Versões e licença

O PrimeReact está fixado na linha 10 (`^10.9.9`, publicada pelo fornecedor como `v10-stable`), distribuída sob licença MIT. A versão 11, lançada em julho de 2026, passou a exigir licença da PrimeTek com chave de ativação, inclusive na modalidade gratuita, e reescreveu a API dos componentes. Uma atualização para a versão 11 precisa de decisão do grupo sobre a licença e de nova migração dos componentes; o intervalo `^10` impede que ela seja instalada por engano.

Tailwind usa a versão 4, integrada ao Vite pelo plugin `@tailwindcss/vite`. Não há `tailwind.config.js` nem PostCSS próprio: a configuração está em `src/styles.css`.

## Carregamento e responsabilidades

`frontend/src/main.tsx` envolve a aplicação em `PrimeReactProvider` com a configuração de `src/lib/primereact.ts` e importa as fontes e `styles.css`. O CSS final contém apenas as classes usadas no código; na revisão de 24/11/2026 ele tinha cerca de 31 kB, contra 244 kB com o Bootstrap.

A fonte **Source Sans 3** continua fornecida pelo pacote `@fontsource/source-sans-3`, com os pesos 400, 600 e 700 e o subconjunto latino, sem requisições a serviços externos. Segoe UI e a fonte do sistema são alternativas de carregamento.

| Camada                 | Responsabilidade                                                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `styles.css`           | Importa o Tailwind, define os tokens (`@theme`), as quebras responsivas e as regras de base: fundo, tipografia dos títulos e foco   |
| `lib/primereact.ts`    | Modo sem estilo do PrimeReact, classes Tailwind de cada componente usado (pass-through) e textos em português                       |
| `lib/ui.tsx`           | Peças de apresentação compartilhadas: texto auxiliar, aviso de qualidade, blocos de seção, estados e esmaecimento durante a recarga |
| `lib/CampoLista.tsx`   | Lista de seleção do PrimeReact com os ajustes de acessibilidade descritos abaixo                                                    |
| `analises/Celulas.tsx` | Tabela com rolagem própria, células numéricas, ausência `...`, lista de avisos e exportação                                         |
| React                  | Seleções, eventos, estado, validação do período e requisições à API                                                                 |
| Recharts               | Renderização das taxas, eixos, legenda e tooltip dos gráficos                                                                       |

### PrimeReact sem estilo

O PrimeReact funciona em modo sem estilo (`unstyled: true`): nenhum tema pronto é carregado e cada parte dos componentes recebe classes Tailwind pelo objeto `tema` em `lib/primereact.ts`. Assim, os componentes seguem os tokens do painel em vez da paleta de um tema do fornecedor. Classes passadas a uma instância (`className` ou `pt`) somam-se às do tema (`mergeProps: true`).

O PrimeReact ainda injeta uma folha de estilo pequena com `.p-hidden-accessible`, usada para esconder os campos auxiliares das listas. A CSP do backend já permite estilos inline (`style-src 'unsafe-inline'`), necessária também ao Recharts; veja [proteção da API](../operacao/SEGURANCA_API.md).

| Componente                 | Uso                                                                                    |
| -------------------------- | -------------------------------------------------------------------------------------- |
| `Button`                   | Todas as ações; `outlined` para as secundárias, sólido para aplicar período e comparar |
| `Dropdown` (`CampoLista`)  | Ano do resumo e da comparação, sete filtros e agrupamento                              |
| `InputText`                | Anos do período (`keyfilter="pint"`) e busca de grupos                                 |
| `Checkbox`                 | Seleção de até 20 grupos                                                               |
| `Message`                  | Erros de consulta, de período e do limite de erro dos gráficos                         |
| `ProgressSpinner`          | Indicador de carregamento                                                              |
| `Accordion`/`AccordionTab` | “Selecionar grupos” e “Como interpretar os dados”                                      |

Alguns elementos continuam nativos, estilizados com Tailwind: as tabelas, que precisam de `caption`, cabeçalhos de linha (`th scope="row"`) e da ligação com os gráficos, recursos que o `DataTable` do PrimeReact não oferece da mesma forma; os chips da faixa do recorte, cujo botão de remoção precisa de nome acessível e de área de toque de 44 px; e os botões de ano e grupo dentro das tabelas. Os avisos de qualidade usam `Aviso` em vez de `Message` porque não são alertas: `Message` sempre anuncia o conteúdo como `role="alert"`.

Listas com mais de dez opções, como cursos e municípios, ganham busca por nome ou código dentro da lista aberta. A busca ignora acentos e maiúsculas.

### Acessibilidade das listas

O `Dropdown` do PrimeReact 10 coloca o foco num campo oculto que não se apresenta como combobox, marca a opção ativa num elemento sem foco e inclui um `select` oculto sem nome e uma seta com `role="button"` sem nome. Na conferência com axe-core, essas características geraram violações que o `select` nativo anterior não tinha. `CampoLista` e o tema corrigem esses pontos:

- o campo com foco recebe `role="combobox"`, `aria-expanded`, `aria-controls` e `aria-activedescendant` da opção ativa;
- o `select` oculto e a seta, que só servem ao mouse e ao preenchimento automático, ficam fora da árvore de acessibilidade;
- a lista aberta é inserida dentro do próprio campo (`appendTo="self"`), e não no fim do `body`, para permanecer nos landmarks da página.

Os rótulos continuam associados por `<label for>` ao campo com foco. Ao usar novas listas, prefira `CampoLista` a importar `Dropdown` diretamente.

## Identidade visual

O cabeçalho apresenta “Evasão no ensino superior” e o contexto institucional. A sequência da página é filtros, resumo, evolução e comparação. O link “Ir para o conteúdo” aparece ao receber foco de teclado. As explicações metodológicas ficam em “Como interpretar os dados”, um painel recolhível.

Os tokens ficam em `@theme static` dentro de `styles.css`. Cada token gera utilitários Tailwind (`bg-panel-green`, `text-panel-muted`, `border-panel-line`) e uma variável CSS (`--color-panel-green`), usada pelos gráficos do Recharts. A opção `static` mantém todas as variáveis no CSS, mesmo as que só aparecem no código dos gráficos.

| Token                      | Valor     | Uso                                         |
| -------------------------- | --------- | ------------------------------------------- |
| `--color-panel-green`      | `#153F35` | Marca, ações, foco e primeira taxa          |
| `--color-panel-ink`        | `#172E29` | Texto principal                             |
| `--color-panel-muted`      | `#52675F` | Rótulos e informações auxiliares            |
| `--color-panel-background` | `#F5F7F7` | Fundo da aplicação e cabeçalho das tabelas  |
| `--color-panel-surface`    | `#FFFFFF` | Áreas de leitura e controles                |
| `--color-panel-secondary`  | `#805128` | Segunda taxa e série                        |
| `--color-panel-line`       | `#DCE5E1` | Divisórias e bordas dos blocos              |
| `--color-panel-border`     | `#B9CBC3` | Bordas de controles, chips e tabelas        |
| `--color-panel-chip`       | `#E8F0EB` | Chips, item selecionado e linha selecionada |
| `--color-panel-warning-*`  | âmbar     | Avisos de qualidade                         |
| `--color-panel-danger-*`   | vermelho  | Mensagens de erro                           |
| `--color-panel-invalid`    | `#B42318` | Campo com valor inválido                    |

As quebras responsivas foram ajustadas para manter as larguras da versão anterior: `sm` em 576 px e `lg` em 992 px; `md` permanece em 768 px. O hook `useMedia('(max-width: 575px)')` usa a mesma referência.

A escala tipográfica usa título de 28 a 32 px, seções de 20 px, texto de 16 px e informações auxiliares de 14 px. Espaçamentos seguem 4, 8, 12, 16, 24 e 32 px, que correspondem aos utilitários Tailwind 1, 2, 3, 4, 6 e 8. Números de indicadores e tabelas usam algarismos de largura uniforme (`tabular-nums`). As duas taxas têm o mesmo peso visual, diferenciadas por cor e nome; os totais usam uma faixa com divisórias. Controles têm cantos de 4 px (`rounded`) e blocos de 8 px (`rounded-lg`).

## Uso nos módulos

- **Indicadores:** a grade de filtros usa uma coluna abaixo de 576 px, duas colunas até 767 px, com o curso numa linha própria, e quatro colunas a partir de 768 px, com o curso em meia linha. O seletor de ano fica no cabeçalho do resumo.
- **Análises:** os campos de período e o botão de aplicação ficam numa grade de duas colunas no celular e numa linha a partir de 576 px. O campo inválido recebe borda vermelha, `aria-invalid` e foco; o erro aparece numa `Message`. As tabelas têm rolagem horizontal própria, sem ampliar a página, e legenda antes dos dados. A comparação usa um painel recolhível para a seleção opcional de grupos e barras horizontais nas mesmas cores das taxas. Abaixo de 576 px, o gráfico de comparação coloca o nome do grupo acima das barras. Estados vazio, carregando e erro, botões principais sólidos e filtros recolhidos no celular estão em [Estado e exportação](ESTADO_E_EXPORTACAO.md). Veja [Comparações na interface](COMPARACOES.md).
- **Tema:** o fundo, a cor do texto, a tipografia dos títulos e o contorno de foco estão em `@layer base`. As únicas regras fora das camadas tratam de elementos internos do Recharts e da animação de entrada dos chips.

A migração não alterou os contratos HTTP, os cálculos, o comportamento dos filtros, a serialização da URL, o CSV ou as responsabilidades dos módulos. As funções puras e seus testes permanecem iguais.

## Acessibilidade e manutenção

Preserve rótulos associados aos campos, `aria-invalid`, descrição dos erros, foco visível, estados desabilitados e avisos acessíveis ao editar componentes. A validação continua em `periodo.ts`; a borda vermelha apenas apresenta seu resultado. As tabelas mantêm cabeçalhos semânticos e podem receber foco para rolagem pelo teclado. Movimentos (transições, abertura das listas e chips) usam `motion-safe`/`motion-reduce` e somem quando o sistema pede menos movimento.

`campoInvalidoPeriodo` reutiliza a validação para identificar onde corrigir um intervalo. `PainelEvolucao` mantém referências aos campos e foca esse campo ao rejeitar a aplicação do período.

Para novos controles, use os componentes do PrimeReact já configurados e acrescente ao tema de `lib/primereact.ts` apenas os que forem necessários. Escreva o layout com utilitários Tailwind no próprio componente; extraia uma peça para `lib/ui.tsx` quando o mesmo conjunto de classes se repetir em mais de um módulo. Evite passar a uma instância um utilitário que conflite com o tema (por exemplo, outra margem ou largura na mesma propriedade), pois a ordem do CSS, e não a da classe, decide qual vale. Novas cores entram como tokens em `@theme`.

## Execução e verificação

Após atualizar a branch, execute `pnpm install --frozen-lockfile`. Para conferir a interface com dados sintéticos, execute `pnpm dev:demo` e abra `http://127.0.0.1:5173/`.

`pnpm check` verifica tipos, testes e build. Para mudanças de estilo, confira também no navegador: grade de filtros em desktop e celular, abertura das listas pelo teclado, busca nas listas longas, foco, campos desabilitados, intervalo inválido, tabela com rolagem e gráficos.

A conferência da migração em 24/11/2026 registrou 35 testes do frontend, tipos, build e formatação aprovados. Com a API e PostgreSQL sintético, a interface foi comparada lado a lado com a versão anterior em 1280 px e conferida em 390 e 320 px, sem rolagem lateral da página nem erros no console. Foram exercitados: listas pelo teclado, busca sem acento, aplicação de filtros e ano, período inválido com foco no ano final, seleção e limite de grupos, clique na tabela para filtrar, painel de leitura, erro `429` e erro da evolução. axe-core não reportou violações em 1280 e 390 px, inclusive com lista e seleção de grupos abertas; a versão anterior também não tinha violações na mesma página. O build compilado foi servido pelo Fastify com a CSP de produção. Leitor de tela real, outros navegadores e dados reais permanecem pendentes; consulte o [registro de validação](../operacao/VALIDACAO.md).

Referências oficiais: [PrimeReact 10 em modo sem estilo](https://v10.primereact.org/unstyled/), [pass-through](https://v10.primereact.org/passthrough/) e [Tailwind CSS com Vite](https://tailwindcss.com/docs/installation/using-vite).
