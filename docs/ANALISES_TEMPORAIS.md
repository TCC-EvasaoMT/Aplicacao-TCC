# API de evolução temporal

O módulo `backend/src/modules/analises` consulta a evolução anual de um recorte da Gold. A API pode ser consultada pelo Swagger e pelo [gráfico temporal do frontend](FRONTEND_ANALISES.md), com controles de intervalo e tabela de valores anuais.

## Consulta

```http
GET /api/v1/analises/evolucao-temporal?ano_inicial=2022&ano_final=2024&codigo_curso=001
```

| Parâmetro                  | Regra                                                            |
| -------------------------- | ---------------------------------------------------------------- |
| `ano_inicial`              | Inteiro obrigatório entre 1900 e 9999                            |
| `ano_final`                | Inteiro obrigatório entre 1900 e 9999, maior ou igual ao inicial |
| `codigo_curso`             | Código original como texto                                       |
| `codigo_area_geral`        | Código CINE como texto; mantém zeros iniciais                    |
| `codigo_municipio_oferta`  | Código do local de oferta, sem substituição pela sede            |
| `modalidade`               | Texto retornado pelo catálogo                                    |
| `categoria_administrativa` | Texto retornado pelo catálogo                                    |
| `organizacao_academica`    | Texto retornado pelo catálogo                                    |
| `codigo_municipio_sede`    | Código da sede institucional                                     |

O intervalo é inclusivo e aceita de **1 a 30 anos**. `2000–2029` é válido; `2000–2030` excede o limite. Esse limite inicial mantém a resposta limitada e não substitui a medição com a base real. Os sete filtros opcionais combinam por **E** e aceitam um valor por parâmetro. Parâmetros desconhecidos, repetidos, vazios ou inválidos retornam `400`; o parâmetro `ano` do resumo anual não é aceito nesta rota.

É permitido solicitar anos que não aparecem em `/api/v1/filtros`: eles serão representados como lacunas, sem inventar medidas. As rotas atuais de catálogo e resumo permanecem inalteradas.

## Resposta

A resposta tem dois campos: `filtros`, contendo os parâmetros aplicados, e `serie`, contendo exatamente uma entrada para cada ano solicitado, em ordem crescente.

Cada entrada possui `ano`, `totais`, `base_risco`, `taxas` e `qualidade`. Os campos e as fórmulas são os mesmos do [resumo anual](../backend/README.md#cálculos-e-qualidade), calculados separadamente para cada ano:

- A base de risco é a soma dos vínculos menos a soma dos falecidos.
- Evasão do curso = (soma dos desvinculados + soma dos transferidos) / base.
- Evasão da IES = soma dos desvinculados / base.
- Taxas são proporções, por exemplo `0.15` para 15%; não são médias das taxas dos cursos ou dos anos.
- Base ausente ou não positiva gera taxa `null`. Valores negativos e decimais são preservados.
- Medidas parcialmente ausentes produzem totais `null`, com sinalização de dados incompletos.
- Sem registros no ano e recorte, todas as medidas, base e taxas são `null`; `sem_dados=true` e os contadores de registros são zero.
- Anos com somente docentes também têm medidas de alunos `null`, mas `registros_sem_alunos` informa a presença dessas linhas.
- A marca de grupo pequeno é calculada sobre a base de cada ano, nunca sobre a soma de toda a série.

A API não interpola lacunas. A visualização representa a ausência de informação com interrupções nas linhas, sem ligar pontos como se houvesse dados intermediários. Esta série descreve censos anuais; não acompanha a trajetória de uma coorte nem atribui causas às mudanças.

| HTTP  | Significado                                                                    |
| ----- | ------------------------------------------------------------------------------ |
| `200` | Série retornada, inclusive quando todo o período está sem dados                |
| `400` | Parâmetros ou intervalo inválidos; consulta rejeitada antes de acessar o banco |
| `503` | Gold indisponível, sem acesso ou sem as tabelas necessárias                    |
| `500` | Falha interna não classificada como indisponibilidade da Gold                  |

## Implementação e integração

`index.ts` é a entrada pública do módulo. `rotas.ts` valida o tamanho e a ordem do intervalo, coordena a consulta e monta a resposta. `schemas.ts` define o contrato HTTP. `consultas.ts` executa **uma consulta SQL**, com período parametrizado, filtros opcionais e agrupamento por ano. `evolucao.ts` completa os anos ausentes e monta a série.

O módulo consome a entrada pública de `indicadores` para reutilizar filtros, projeção SQL, schemas e cálculo. Isso mantém a equivalência com o resumo anual e evita fórmulas duplicadas. Não há importação de arquivos internos entre módulos.

A fonte continua sendo exclusivamente `gold.fato_evasao_curso` e suas seis dimensões. Não há novas migrações, permissões de banco, variáveis de ambiente ou dependências. A pipeline permanece separada; os grants existentes devem ser reaplicados após cada reconstrução da Gold.

## Testar com a demonstração

Execute `pnpm dev:demo` na raiz e abra [Swagger](http://127.0.0.1:3000/docs/). A rota está na seção **Análises**. Também pode consultar pelo PowerShell:

```powershell
Invoke-RestMethod 'http://127.0.0.1:3000/api/v1/analises/evolucao-temporal?ano_inicial=2022&ano_final=2024&codigo_curso=001' | ConvertTo-Json -Depth 8
```

Para o curso sintético `001`, os resultados esperados são:

| Ano  | Vínculos | Evasão do curso | Evasão da IES | Sem dados |
| ---- | -------- | --------------- | ------------- | --------- |
| 2022 | 1000     | 0.10            | 0.09          | false     |
| 2023 | 100      | 0.15            | 0.10          | false     |
| 2024 | null     | null            | null          | true      |

Sem filtro de curso, 2024 possui uma linha apenas com docentes. Com categoria `Pública Federal`, 2023 tem 1000 vínculos e taxas de `0.24` e `0.19`, calculadas sobre as somas de dois cursos de tamanhos distintos.

Os testes HTTP cobrem obrigatoriedade, limite de 30 anos, ordem, repetição e validade dos filtros. A integração compara cada ponto da série com o resumo do mesmo ano, testa lacunas, somente docentes, ruído, base zero, filtros combinados, EaD e reconstrução da Gold. A medição com fixtures não representa o volume real.
