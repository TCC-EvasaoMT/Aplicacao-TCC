import type { FastifyInstance } from 'fastify'
import { consultarGold } from '../../plugins/gold.js'
import { erroSchema } from '../../plugins/erros.js'
import type { ConsultasAnalises, FiltrosEvolucao } from './consultas.js'
import { MAX_ANOS, montarSerie } from './evolucao.js'
import {
	comparacaoQuerySchema,
	comparacaoSchema,
	dispersaoQuerySchema,
	dispersaoSchema,
	coorteQuerySchema,
	coorteSchema,
	perfilQuerySchema,
	perfilSchema,
	rankingQuerySchema,
	rankingSchema,
	evolucaoQuerySchema,
	evolucaoSchema
} from './schemas.js'
import { montarComparacao, type FiltrosComparacao } from './comparacoes.js'
import { montarDispersao, type FiltrosDispersao } from './dispersao.js'
import { montarCoorte, type FiltrosCoorte } from './coorte.js'
import { montarPerfil, type FiltrosPerfil } from './perfil.js'
import { montarRanking, type FiltrosRanking } from './ranking.js'

export function registrarRotas(
	app: FastifyInstance,
	consultas: ConsultasAnalises
) {
	app.get<{ Querystring: FiltrosComparacao }>(
		'/api/v1/analises/comparacoes',
		{
			config: { acesso: 'painel' },
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
	app.get<{ Querystring: FiltrosCoorte }>(
		'/api/v1/analises/coorte',
		{
			config: { acesso: 'painel' },
			schema: {
				tags: ['Análises'],
				summary:
					'Acompanha uma turma de ingresso: já evadiu, já concluiu e continua no curso.',
				description:
					'Exemplo: /api/v1/analises/coorte?ano_ingresso=2019&codigo_area_geral=01. Tamanho inicial = vínculos da turma no censo do ano de ingresso; a turma são os cursos com essa linha. Para cada ano do censo, acumula desvinculados + transferidos e concluintes e mostra cursando + trancados e o resíduo.',
				querystring: coorteQuerySchema,
				response: {
					200: coorteSchema,
					400: erroSchema,
					500: erroSchema,
					503: erroSchema
				}
			}
		},
		async (request) => {
			const anos = await consultarGold(request, () =>
				consultas.coorte(request.query)
			)
			return {
				filtros: request.query,
				...montarCoorte(anos, request.query.ano_ingresso)
			}
		}
	)
	app.get<{ Querystring: FiltrosPerfil }>(
		'/api/v1/analises/perfil',
		{
			config: { acesso: 'painel' },
			schema: {
				tags: ['Análises'],
				summary: 'Taxas de evasão por categoria de um fator de perfil.',
				description:
					'Exemplo: /api/v1/analises/perfil?ano=2023&fator=apoio_social&codigo_area_geral=01. Um fator por consulta, com todas as categorias do catálogo na ordem dele e o conjunto do fator. Mostra associação, não causa.',
				querystring: perfilQuerySchema,
				response: {
					200: perfilSchema,
					400: erroSchema,
					500: erroSchema,
					503: erroSchema
				}
			}
		},
		async (request) => {
			const agregados = await consultarGold(request, () =>
				consultas.perfil(request.query)
			)
			return {
				filtros: request.query,
				...montarPerfil(agregados, request.query.fator)
			}
		}
	)
	app.get<{ Querystring: FiltrosRanking }>(
		'/api/v1/analises/ranking',
		{
			config: { acesso: 'painel' },
			schema: {
				tags: ['Análises'],
				summary:
					'Classifica as áreas gerais ou as modalidades pela taxa de evasão.',
				description:
					'Exemplo: /api/v1/analises/ranking?ano=2023&dimensao=area_geral&taxa=evasao_curso. Devolve todas as categorias do recorte. Ordena da maior para a menor taxa; taxas iguais dividem a posição (1, 2, 2, 4). Grupos com base de risco abaixo de 30, sem taxa ou sem identificador aparecem sem posição.',
				querystring: rankingQuerySchema,
				response: {
					200: rankingSchema,
					400: erroSchema,
					500: erroSchema,
					503: erroSchema
				}
			}
		},
		async (request) => {
			const agregados = await consultarGold(request, () =>
				consultas.ranking(request.query)
			)
			return {
				filtros: request.query,
				...montarRanking(agregados, request.query.taxa)
			}
		}
	)
	app.get<{ Querystring: FiltrosDispersao }>(
		'/api/v1/analises/dispersao',
		{
			config: { acesso: 'painel' },
			schema: {
				tags: ['Análises'],
				summary: 'Relaciona matrículas e evasão de cada curso em um ano.',
				description:
					'Exemplo: /api/v1/analises/dispersao?ano=2023&codigo_area_geral=01. Devolve todos os cursos do recorte, a linha de alta evasão de cada taxa e a zona crítica (taxa acima da linha e base de risco de pelo menos 30). A ordem é pelo código do curso, não um ranking.',
				querystring: dispersaoQuerySchema,
				response: {
					200: dispersaoSchema,
					400: erroSchema,
					500: erroSchema,
					503: erroSchema
				}
			}
		},
		async (request) => {
			const agregados = await consultarGold(request, () =>
				consultas.dispersao(request.query)
			)
			return { filtros: request.query, ...montarDispersao(agregados) }
		}
	)
	app.get<{ Querystring: FiltrosEvolucao }>(
		'/api/v1/analises/evolucao-temporal',
		{
			config: { acesso: 'painel' },
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
