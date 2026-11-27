# API de turma de ingresso

`GET /api/v1/analises/coorte` pertence ao módulo `analises`, é pública e lê `gold.fato_evasao_coorte`. Acompanha uma turma de ingresso ao longo dos censos: para quem ingressou no ano A, mostra em cada ano N quanto da turma já evadiu, já concluiu e continua no curso, como proporção do tamanho inicial. Segue a lógica dos Indicadores de Fluxo do INEP: a mesma turma, e não censos diferentes como na [evolução temporal](ANALISES_TEMPORAIS.md). A [turma na interface](../frontend/COORTE.md) mostra o gráfico, a tabela e o CSV.

## Consulta

```http
GET /api/v1/analises/coorte?ano_ingresso=2019
GET /api/v1/analises/coorte?ano_ingresso=2019&codigo_area_geral=01&modalidade=Presencial
```

| Parâmetro          | Regra                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------ |
| `ano_ingresso`     | Obrigatório, inteiro entre 1900 e 9999.                                                    |
| Filtros de recorte | Os dez filtros opcionais do resumo, aplicados aos atributos do curso em cada ano do censo. |

O ano do censo não é parâmetro: a série cobre todos os anos carregados a partir do ingresso. Parâmetros desconhecidos, repetidos ou inválidos, inclusive `ano`, retornam `400` antes da consulta.

## Cálculo

- **Turma:** os cursos que têm linha da turma no censo do próprio ano de ingresso. Linhas com o mesmo ano de ingresso em outros cursos (vínculos que aparecem depois, por exemplo por mudança de curso) ficam fora das somas e são contadas em `registros_fora_da_turma` e `vinculos_fora_da_turma`.
- **Tamanho inicial:** vínculos da turma no censo do ano de ingresso. Não usa `ingressantes_total`, que tem ruído alto.
- **Em cada ano N, sobre o tamanho inicial:**
  - já evadiu = desvinculados + transferidos somados do ingresso até N;
  - já saiu da instituição = desvinculados somados do ingresso até N;
  - já concluiu = concluintes somados do ingresso até N;
  - continua = cursando + trancados no ano N;
  - resíduo = 1 − (já evadiu + já concluiu + continua): falecidos, ruído, cursos da turma omitidos no ano e vínculos que mudam de curso.
- **Ano sem dados:** se a turma não tem linhas num ano, ou uma medida está ausente, os acumulados ficam `null` daquele ano em diante, porque não se sabe quanto faltou. "Continua" depende só do próprio ano.

Só turmas cujo ano de ingresso foi carregado como ano do censo têm tamanho inicial. Na Gold atual, as de 2019 a 2023: a de 2019 tem cinco anos de acompanhamento; a de 2023, um. Sem tamanho inicial, a resposta vem com `tamanho_inicial: null` e `serie: []`.

## Resposta

```json
{
	"filtros": { "ano_ingresso": 2022 },
	"tamanho_inicial": 100,
	"base_minima": 30,
	"cursos_iniciais": 1,
	"serie": [
		{
			"ano": 2023,
			"anos_desde_ingresso": 1,
			"totais": { "vinculos_total": 88, "...": "medidas de situação do ano" },
			"acumulados": { "evadidos": 15, "desvinculados": 14, "concluintes": 8 },
			"continua": 73,
			"taxas": {
				"evadiu": 0.15,
				"evadiu_ies": 0.14,
				"concluiu": 0.08,
				"continua": 0.73,
				"residuo": 0.04
			},
			"qualidade": {
				"sem_dados": false,
				"registros": 1,
				"cursos_iniciais_ausentes": 0,
				"registros_fora_da_turma": 1,
				"vinculos_fora_da_turma": 15,
				"dados_incompletos": false,
				"flag_valor_negativo": true,
				"flag_grupo_pequeno": false
			}
		}
	]
}
```

`flag_grupo_pequeno` marca turma com tamanho inicial abaixo de 30, o mesmo limite das outras análises. `cursos_iniciais_ausentes` conta cursos da turma sem linha no ano, em geral omitidos pelo SEDAP+.

## Decisões

| ID  | Decisão                        | Adotada                                                            | Alternativas consideradas                |
| --- | ------------------------------ | ------------------------------------------------------------------ | ---------------------------------------- |
| D1  | Quem forma a turma             | Só cursos com linha no ano de ingresso; os demais contados à parte | Todos os registros com o ano de ingresso |
| D2  | Tamanho inicial                | Vínculos da turma no censo do ingresso                             | `ingressantes_total`, com ruído alto     |
| D3  | Ano faltante ou medida ausente | Acumulados `null` dali em diante                                   | Tratar o ano como zero; pular o ano      |
| D4  | Saída                          | As duas leituras: do curso (com transferidos) e da instituição     | Só desvinculados + transferidos          |

**Por que só cursos com linha inicial (D1).** Com todos os registros, as saídas de quem entrou depois somariam no numerador sem estar no denominador. Na turma de 2019 da bronze, a diferença é pequena: 3 registros e 134 vínculos fora da turma em 2023, e o já evadiu fica em 27,9% nos dois critérios. A resposta mostra os registros de fora para que a escolha seja visível.

## Salto de 2022 para 2023

Na bronze local, a turma de 2019 em MT tem 13.117 vínculos iniciais, e o já evadiu passa de 17,6% em 2022 para 27,9% em 2023 (resíduo de 2,2% em 2023). A decomposição mostrou:

- O salto está concentrado na categoria **Pública Estadual**, filtro que o próprio painel oferece: as saídas da turma de 2019 nessa categoria passam de 115 em 2022 para 1.279 em 2023, enquanto nas federais vão de 88 para 79.
- Não é próprio da turma de 2019. Em 2023, essa categoria registra de 31% a 44% de saídas nas turmas de 2019, 2020, 2021 e anteriores; só as turmas de 2022 e 2023 não se alteram. A evasão anual da categoria vai de 10,7% em 2019 a 5,7%, 1,9% e 4,4% e chega a 21,5% em 2023.
- Não é troca de código de curso: só 3 linhas da turma de 2019 estão, em 2023, em cursos que não existiam em 2019. Também não é a passagem de vínculos para outra instituição federal.

A leitura mais provável é um desligamento em lote, em 2023, de vínculos que deixaram de frequentar entre 2020 e 2022, anos com pouquíssimas saídas registradas nessa categoria. Se for isso, a saída ocorreu antes e foi registrada depois: o acumulado até 2023 está correto, mas a distribuição entre os anos não. A interface avisa que um salto de um ano pode refletir saídas registradas de uma vez. A confirmação depende do responsável pela pipeline ou da própria instituição, pelo registro administrativo; a análise não nomeia a instituição, conforme a decisão da modelagem sobre a identificação das IES.

## Resultados esperados com a fixture

| Consulta                                 | Resultado                                                                                                                                                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ano_ingresso=2022`                      | Tamanho 100 (só o `001`). 2022: evadiu 8%, continua 92%. 2023: evadiu 15%, concluiu 8%, continua 73%, resíduo 4%, 1 registro (15 vínculos) fora da turma, negativo. 2024: sem dados, acumulados `null`. |
| `ano_ingresso=2023`                      | Tamanho 126,25 em 7 cursos; evadiu 10 ÷ 126,25 em 2023                                                                                                                                                  |
| `ano_ingresso=2022&codigo_area_geral=06` | Sem tamanho inicial: o `002` não tem linha de 2022                                                                                                                                                      |
| `ano_ingresso=2019`                      | Sem tamanho inicial (ano não carregado)                                                                                                                                                                 |

## Implementação

- `coorte.ts` calcula tamanho inicial, acumulados, continua, resíduo e proporções.
- `consultas.ts` filtra a turma pelo ano de ingresso (`$1`) e pelos filtros do recorte, marca os cursos com linha inicial e cruza com os anos do censo carregados (`fato_evasao_curso`), para que um ano sem linhas da turma apareça. As junções vêm de `plugins/gold.ts` (`origemCoorte`).
- `schemas.ts` valida a consulta e documenta a resposta no Swagger; `rotas.ts` coordena consulta e montagem.

A rota usa a `fato_evasao_coorte`, já coberta por `backend/sql/permissoes.sql`. Erros: `400` para parâmetros inválidos, `429` para limite HTTP, `503` para Gold indisponível e `500` para falha interna.

## Validação automatizada

`test/coorte.test.ts` cobre acumulados e resíduo, o ano faltante interrompendo os acumulados, turma sem linha inicial, tamanho não positivo, turma pequena, medida ausente, a parametrização do SQL, a rejeição de parâmetros antes do banco e o contrato no Swagger. Na suíte PostgreSQL, a integração confere a tabela acima. A rota também entra nos testes de acesso público, inclusive com a autenticação habilitada.

Não foi validada com a Gold real: os números da turma de 2019 e a decomposição do salto vêm da bronze local, calculados fora da aplicação.
