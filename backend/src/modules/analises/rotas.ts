import type { FastifyInstance } from 'fastify'
import { consultarGold } from '../../plugins/gold.js'
import { erroSchema } from '../../plugins/erros.js'
import type { ConsultasAnalises, FiltrosEvolucao } from './consultas.js'
import { MAX_ANOS, montarSerie } from './evolucao.js'
import {
	comparacaoQuerySchema,
	comparacaoSchema,
	evolucaoQuerySchema,
	evolucaoSchema
} from './schemas.js'
import { montarComparacao, type FiltrosComparacao } from './comparacoes.js'

export function registrarRotas(
	app: FastifyInstance,
	consultas: ConsultasAnalises
) {
	app.get<{ Querystring: FiltrosComparacao }>(
		'/api/v1/analises/comparacoes',
		{
			preValidation: async (request) => {
				// O parser entrega uma string quando grupos aparece uma única vez.
				const grupos: unknown = request.query.grupos
				if (typeof grupos === 'string') request.query.grupos = [grupos]
			},
			schema: {
				tags: ['Análises'],
				summary: 'Compara totais e taxas entre grupos de um mesmo ano.',
				description:
					'Exemplo: /api/v1/analises/comparacoes?ano=2023&agrupar_por=curso&grupos=001&grupos=002. Aplica os filtros antes de agrupar e calcula taxas sobre as somas de cada grupo. Não compara IES nominais nem produz rankings. Se truncado=true, refine os filtros ou selecione os grupos desejados. Grupo sem código/texto tem valor e nome null; nenhum registro resulta em grupos=[].',
				querystring: comparacaoQuerySchema,
				response: {
					200: comparacaoSchema,
					400: erroSchema,
					500: erroSchema,
					503: erroSchema
				}
			}
		},
		async (request) => {
			const agregados = await consultarGold(request, () =>
				consultas.comparacao(request.query)
			)
			return { filtros: request.query, ...montarComparacao(agregados) }
		}
	)
	app.get<{ Querystring: FiltrosEvolucao }>(
		'/api/v1/analises/evolucao-temporal',
		{
			schema: {
				tags: ['Análises'],
				summary: 'Consulta a evolução anual de um recorte.',
				description: `Exemplo: /api/v1/analises/evolucao-temporal?ano_inicial=2022&ano_final=2024&codigo_curso=001. Intervalo inclusivo de até ${MAX_ANOS} anos. Agrega medidas e calcula taxas separadamente por ano, preservando lacunas, ruído e qualidade. Não acompanha uma coorte de estudantes.`,
				querystring: evolucaoQuerySchema,
				response: {
					200: evolucaoSchema,
					400: erroSchema,
					500: erroSchema,
					503: erroSchema
				}
			}
		},
		async (request, reply) => {
			const filtros = request.query
			const quantidade = filtros.ano_final - filtros.ano_inicial + 1
			if (quantidade < 1 || quantidade > MAX_ANOS) {
				return reply.code(400).send({
					erro: 'PARAMETROS_INVALIDOS',
					mensagem: `Informe um intervalo crescente de 1 a ${MAX_ANOS} anos, contando os dois extremos.`
				})
			}
			const agregados = await consultarGold(request, () =>
				consultas.evolucao(filtros)
			)
			return { filtros, serie: montarSerie(filtros, agregados) }
		}
	)
}
