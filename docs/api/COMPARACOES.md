# API de comparações

`GET /api/v1/analises/comparacoes` compara totais e taxas entre grupos de um mesmo ano. Pertence ao módulo `analises`, é pública e usa a Gold existente. O [frontend comparativo](../frontend/COMPARACOES.md) apresenta seleção, gráfico e tabela no painel público. Resumo, filtros e evolução temporal mantêm seus contratos.

## Consulta

```http
GET /api/v1/analises/comparacoes?ano=2023&agrupar_por=categoria_administrativa
GET /api/v1/analises/comparacoes?ano=2023&agrupar_por=curso&grupos=001&grupos=002
```

| Parâmetro          | Regra                                                                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ano`              | Obrigatório, inteiro entre 1900 e 9999. Um ano por comparação.                                                                                                                                    |
| `agrupar_por`      | Obrigatório; uma das sete dimensões abaixo.                                                                                                                                                       |
| `limite`           | Inteiro de 1 a 20; padrão 20. Limita a quantidade de grupos retornados, não os registros somados.                                                                                                 |
| `grupos`           | Seleção opcional de até 20 valores distintos da dimensão. Repita o parâmetro para selecionar mais de um; uma única ocorrência também é aceita.                                                    |
| Filtros de recorte | Os sete filtros opcionais do resumo: `codigo_curso`, `codigo_area_geral`, `codigo_municipio_oferta`, `modalidade`, `categoria_administrativa`, `organizacao_academica` e `codigo_municipio_sede`. |

| `agrupar_por`              | Valor utilizado em `grupos` e retornado em `grupo.valor` | Rótulo em `grupo.nome`      |
| -------------------------- | -------------------------------------------------------- | --------------------------- |
| `curso`                    | Código original do curso                                 | Nome do curso               |
| `area_geral`               | Código da área geral CINE                                | Nome da área                |
| `municipio_oferta`         | Código IBGE do município de oferta                       | Nome do município de oferta |
| `municipio_sede`           | Código IBGE do município da sede                         | Nome do município da sede   |
| `modalidade`               | Texto da modalidade                                      | Mesmo texto                 |
| `categoria_administrativa` | Texto da categoria                                       | Mesmo texto                 |
| `organizacao_academica`    | Texto da organização                                     | Mesmo texto                 |

Use os códigos e textos retornados por `/api/v1/filtros`. Códigos permanecem strings, incluindo zeros iniciais. Na seleção por código, cada valor deve conter somente dígitos, com até 32 caracteres. Textos devem ter de 1 a 200 caracteres e não podem conter apenas espaços. Não há comparação nominal entre IES: as características institucionais podem reunir várias instituições.

Os filtros de recorte combinam por E; os valores de `grupos` combinam por OU dentro desse recorte. Filtrar `codigo_curso=001` e selecionar `grupos=002` retorna vazio. A API respeita todos os filtros recebidos. A [filtragem cruzada do frontend](../frontend/INTERATIVIDADE.md) omite o filtro da dimensão agrupada antes de enviar a requisição; essa é uma regra da interface.

`grupos=001&grupos=002` é válido; `grupos=001,002` não é uma lista de códigos válida. Somente `grupos` pode ser repetido. Duplicatas na seleção, filtros repetidos, campos desconhecidos, limites fora da faixa e valores inválidos retornam `400` antes da consulta ao banco. `ano_inicial`, `ano_final`, ordenação por taxa e IDs sequenciais não são parâmetros desta rota.

## Resposta e limites

A resposta contém:

- `filtros`: parâmetros aplicados, incluindo `limite` e a seleção `grupos` normalizada como array quando fornecida.
- `total_grupos`: quantidade encontrada após filtros e seleção, antes de aplicar o limite.
- `truncado`: indica que o recorte contém mais grupos do que os retornados.
- `grupos`: resultados com `grupo: { valor, nome }`, `totais`, `base_risco`, `taxas` e `qualidade`.

A ordenação é textual crescente pelo código/atributo, com collation `C` no PostgreSQL, e valores nulos por último. Ela não é numérica nem ordenada pela taxa e não constitui um ranking. Se `truncado=true`, refine os filtros ou envie `grupos` para selecionar os grupos desejados, inclusive aqueles fora da primeira lista. A rota não oferece paginação.

O limite é aplicado depois da agregação e da contagem dos grupos. Não recorta os cursos que compõem um grupo nem modifica suas taxas. O cliente não deve apresentar a soma da lista truncada como total do recorte ou classificar os grupos omitidos como ausentes.

Um grupo solicitado que não tem registros no ano/recorte não é retornado: não são criadas contagens zero. A seleção aplicada permanece em `filtros.grupos`, permitindo ao cliente identificar quais valores não foram encontrados. Um recorte inteiro sem registros retorna `200`, `grupos: []`, `total_grupos: 0` e `truncado: false`.

## Cálculos e qualidade

Cada grupo reutiliza as regras do [resumo anual](../../backend/README.md#cálculos-e-qualidade). A base é a soma dos vínculos menos a soma dos falecidos; evasão do curso usa desvinculados mais transferidos, e evasão da IES usa desvinculados. As taxas são proporções e usam as somas, nunca médias das taxas dos cursos.

Valores negativos e decimais permanecem no resultado. Base ausente ou não positiva e numerador ausente produzem taxa `null`. Medidas parcialmente ausentes continuam `null`, com `dados_incompletos=true`. A sinalização de grupo pequeno é recalculada pela base agregada, com limite estrito de 30.

Um grupo com apenas docentes continua presente, com medidas de alunos nulas, `sem_dados=true` e `registros_sem_alunos` maior que zero. Isso é diferente de um grupo sem qualquer registro, que não aparece na lista.

Sem seleção explícita, registros com identificador nulo ficam juntos no grupo `{ valor: null, nome: null }`, sem ID artificial. Em municípios de oferta, esse grupo pode incluir EaD e localidades não informadas; nunca recebe o município da sede como substituto. A seleção `grupos` aceita apenas códigos/textos existentes, sem um marcador especial para selecionar nulos.

O agrupamento usa somente o código ou atributo, não o nome. Se um código tiver rótulos divergentes, escolhe o menor nome não nulo pela collation `C`, mantendo todos os valores agregados juntos. Se não houver rótulo, `nome` será `null`. Essa escolha determinística não corrige inconsistências da referência: elas devem ser tratadas na pipeline. Atributos textuais como `Não informado` permanecem grupos textuais próprios.

## Implementação

- `comparacoes.ts` define as dimensões permitidas, tipos, limite e montagem dos resultados usando `calcularResumo`.
- `consultas.ts` executa uma consulta SQL com agrupamento e contagem antes do limite.
- `schemas.ts` valida o contrato e documenta as respostas; `rotas.ts` normaliza a seleção única e coordena a consulta.
- A entrada pública de `indicadores` fornece filtros, agregação, schemas e cálculo; não há fórmulas duplicadas nem importação de arquivos internos entre módulos.

Identificadores SQL vêm exclusivamente da lista interna de agrupamentos. Ano, filtros, seleção e limite usam parâmetros do `pg`. A consulta usa `gold.fato_evasao_curso` e suas seis dimensões, com a mesma role de leitura e os mesmos grants. Não adiciona dependências, configuração, migrações, autenticação ou alterações na pipeline.

Erros: `400` para parâmetros inválidos, `429` para limite HTTP, `503` para Gold indisponível e `500` para falha interna. Mantém os cabeçalhos de segurança e logs controlados da API pública.

## Testar na demonstração

Execute `pnpm dev:demo` e abra [Swagger](http://127.0.0.1:5173/docs/), seção **Análises**. Não é necessário login. Exemplo no PowerShell:

```powershell
Invoke-RestMethod 'http://127.0.0.1:3000/api/v1/analises/comparacoes?ano=2023&agrupar_por=curso&grupos=001&grupos=002' | ConvertTo-Json -Depth 8
```

Resultados esperados com as fixtures:

| Recorte de 2023                                      | Vínculos | Evasão do curso | Evasão da IES |
| ---------------------------------------------------- | -------- | --------------- | ------------- |
| Curso `001`                                          | 100      | 0.15            | 0.10          |
| Curso `002`                                          | 900      | 0.25            | 0.20          |
| Categoria `Pública Federal`, reunindo os dois cursos | 1000     | 0.24            | 0.19          |

`agrupar_por=curso&limite=2` retorna os cursos `001` e `002`, `total_grupos=8` e `truncado=true`. `grupos=007&grupos=008` seleciona diretamente esses dois cursos. Com `agrupar_por=municipio_oferta`, o grupo nulo contém os 900 vínculos do curso EaD e um registro apenas de docentes. Em 2024, a comparação por curso retorna somente o grupo `003`, sem medidas de alunos; em 1999, retorna lista vazia.

## Validação automatizada

`test/comparacoes.test.ts` cobre entradas inválidas, seleção única/múltipla, códigos com zeros, erros controlados, contrato Swagger e parametrização. A suíte de segurança inclui a nova rota na verificação de acesso público e cabeçalhos.

`test/integration/comparacoes.ts`, executado pela suíte PostgreSQL existente, compara as sete dimensões com os resumos anuais equivalentes. Também verifica taxas sobre somas, qualidade, seleção de grupos, filtros combinados, EaD, identificadores nulos, rótulos divergentes/ausentes e truncamento com 33 grupos sintéticos. O teste de reconstrução da Gold confere a recuperação da comparação após reaplicar grants e mudar IDs internos.

Execute `pnpm test:integration` com `TEST_DATABASE_URL` apontando para o banco isolado de testes. A suíte eleva somente sua cota HTTP para comportar os recortes comparados em sequência; o padrão da aplicação continua em 120 chamadas/minuto. A medição da comparação sintética ficou abaixo de três segundos, mas desempenho e resultados reais ainda precisam ser validados com a Gold da pipeline.
