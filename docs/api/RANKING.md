# API de ranking de áreas e modalidades

`GET /api/v1/analises/ranking` pertence ao módulo `analises`, é pública e usa a Gold existente. Atende ao RF12 do TCC, que pede todas as áreas e modalidades ranqueadas ao mesmo tempo. A [comparação](COMPARACOES.md) não cumpre esse papel: mostra uma dimensão por vez, ordena por código ou atributo e devolve até 20 grupos. O [ranking na interface](../frontend/RANKING.md) consulta as duas dimensões e mostra as tabelas juntas.

## Consulta

```http
GET /api/v1/analises/ranking?ano=2023&dimensao=area_geral
GET /api/v1/analises/ranking?ano=2023&dimensao=modalidade&taxa=evasao_ies&categoria_administrativa=Pública%20Federal
```

| Parâmetro          | Regra                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------- |
| `ano`              | Obrigatório, inteiro entre 1900 e 9999. Um ano por consulta.                             |
| `dimensao`         | Obrigatório: `area_geral` ou `modalidade`. Uma dimensão por consulta.                    |
| `taxa`             | Taxa usada na ordem: `evasao_curso` (padrão) ou `evasao_ies`.                            |
| Filtros de recorte | Os dez filtros opcionais do resumo, com as mesmas regras de validação e o mesmo sentido. |

Parâmetros desconhecidos, repetidos ou inválidos retornam `400` antes da consulta. As outras dimensões da comparação, como `curso` e `municipio`, também: o RF12 trata só de áreas e modalidades. Não há `limite` nem seleção de grupos: a rota devolve todas as categorias com registros no recorte. A CINE tem 11 áreas gerais, e as modalidades são poucas; a resposta é pequena.

## Resposta

```json
{
	"filtros": { "ano": 2023, "dimensao": "area_geral", "taxa": "evasao_curso" },
	"base_minima": 30,
	"classificados": 1,
	"grupos": [
		{
			"grupo": { "valor": "06", "nome": "Computação" },
			"totais": { "...": "mesmos nove totais do resumo" },
			"base_risco": 940,
			"taxas": { "evasao_curso": 0.2479, "evasao_ies": 0.1979 },
			"qualidade": { "...": "mesmos campos do resumo" },
			"situacao": "classificado",
			"posicao": 1,
			"empate": false
		},
		{
			"grupo": { "valor": "01", "nome": "Educação" },
			"situacao": "sem_taxa",
			"posicao": null,
			"empate": false,
			"...": "totais, base, taxas e qualidade"
		}
	]
}
```

Cada item reutiliza `calcularResumo`, então totais, base, taxas e qualidade são exatamente os do resumo filtrado por aquela categoria. `classificados` conta os itens com posição. `base_minima` é o limite da decisão D4, igual ao de `qualidade.flag_grupo_pequeno` e da zona crítica da [dispersão](DISPERSAO.md).

`situacao` diz por que um item tem ou não posição:

| Situação            | Condição                                                    | Posição |
| ------------------- | ----------------------------------------------------------- | ------- |
| `classificado`      | Código presente, taxa escolhida calculável e base ≥ 30      | Sim     |
| `base_pequena`      | Taxa calculável, mas base de risco abaixo de 30             | `null`  |
| `sem_taxa`          | Taxa escolhida `null` (medida ausente, base zero, docentes) | `null`  |
| `sem_identificador` | Registros sem código da área ou sem modalidade              | `null`  |

A situação é decidida nessa ordem, de baixo para cima: um grupo sem código é `sem_identificador` mesmo que tenha taxa.

`grupos` vem nesta ordem: classificados da maior para a menor taxa e, depois, `base_pequena`, `sem_taxa` e `sem_identificador`, cada bloco em ordem textual do código. Recorte sem registros retorna `200`, `classificados: 0` e `grupos: []`.

## Decisões

| ID  | Decisão                      | Adotada                                                                                      | Alternativas consideradas                                    |
| --- | ---------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| D1  | Taxa da ordem                | Escolhida na consulta, evasão do curso por padrão; as duas taxas vêm em todos os itens       | Só evasão do curso; média das duas taxas                     |
| D2  | Sentido                      | Decrescente: 1º é a maior taxa, a categoria que pede atenção primeiro                        | Crescente                                                    |
| D3  | Empate                       | Classificação por competição (1º, 2º, 2º, 4º); taxas iguais com 12 algarismos significativos | Posição densa (1º, 2º, 2º, 3º); desempate pela base de risco |
| D4  | Base pequena                 | Base de risco abaixo de 30 fica sem posição, no fim, com os valores visíveis                 | Classificar todos e só sinalizar; omitir a categoria         |
| D5  | Taxa ausente e sem código    | Sem posição, no fim, com o motivo                                                            | Tratar taxa ausente como zero; omitir                        |
| D6  | Cobertura das categorias     | Sem limite; a interface completa com as categorias do catálogo que não têm registros         | Limite de 20 como na comparação                              |
| D7  | Filtro da dimensão ranqueada | Aceito pela API; a interface o omite, para manter todas as categorias e destacar a escolhida | Rejeitar o filtro da própria dimensão                        |

**Por que competição (D3).** Quem lê "4º" sabe que há três categorias com taxa maior. Na posição densa, o mesmo grupo seria "3º", embora duas categorias empatadas estejam à frente. A tolerância de 12 algarismos existe porque taxas iguais podem vir de somas diferentes: 270/900 e 3/10 têm o mesmo valor, mas somar parcelas decimais em outra ordem pode mudar o último bit do `double`. Dentro de um empate, a ordem é a do código, sem significado.

**Por que tirar a base pequena da classificação (D4).** Com base 20, um único desvinculado muda a taxa em 5 pontos percentuais, e a categoria poderia ficar em 1º por acaso. Ela continua na resposta, com taxa e aviso, para cumprir a cobertura de todas as categorias. O limite é o mesmo de `flag_grupo_pequeno`, para o painel ter um critério só de base insuficiente.

**Por que não zerar a taxa ausente (D5).** Na fixture de 2023, a área 01 tem o curso `006` sem desvinculados. Tratar a taxa como zero colocaria Educação em último como se tivesse a menor evasão, uma conclusão que os dados não sustentam. O grupo sem código não é uma categoria: ranqueá-lo não responde qual área ou modalidade evade mais.

## Resultados esperados com a fixture

| Consulta (2023)                                        | Ordem em `grupos`                                                                        |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `dimensao=area_geral`                                  | 1º `06` (24,79%, base 940); `01` sem taxa (base 150,5); sem código (só docentes)         |
| `dimensao=modalidade`                                  | 1º A distância (25%, base 900); Não informado sem taxa; Presencial sem taxa (base 190,5) |
| `dimensao=area_geral`, Pública Federal                 | 1º `06` (25%, base 900); 2º `01` (15%, base 100)                                         |
| `dimensao=modalidade&taxa=evasao_ies`, Pública Federal | 1º A distância (20%); 2º Presencial (10%)                                                |
| `ano=1999`                                             | `grupos: []`                                                                             |

Sem filtro institucional, a área 01 inclui o curso `006`, sem desvinculados, e fica sem taxa, assim como o resumo filtrado por ela. Com `categoria_administrativa=Pública Federal`, o `006` sai do recorte, e a área 01 entra na classificação. Nenhuma categoria da fixture fica com base pequena: os cursos de base 20 se somam a outros da mesma área. Esse caso, o empate e a ordem dos blocos estão nos testes unitários.

## Implementação

- `ranking.ts` decide a situação, ordena, atribui as posições com empate e monta a resposta. Usa `BASE_MINIMA` de `dispersao.ts`.
- `consultas.ts` agrupa pela coluna da dimensão, reutilizando `origem`, `agregacaoSQL` e `parametrizarFiltros`, sem `LIMIT`. O nome da área é o menor rótulo pela collation `C`, como na comparação. A taxa não entra no SQL: a ordem depende das regras de `calcularResumo` e é feita em TypeScript.
- `schemas.ts` valida a consulta e documenta a resposta no Swagger; `rotas.ts` coordena consulta e montagem.

Ano e filtros usam parâmetros do `pg`; a coluna vem de uma lista fechada. A rota não adiciona tabelas, grants, dependências ou mudanças na pipeline. Erros: `400` para parâmetros inválidos, `429` para limite HTTP, `503` para Gold indisponível e `500` para falha interna.

## Testar na demonstração

Execute `pnpm dev:demo` e abra [Swagger](http://127.0.0.1:5173/docs/), seção **Análises**. Não é necessário login. Exemplo no PowerShell:

```powershell
Invoke-RestMethod 'http://127.0.0.1:3000/api/v1/analises/ranking?ano=2023&dimensao=area_geral' | ConvertTo-Json -Depth 8
```

## Validação automatizada

`test/ranking.test.ts` cobre a ordem por competição, o empate com taxas que diferem no último bit, a base pequena, a taxa ausente e o grupo sem código, a troca de taxa mudando a ordem, a resposta vazia, a parametrização do SQL, a rejeição de dimensões e taxas fora da lista antes do banco e o contrato no Swagger.

Na suíte PostgreSQL, a integração confere as ordens da tabela acima e, para cada categoria com código, a igualdade entre o item do ranking e o resumo filtrado por ela. A rota também entra nos testes de acesso público, inclusive com a autenticação habilitada.

O ranking usa as taxas atuais, cujos nomes e interpretação seguem em decisão com o orientador; indicadores por coorte ficam fora desta entrega.
