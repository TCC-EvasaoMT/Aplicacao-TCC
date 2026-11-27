import type { FastifyInstance } from 'fastify'
import { consultarGold } from '../../plugins/gold.js'
import { erroSchema } from '../../plugins/erros.js'
import { calcularResumo } from './calculos.js'
import type { ConsultasIndicadores, Filtros } from './consultas.js'
import { filtrosQuerySchema, resumoSchema } from './schemas.js'

export function registrarRotas(
	app: FastifyInstance,
	consultas: ConsultasIndicadores
) {
	const erros = { 400: erroSchema, 500: erroSchema, 503: erroSchema }
	app.get<{ Querystring: Filtros }>(
		'/api/v1/indicadores/resumo',
		{
			config: { acesso: 'painel' },
			schema: {
				tags: ['Indicadores'],
				summary: 'Calcula o resumo de um ano com filtros combinados por E.',
				description:
					'Exemplo: /api/v1/indicadores/resumo?ano=2023&codigo_area_geral=01. Calcula as taxas sobre as somas; base não positiva ou ausente retorna null. Valores negativos e decimais são preservados. Um recorte sem alunos retorna 200, totais null e qualidade.sem_dados=true.',
				querystring: filtrosQuerySchema,
				response: { 200: resumoSchema, ...erros }
			}
		},
		async (request) => {
			const agregado = await consultarGold(request, () =>
				consultas.resumo(request.query)
			)
			return { filtros: request.query, ...calcularResumo(agregado) }
		}
	)
}
