import {
	anoSchema,
	filtrosRecorteProperties,
	resultadoResumoProperties
} from '../indicadores/index.js'
import { MAX_ANOS } from './evolucao.js'

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
