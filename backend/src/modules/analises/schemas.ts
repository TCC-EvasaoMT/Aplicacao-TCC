import {
	anoSchema,
	filtrosRecorteProperties,
	resultadoResumoProperties
} from '../indicadores/index.js'
import { MAX_ANOS } from './evolucao.js'
import { agrupamentos, MAX_GRUPOS } from './comparacoes.js'
import { BASE_MINIMA, taxasDispersao } from './dispersao.js'
import { dimensoesRanking, situacoes, taxasRanking } from './ranking.js'

export const comparacaoQuerySchema = {
	type: 'object',
	additionalProperties: false,
	required: ['ano', 'agrupar_por'],
	properties: {
		ano: anoSchema,
		agrupar_por: {
			type: 'string',
			enum: Object.keys(agrupamentos),
			examples: ['categoria_administrativa']
		},
		limite: {
			type: 'integer',
			minimum: 1,
			maximum: MAX_GRUPOS,
			default: MAX_GRUPOS,
			description:
				'Máximo de grupos retornados. Ordenação por código/texto, nunca pela taxa.'
		},
		grupos: {
			type: 'array',
			minItems: 1,
			maxItems: MAX_GRUPOS,
			uniqueItems: true,
			items: { type: 'string', minLength: 1, maxLength: 200, pattern: '\\S' },
			description:
				'Seleção opcional de códigos ou textos da dimensão. Repita o parâmetro: grupos=001&grupos=002. Um único valor também é aceito. Sem seleção, inclui grupos sem identificador.'
		},
		...filtrosRecorteProperties
	},
	allOf: Object.entries(agrupamentos).map(([chave, { filtro }]) => ({
		if: { type: 'object', properties: { agrupar_por: { const: chave } } },
		then: {
			type: 'object',
			properties: {
				grupos: { type: 'array', items: filtrosRecorteProperties[filtro] }
			}
		}
	}))
}

export const comparacaoSchema = {
	type: 'object',
	additionalProperties: false,
	required: ['filtros', 'total_grupos', 'truncado', 'grupos'],
	properties: {
		filtros: {
			type: 'object',
			additionalProperties: false,
			required: ['ano', 'agrupar_por', 'limite'],
			properties: comparacaoQuerySchema.properties
		},
		total_grupos: {
			type: 'integer',
			minimum: 0,
			description:
				'Quantidade de grupos encontrados após filtros e seleção, antes do limite.'
		},
		truncado: {
			type: 'boolean',
			description:
				'Há outros grupos no recorte que não foram retornados por causa do limite.'
		},
		grupos: {
			type: 'array',
			maxItems: MAX_GRUPOS,
			items: {
				type: 'object',
				additionalProperties: false,
				required: ['grupo', 'totais', 'base_risco', 'taxas', 'qualidade'],
				properties: {
					grupo: {
						type: 'object',
						additionalProperties: false,
						required: ['valor', 'nome'],
						properties: {
							valor: {
								type: 'string',
								nullable: true,
								description:
									'Código original ou atributo textual; null quando ausente. Nunca é um ID sequencial.'
							},
							nome: {
								type: 'string',
								nullable: true,
								description: 'Rótulo disponível na dimensão, ou null.'
							}
						}
					},
					...resultadoResumoProperties
				}
			}
		}
	}
}

export const evolucaoQuerySchema = {
	type: 'object',
	additionalProperties: false,
	required: ['ano_inicial', 'ano_final'],
	properties: {
		ano_inicial: {
			...anoSchema,
			description: 'Primeiro ano do intervalo inclusivo.',
			examples: [2022]
		},
		ano_final: {
			...anoSchema,
			description: `Último ano; deve ser maior ou igual ao inicial. Máximo de ${MAX_ANOS} anos inclusivos.`,
			examples: [2024]
		},
		...filtrosRecorteProperties
	}
}

export const evolucaoSchema = {
	type: 'object',
	additionalProperties: false,
	required: ['filtros', 'serie'],
	properties: {
		filtros: evolucaoQuerySchema,
		serie: {
			type: 'array',
			minItems: 1,
			maxItems: MAX_ANOS,
			description:
				'Uma entrada por ano solicitado, em ordem crescente. Anos sem registros têm medidas null e qualidade.sem_dados=true.',
			items: {
				type: 'object',
				additionalProperties: false,
				required: ['ano', 'totais', 'base_risco', 'taxas', 'qualidade'],
				properties: { ano: anoSchema, ...resultadoResumoProperties }
			}
		}
	}
}

export const dispersaoQuerySchema = {
	type: 'object',
	additionalProperties: false,
	required: ['ano'],
	properties: { ano: anoSchema, ...filtrosRecorteProperties }
}

const porTaxa = (schema: object, descricao: string) => ({
	type: 'object',
	additionalProperties: false,
	required: [...taxasDispersao],
	description: descricao,
	properties: Object.fromEntries(taxasDispersao.map((t) => [t, schema]))
})
const contagem = { type: 'integer', minimum: 0 }

export const dispersaoSchema = {
	type: 'object',
	additionalProperties: false,
	required: ['filtros', 'referencias', 'cursos'],
	properties: {
		filtros: dispersaoQuerySchema,
		referencias: {
			type: 'object',
			additionalProperties: false,
			required: [
				'base_minima',
				'alta_evasao',
				'cursos_na_referencia',
				'cursos_fora_da_referencia'
			],
			properties: {
				base_minima: {
					type: 'integer',
					const: BASE_MINIMA,
					description:
						'Base de risco mínima para a zona crítica; mesmo limite de flag_grupo_pequeno.'
				},
				alta_evasao: porTaxa(
					{ type: 'number', nullable: true },
					'Linha de alta evasão de cada taxa: soma dos numeradores dividida pela soma das bases dos cursos com a taxa calculável. null quando nenhum curso tem a taxa.'
				),
				cursos_na_referencia: porTaxa(
					contagem,
					'Cursos usados no cálculo de cada linha.'
				),
				cursos_fora_da_referencia: porTaxa(
					contagem,
					'Cursos sem a taxa calculável (base não positiva, medida ausente ou só docentes).'
				)
			}
		},
		cursos: {
			type: 'array',
			description:
				'Um item por código de curso, em ordem textual do código. Não é ranking.',
			items: {
				type: 'object',
				additionalProperties: false,
				required: [
					'curso',
					'totais',
					'base_risco',
					'taxas',
					'qualidade',
					'zona_critica'
				],
				properties: {
					curso: {
						type: 'object',
						additionalProperties: false,
						required: ['codigo', 'nome'],
						properties: {
							codigo: {
								type: 'string',
								nullable: true,
								description: 'Código original do curso; null quando ausente.'
							},
							nome: { type: 'string', nullable: true }
						}
					},
					...resultadoResumoProperties,
					zona_critica: porTaxa(
						{ type: 'boolean' },
						`Taxa do curso maior que a linha de alta evasão e base de risco de pelo menos ${BASE_MINIMA}.`
					)
				}
			}
		}
	}
}

export const rankingQuerySchema = {
	type: 'object',
	additionalProperties: false,
	required: ['ano', 'dimensao'],
	properties: {
		ano: anoSchema,
		dimensao: {
			type: 'string',
			enum: [...dimensoesRanking],
			description: 'Área geral CINE ou modalidade.'
		},
		taxa: {
			type: 'string',
			enum: [...taxasRanking],
			default: 'evasao_curso',
			description: 'Taxa usada na ordenação, da maior para a menor.'
		},
		...filtrosRecorteProperties
	}
}

export const rankingSchema = {
	type: 'object',
	additionalProperties: false,
	required: ['filtros', 'base_minima', 'classificados', 'grupos'],
	properties: {
		filtros: {
			type: 'object',
			additionalProperties: false,
			required: ['ano', 'dimensao', 'taxa'],
			properties: rankingQuerySchema.properties
		},
		base_minima: {
			type: 'integer',
			const: BASE_MINIMA,
			description:
				'Base de risco mínima para receber posição; mesmo limite de flag_grupo_pequeno.'
		},
		classificados: {
			type: 'integer',
			minimum: 0,
			description: 'Quantidade de grupos com posição.'
		},
		grupos: {
			type: 'array',
			description:
				'Todas as categorias do recorte: primeiro as classificadas, da maior para a menor taxa; depois base pequena, sem taxa e sem identificador, cada uma em ordem de código.',
			items: {
				type: 'object',
				additionalProperties: false,
				required: [
					'grupo',
					'totais',
					'base_risco',
					'taxas',
					'qualidade',
					'situacao',
					'posicao',
					'empate'
				],
				properties: {
					grupo: {
						type: 'object',
						additionalProperties: false,
						required: ['valor', 'nome'],
						properties: {
							valor: { type: 'string', nullable: true },
							nome: { type: 'string', nullable: true }
						}
					},
					...resultadoResumoProperties,
					situacao: {
						type: 'string',
						enum: [...situacoes],
						description:
							'classificado; base_pequena (base de risco abaixo do mínimo); sem_taxa (base não positiva, medida ausente ou só docentes); sem_identificador.'
					},
					posicao: {
						type: 'integer',
						minimum: 1,
						nullable: true,
						description:
							'Classificação por competição (1, 2, 2, 4); null fora da classificação.'
					},
					empate: {
						type: 'boolean',
						description: 'Divide a posição com outro grupo de mesma taxa.'
					}
				}
			}
		}
	}
}
