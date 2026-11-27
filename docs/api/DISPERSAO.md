# API de dispersão por curso

`GET /api/v1/analises/dispersao` pertence ao módulo `analises`, é pública e usa a Gold existente. Atende ao RF10 do TCC: “para um ano do Censo selecionado, uma visualização de dispersão relacionando a taxa de evasão [...] e o total de matrículas de cada curso, com linhas de referência distinguindo cursos de alta evasão sobre base significativa”. O protótipo da figura 14 chama de **zona crítica** a região em que as duas condições se cumprem. A [dispersão na interface](../frontend/DISPERSAO.md) apresenta o gráfico, a tabela e o CSV.

## Consulta

```http
GET /api/v1/analises/dispersao?ano=2023
GET /api/v1/analises/dispersao?ano=2023&codigo_area_geral=01&modalidade=Presencial
```

| Parâmetro          | Regra                                                                                                                                                       |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ano`              | Obrigatório, inteiro entre 1900 e 9999. Um ano por consulta.                                                                                                |
| Filtros de recorte | Os dez filtros opcionais do resumo, com as mesmas regras de validação. O RF10 exige área e modalidade; os demais vêm de graça pela agregação compartilhada. |

Parâmetros desconhecidos, repetidos ou inválidos retornam `400` antes da consulta. Não há `limite`, seleção de grupos nem paginação: a rota devolve todos os cursos do recorte. A Gold real tem cerca de 290 cursos por ano, o que mantém a resposta pequena; o limite de 20 grupos da comparação não se aplica.

## Resposta

```json
{
	"filtros": { "ano": 2023, "categoria_administrativa": "Pública Federal" },
	"referencias": {
		"base_minima": 30,
		"alta_evasao": { "evasao_curso": 0.24, "evasao_ies": 0.19 },
		"cursos_na_referencia": { "evasao_curso": 2, "evasao_ies": 2 },
		"cursos_fora_da_referencia": { "evasao_curso": 0, "evasao_ies": 0 }
	},
	"cursos": [
		{
			"curso": { "codigo": "001", "nome": "Pedagogia" },
			"totais": {
				"matriculas_total": 70,
				"...": "mesmos nove totais do resumo"
			},
			"base_risco": 100,
			"taxas": { "evasao_curso": 0.15, "evasao_ies": 0.1 },
			"qualidade": { "...": "mesmos campos do resumo" },
			"zona_critica": { "evasao_curso": false, "evasao_ies": false }
		}
	]
}
```

- `cursos`: um item por código de curso, em ordem textual crescente do código (collation `C`), como na comparação. Não é ranking. Cada item reutiliza `calcularResumo`: totais, base, taxas e qualidade seguem exatamente as regras do resumo, inclusive matrículas como cursando mais concluintes e ingressantes mínimos.
- `referencias.alta_evasao`: a linha horizontal de cada taxa (decisões D2 e D5).
- `referencias.cursos_na_referencia` e `cursos_fora_da_referencia`: quantos cursos entraram no cálculo de cada linha. São por taxa porque um curso pode ter só uma das taxas, por exemplo com desvinculados informados e transferidos ausentes.
- `referencias.base_minima`: base de risco mínima para um curso entrar na zona crítica (D3). É o mesmo limite de `qualidade.flag_grupo_pequeno`.
- `zona_critica`: por taxa, `true` quando a taxa do curso é **maior** que a referência e a base de risco é de pelo menos 30. `false` quando alguma condição falha ou algum valor é `null`.

Cursos com taxa ou matrículas `null` continuam na lista, para a tabela, mas não têm ponto no gráfico. Isso inclui base não positiva, medidas incompletas e linhas só com docentes. Taxas negativas por ruído são preservadas e plotadas. Recorte sem cursos retorna `200`, `cursos: []` e referências `null`.

## Decisões

| ID  | Decisão                                    | Adotada                                                                        | Alternativas consideradas                                         |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| D1  | Taxa no eixo vertical                      | As duas taxas na resposta; a tela alterna entre elas                           | Só evasão do curso; só evasão da IES                              |
| D2  | Linha de alta evasão                       | Taxa agregada do recorte, somando antes de dividir                             | Percentil 75 dos cursos; limiar fixo escolhido na tela            |
| D3  | Base significativa                         | Base de risco de pelo menos 30, o critério de `flag_grupo_pequeno`             | Matrículas acima da mediana do recorte; limiar fixo de matrículas |
| D4  | Eixo horizontal                            | Matrículas (cursando + concluintes), como no RF10                              | Base de risco, o denominador da taxa                              |
| D5  | Cursos que entram no cálculo da referência | Só cursos com a taxa calculável; `cursos_fora_da_referencia` informa os demais | Todos os cursos, como no resumo                                   |

**Por que D2 e não o percentil.** A taxa do recorte segue a regra do painel de nunca fazer média de taxas: cursos grandes pesam pela sua base. Com o percentil, um curso de 20 vínculos pesaria igual a um de 900, e o ruído do SEDAP+ moveria a linha.

**Por que D5.** No resumo, uma medida ausente em qualquer curso deixa a taxa do recorte `null`, por segurança. Na fixture de 2023, o curso `006` não tem desvinculados, e o resumo sem filtros mostra “Não disponível”. Usar essa taxa como referência apagaria a linha e a zona crítica do gráfico inteiro por causa de um curso. Calculando a referência sobre os cursos que têm a taxa, a linha existe, e a resposta informa quantos cursos ficaram de fora. Consequência: com dados completos, a referência é igual à taxa do resumo; com cursos incompletos, as duas podem diferir, e a interface deve dizer isso.

**Por que D3 não é uma linha vertical.** A significância depende da base de risco, enquanto o eixo horizontal mostra matrículas, que são outra medida. Uma linha vertical em matrículas não representaria o critério. A interface marca os cursos abaixo da base mínima, por exemplo com ponto vazado, e eles nunca entram na zona crítica. O RF10 fala em “linhas de referência”; essa diferença deve ser registrada na [matriz do TCC](../tcc/RASTREABILIDADE.md).

## Resultados esperados com a fixture

| Curso em 2023 | Matrículas | Base | Evasão do curso | Evasão da IES | Observação                        |
| ------------- | ---------- | ---- | --------------- | ------------- | --------------------------------- |
| `001`         | 70         | 100  | 0,15            | 0,10          |                                   |
| `002`         | 600        | 900  | 0,25            | 0,20          | Zona crítica nas duas taxas       |
| `003`         | —          | —    | —               | —             | Só docentes; sem ponto            |
| `004`         | 0          | 0    | —               | —             | Base zero; sem ponto              |
| `005`         | 14,75      | 20,5 | 0,037           | −0,122        | Base pequena; ruído negativo      |
| `006`         | 20         | 30   | —               | —             | Desvinculados ausentes; sem ponto |
| `007`         | 12         | 20   | 0,25            | 0,20          | Alta evasão, mas base pequena     |
| `008`         | 14         | 20   | 0,15            | 0,10          | Base pequena                      |

Sem filtros, a referência soma os cursos `001`, `002`, `005`, `007` e `008`: base 1.060,5, evasão do curso 248,75 / 1.060,5 ≈ 0,235 e evasão da IES 193,5 / 1.060,5 ≈ 0,182, com 3 cursos fora da referência em cada taxa. Só o `002` fica na zona crítica. O `007` tem a mesma taxa, mas base 20. Com `categoria_administrativa=Pública Federal`, a referência de evasão do curso é 240 / 1.000 = 0,24, a mesma do resumo, e o `002` continua na zona crítica.

## Implementação

- `dispersao.ts` calcula as linhas de referência a partir dos totais (soma dos numeradores dividida pela soma das bases) e classifica a zona crítica. `BASE_MINIMA` fica junto dessa regra.
- `consultas.ts` agrupa por `c.codigo_curso` reutilizando `origem`, `agregacaoSQL` e `parametrizarFiltros`, sem `LIMIT`. O nome do curso é o menor rótulo pela collation `C`, como na comparação.
- `schemas.ts` valida a consulta e documenta a resposta no Swagger; `rotas.ts` coordena consulta e montagem.

Ano e filtros usam parâmetros do `pg`. A rota não adiciona tabelas, grants, dependências ou mudanças na pipeline. Erros: `400` para parâmetros inválidos, `429` para limite HTTP, `503` para Gold indisponível e `500` para falha interna.

## Testar na demonstração

Execute `pnpm dev:demo` e abra [Swagger](http://127.0.0.1:5173/docs/), seção **Análises**. Não é necessário login. Exemplo no PowerShell:

```powershell
Invoke-RestMethod 'http://127.0.0.1:3000/api/v1/analises/dispersao?ano=2023' | ConvertTo-Json -Depth 8
```

Os valores devem coincidir com a tabela de resultados esperados acima.

## Validação automatizada

`test/dispersao.test.ts` cobre a referência sobre somas, a exclusão de cursos sem taxa, as contagens por taxa, o limite da base (30 entra, 29 não), a taxa igual à referência fora da zona, o ruído negativo, a parametrização do SQL, a rejeição de parâmetros inválidos antes do banco e o contrato no Swagger.

Na suíte PostgreSQL, a integração confere os valores da fixture, a zona crítica com e sem filtro institucional, os filtros de área e modalidade e, para cada curso, a igualdade entre o item da dispersão e o resumo filtrado por `codigo_curso`. A rota também entra nos testes de acesso público, inclusive com a autenticação habilitada.

Fora desta entrega: rankings simultâneos (RF12), indicadores por coorte e mudança do nome das taxas, que segue em decisão com o orientador.
