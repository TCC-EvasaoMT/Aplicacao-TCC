import {
	anoSchema,
	filtrosRecorteProperties,
	resultadoResumoProperties
} from '../indicadores/index.js'
import { MAX_ANOS } from './evolucao.js'
import { agrupamentos, MAX_GRUPOS } from './comparacoes.js'

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
