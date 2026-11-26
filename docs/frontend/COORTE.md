# Turma de ingresso na interface

A seção **Turma de ingresso** fica na aba **Evolução**, abaixo do gráfico temporal, e consome `GET /api/v1/analises/coorte`. A evolução compara censos diferentes; a turma acompanha os mesmos vínculos de quem ingressou num ano. Contrato, cálculo, decisões e a análise do salto de 2022 para 2023 estão na [API de turma de ingresso](../api/COORTE.md).

## Turma, saída e filtros

**Ano de ingresso** lista os anos do catálogo, do mais antigo ao mais recente; o padrão é o mais antigo, que tem o acompanhamento mais longo. **Saída** alterna entre "Já evadiu do curso" (desvinculados + transferidos) e "Já saiu da instituição" (só desvinculados), sem nova consulta. As escolhas ficam na URL (`turma` e `taxa_turma`); os padrões não são gravados.

Os filtros do painel se aplicam, menos o ano do resumo: o ano aqui é o de ingresso.

## Textos

- **Ajuda fixa:** explica que a turma é a mesma ao longo dos censos, que só entram os cursos com a turma no ano de ingresso e que um salto de um ano pode refletir saídas registradas de uma vez, e não saídas daquele ano.
- **Frase da turma:** tamanho inicial, número de cursos e, no último ano com as três proporções, quanto já evadiu, já concluiu e continua.
- **Sem tamanho inicial:** quando a turma não tem linha no censo do ingresso no recorte, uma mensagem explica que não há o que acompanhar.

## Gráfico, tabela e CSV

O gráfico de linhas mostra já evadiu (verde, contínua e mais grossa), já concluiu (terra, tracejada) e continua no curso (cinza, pontilhada), em proporção do tamanho inicial; a forma da linha muda junto com a cor. O eixo inclui o zero. Anos sem dados da turma ficam como lacuna, não zero. O hover só mostra a dica.

A tabela é a alternativa acessível: censo e anos desde o ingresso, vínculos no ano, as três proporções, o resíduo e os avisos (sem linhas da turma no ano, cursos da turma ausentes, registros fora da turma, dados incompletos, negativos e turma inicial abaixo de 30). O CSV `evasao-mt-turma-<ano>.csv` traz ano de ingresso, tamanho inicial e uma linha por censo, com as duas leituras de saída, seguindo as regras de [estado e exportação](ESTADO_E_EXPORTACAO.md#csv).

## Organização do código

| Arquivo (`src/modules/analises/`) | Responsabilidade                                                                  |
| --------------------------------- | --------------------------------------------------------------------------------- |
| `api.ts`                          | Tipos `Coorte` e `PontoCoorte` e `consultarCoorte`                                |
| `coorte.ts`                       | Funções puras: consulta sem o ano do resumo, turma e saída da URL, frase e avisos |
| `PainelCoorte.tsx`                | Seletores, consulta cancelável, estados e frase                                   |
| `GraficoCoorte.tsx`               | Gráfico do Recharts em chunk lazy, tabela e CSV                                   |
| `exportacao.ts`                   | `csvCoorte`                                                                       |

O gráfico carrega com `React.lazy` e tem limite de erro, como nas outras abas. Enquanto um novo recorte carrega, a última turma fica na tela, esmaecida.

## Validação

`test/coorte.test.ts` cobre a consulta sem o ano do resumo, a turma e a saída da URL, a frase do último ano completo, os avisos e o CSV.

Em 26/11/2026, com `pnpm dev:demo`, no navegador do aplicativo (Chromium):

- turma de 2022 (padrão): 100 vínculos em 1 curso; 2023 com 15% já evadiu, 8% já concluiu, 73% continua e 4% de resíduo, com o registro fora da turma e o negativo sinalizados; 2024 como lacuna e "Sem linhas da turma neste ano";
- turma de 2023 pelo teclado, com "Já saiu da instituição" vindo da URL: 6,34% em 2023 e `turma=2023` gravado;
- 320 px sem rolagem lateral da página.

Não foram verificados leitor de tela real, axe-core, Firefox, Safari nem dados reais.
