# API de perfil de quem evade

`GET /api/v1/analises/perfil` pertence ao módulo `analises`, é pública e lê `gold.fato_evasao_perfil` e `gold.dim_perfil`, que já estão na Gold. Responde aos "fatores associados" do objetivo do TCC: para um ano, um fator do perfil dos alunos e os filtros do painel, devolve as taxas de evasão de cada categoria do fator. O [perfil na interface](../frontend/PERFIL.md) mostra a tabela, o texto de associação e o CSV.

## Consulta

```http
GET /api/v1/analises/perfil?ano=2023&fator=apoio_social
GET /api/v1/analises/perfil?ano=2023&fator=sexo&codigo_area_geral=01&modalidade=Presencial
```

| Parâmetro          | Regra                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------- |
| `ano`              | Obrigatório, inteiro entre 1900 e 9999.                                                 |
| `fator`            | Obrigatório. Um dos 12 fatores de prioridade 1 da tabela abaixo; um fator por consulta. |
| Filtros de recorte | Os dez filtros opcionais do resumo, com as mesmas regras de validação.                  |

| `fator`                     | Nome em `dim_perfil.fator`                                                        |
| --------------------------- | --------------------------------------------------------------------------------- |
| `sexo`                      | Sexo                                                                              |
| `cor_raca`                  | Cor/raça                                                                          |
| `faixa_etaria`              | Faixa etária                                                                      |
| `deficiencia`               | Pessoa com deficiência, transtorno global do desenvolvimento ou altas habilidades |
| `naturalidade`              | Naturalidade                                                                      |
| `escola_ensino_medio`       | Escola do ensino médio                                                            |
| `cotas`                     | Entrou por reserva de vagas (cotas)                                               |
| `enem`                      | Entrou pelo Enem                                                                  |
| `vestibular`                | Entrou por vestibular                                                             |
| `apoio_social`              | Recebe apoio social                                                               |
| `atividade_extracurricular` | Participa de atividade extracurricular                                            |
| `turno`                     | Turno do aluno                                                                    |

A `dim_perfil` não guarda a prioridade do catálogo, que fica nos metadados da Bronze. Por isso a lista dos 12 fatores está no backend (`perfil.ts`), ligada pelo nome do fator, que junto do código da categoria identifica a linha da dimensão. Os 35 fatores de prioridade 2 ficam para uma próxima entrega. Parâmetros desconhecidos, repetidos ou inválidos, inclusive `taxa`, retornam `400` antes da consulta.

## Resposta

```json
{
	"filtros": { "ano": 2023, "fator": "apoio_social" },
	"fator": {
		"codigo": "apoio_social",
		"nome": "Recebe apoio social",
		"grupo": "Permanência"
	},
	"base_minima": 30,
	"conjunto": {
		"...": "totais, base, taxas e qualidade de todas as categorias somadas"
	},
	"categorias": [
		{
			"categoria": { "codigo": "1", "nome": "Sim", "ordem": 1 },
			"totais": { "vinculos_total": 112.5, "...": "sem ingressantes" },
			"base_risco": 112.5,
			"taxas": { "evasao_curso": 0.0044, "evasao_ies": 0.0044 },
			"qualidade": { "...": "campos do resumo sem os de ingressantes" }
		}
	]
}
```

- `categorias`: todas as categorias do fator em `dim_perfil`, na ordem do catálogo (`ordem_categoria`, depois o código). Inclui as sem registros no recorte, com `qualidade.sem_dados=true` e medidas `null`, e os códigos fora do catálogo que a pipeline acrescenta à dimensão ("Código X não previsto no catálogo", ordem 99). Não é ranking.
- Cada categoria segue as fórmulas do resumo, sobre as somas: base de risco = vínculos − falecidos; evasão do curso = (desvinculados + transferidos) ÷ base; evasão da instituição = desvinculados ÷ base. Matrículas são cursando mais concluintes.
- `totais` não tem `ingressantes_total`, e `qualidade` não tem `ingressantes_minimo` nem `registros_sem_ingressantes`: a fato de perfil só traz as medidas de situação.
- `conjunto`: todas as categorias somadas antes de dividir. Pode diferir do resumo, porque cada fator é uma consulta própria ao SEDAP+, com ruído próprio e grupos omitidos. É `null` quando o fator não está na `dim_perfil` da base conectada; nesse caso, `categorias` vem vazia.
- `base_minima`: abaixo dela, `qualidade.flag_grupo_pequeno` é `true`. É o mesmo limite do resumo, do ranking e da dispersão.

Ausência parcial segue a regra do resumo: se uma linha da categoria tem vínculos e não tem uma medida, o total dessa medida e as taxas que dependem dela ficam `null`, com `dados_incompletos=true`. Negativos do ruído são preservados e sinalizados em `flag_valor_negativo`.

## Decisões

| ID  | Decisão                              | Adotada                                                                                         | Alternativas consideradas                              |
| --- | ------------------------------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| D1  | Fatores da primeira versão           | Os 12 de prioridade 1, incluindo apoio social e atividade extracurricular, com ressalva na tela | Todos os 47; os 10 sem relação circular                |
| D2  | Taxa                                 | As duas taxas em todas as categorias; a tela alterna sem nova consulta                          | Parâmetro `taxa`                                       |
| D3  | Referência entre categorias          | Conjunto do fator, somado antes de dividir; o texto compara a maior e a menor taxa              | Razão de taxas contra uma categoria de referência fixa |
| D4  | Nível                                | Os filtros do painel: MT sem filtros, área, modalidade, tipo de instituição e os demais         | Só MT, área e modalidade                               |
| D5  | Categorias vazias e fora do catálogo | Aparecem, sem valores                                                                           | Omitir                                                 |

**Por que mostrar a maior e a menor taxa, e não a razão (D3).** A razão de taxas depende de escolher uma categoria de referência para cada fator ("sem apoio" ÷ "com apoio", "masculino" ÷ "feminino"), e essa escolha muda a leitura. Comparar as categorias com base suficiente não exige referência. A razão continua prevista na modelagem e pode entrar depois, com as referências definidas com o orientador.

**Por que permitir todos os filtros (D4).** A fato de perfil está no nível do curso, então área, modalidade e tipo de instituição saem por soma. Com recortes pequenos, como um curso, as categorias ficam pequenas e o SEDAP+ omite parte delas; a resposta sinaliza grupo pequeno em cada categoria, e a tela não compara categorias abaixo de 30.

## Resultados esperados com a fixture

| Consulta (2023)                           | Categorias (base, evasão do curso)                                                  |
| ----------------------------------------- | ----------------------------------------------------------------------------------- |
| `fator=apoio_social`                      | Sim (112,5; 0,44%), Não (907,5; 26,94%), Código 7 sem dados; conjunto 1.020, 24,02% |
| `fator=sexo`                              | Feminino (572; 21,33%), Masculino (478; sem taxa, desvinculados ausentes no `006`)  |
| `fator=sexo`, Pública Federal             | Feminino (560; 21,25%), Masculino (440; 27,50%)                                     |
| `fator=sexo`, Pública Municipal           | As duas categorias com grupo pequeno (só o curso `007`)                             |
| `fator=apoio_social&codigo_area_geral=01` | Sim (10; 0%), Não (90; 16,67%), Código 7 sem dados                                  |
| `fator=turno`                             | `categorias: []`, `conjunto: null` (fator fora da fixture)                          |

A categoria Sim do apoio social tem desvinculados negativos no curso `007` e vem com `flag_valor_negativo`. O código 7 só tem registro em 2022, por isso aparece em 2023 sem dados.

## Implementação

- `perfil.ts` lista os 12 fatores e monta a resposta com `calcularResumo`, sem os campos de ingressantes.
- `consultas.ts` parte de `dim_perfil` filtrada pelo fator (parâmetro do `pg`) e faz `LEFT JOIN` com a fato filtrada pelo recorte, para trazer também as categorias vazias. `GROUPING SETS` devolve as categorias e o conjunto na mesma consulta. As junções com as dimensões do curso são as de `plugins/gold.ts`, compartilhadas com o resumo.
- `schemas.ts` deriva o schema de cada categoria do schema do resumo, sem ingressantes; `rotas.ts` coordena consulta e montagem.

`backend/sql/permissoes.sql` passa a conceder `SELECT` em `gold.fato_evasao_perfil` e `gold.dim_perfil`. Reaplique o script na base conectada antes de usar a rota; sem o grant, ela responde `503`, como as outras quando a Gold está inacessível. Erros: `400` para parâmetros inválidos, `429` para limite HTTP, `503` para Gold indisponível e `500` para falha interna.

## Validação automatizada

`test/perfil.test.ts` cobre a montagem por categoria e do conjunto, a ausência dos campos de ingressantes, base pequena, medida ausente, fator fora da dimensão, a parametrização do SQL, a rejeição de fatores fora da lista antes do banco e o contrato no Swagger. Na suíte PostgreSQL, a integração confere os valores da tabela acima e a reconstrução da Gold com reaplicação dos grants. A rota também entra nos testes de acesso público, inclusive com a autenticação habilitada.

Não foi validada com a Gold real: a conferência de 2023 na bronze (apoio social, 0,8% contra 15,3%) foi feita fora da aplicação.
