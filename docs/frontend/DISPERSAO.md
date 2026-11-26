# Dispersão por curso na interface

A aba **Dispersão**, quarta do cabeçalho, consome `GET /api/v1/analises/dispersao` e atende ao RF10: relaciona matrículas e evasão de cada curso num ano, com a linha de alta evasão e a zona crítica calculadas pela API. Contrato, decisões e resultados esperados estão na [API de dispersão](../api/DISPERSAO.md).

## Ano, filtros e taxa

O ano é o mesmo do resumo e da comparação: mudar em qualquer um muda nos três. Os filtros do painel se aplicam, exceto o de curso. Como na comparação, que omite o filtro da dimensão agrupada, a dispersão continua mostrando todos os cursos, e o curso filtrado aparece destacado.

**Taxa no eixo vertical** alterna entre evasão do curso e evasão da instituição. A escolha fica na URL (`taxa_dispersao`), e a evasão do curso é o padrão. Trocar a taxa não refaz a consulta: a resposta já traz as duas taxas, as duas linhas e a zona crítica de cada uma.

## Gráfico

Cada ponto é um curso, com matrículas (cursando mais concluintes) no eixo horizontal e a taxa no vertical. O eixo vertical inclui o zero e acomoda taxas negativas do ruído; os dois eixos têm uma folga para os pontos extremos não ficarem sobre a borda.

| Marcador          | Significado                                                        |
| ----------------- | ------------------------------------------------------------------ |
| Losango cor terra | Zona crítica: taxa acima da linha e base de risco de pelo menos 30 |
| Círculo verde     | Base suficiente, taxa na linha ou abaixo dela                      |
| Círculo vazado    | Base de risco abaixo de 30; nunca entra na zona crítica            |

A forma muda junto com a cor, para a série não depender só dela. A linha tracejada é a linha de alta evasão, com o valor no rótulo. A legenda fica abaixo do gráfico, em HTML.

A dica mostra o curso, as matrículas, a taxa, a base de risco e a situação. Clicar num ponto aplica o curso como filtro no painel inteiro, em todas as abas; clicar de novo remove. Cada ponto tem uma área de toque de 24 px, maior que o marcador. Cursos sem matrículas ou sem a taxa escolhida não têm ponto, mas continuam na tabela.

O hover no gráfico não muda estado, apenas exibe a dica. Qualquer nova renderização durante o hover faz o Recharts recriar o ponto sob o cursor entre `mousedown` e `mouseup`, e o navegador descarta o clique. Por isso a ligação vai num sentido só: foco ou hover numa linha da tabela destaca o ponto, mas o hover no ponto não destaca a linha.

## Textos e avisos

Acima do gráfico, a interface informa a quantidade de cursos, quantos estão na zona crítica e o valor da linha, explicando que é a taxa do conjunto de cursos com essa taxa, somando antes de dividir. Quando algum curso fica fora da linha (base não positiva, medida ausente ou só docentes), um aviso diz quantos e explica que a linha pode diferir da taxa do resumo. Se o curso filtrado não tiver registros no ano, outro aviso informa.

## Tabela e CSV

A tabela é a alternativa acessível ao gráfico e lista todos os cursos em ordem de código, sem ranking: matrículas, base de risco, as duas taxas, zona crítica da taxa escolhida e qualidade. O nome do curso é um botão que aplica ou remove o filtro, com `aria-pressed`. O CSV `evasao-mt-dispersao-<ano>.csv` traz os mesmos totais e marcas de qualidade da comparação e a zona crítica das duas taxas, seguindo as regras de [estado e exportação](ESTADO_E_EXPORTACAO.md#csv).

## Organização do código

| Arquivo (`src/modules/analises/`) | Responsabilidade                                                                                      |
| --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `api.ts`                          | Tipos da resposta e `consultarDispersao`                                                              |
| `dispersao.ts`                    | Funções puras: séries do gráfico, contagens, consulta sem filtro de curso, taxa da URL e teto do eixo |
| `PainelDispersao.tsx`             | Ano, taxa, consulta cancelável, estados, textos e avisos                                              |
| `GraficoDispersao.tsx`            | Gráfico do Recharts em chunk lazy, legenda, tabela e CSV                                              |
| `exportacao.ts`                   | `csvDispersao`                                                                                        |

Os painéis permanecem montados ao trocar de aba. Enquanto um novo recorte carrega, a última dispersão fica na tela, esmaecida. O gráfico tem limite de erro, como nas outras abas.

## Validação

`test/dispersao.test.ts` cobre as séries por zona crítica e base, as contagens, a omissão do filtro de curso, a taxa lida da URL, o rótulo dos cursos, o teto do eixo e o CSV. O teste das abas inclui `dispersao`.

Em 26/11/2026, com `pnpm dev:demo`, no navegador do aplicativo (Chromium):

- 8 cursos em 2023, linha de evasão do curso em 23,46% e de evasão da instituição em 18,25%, com o curso `002` na zona crítica e 3 cursos fora da linha;
- primeiro clique num ponto aplicando o filtro e segundo clique removendo; botão da tabela pressionado;
- troca de taxa pelo teclado, gravada na URL;
- quatro abas sem corte nem rolagem lateral em 320 e 390 px.

Não foram verificados leitor de tela real, axe-core, Firefox, Safari nem dados reais.
