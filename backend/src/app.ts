import Fastify, { LogController, type FastifyError } from 'fastify'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import {
	indicadores,
	type ConsultasIndicadores
} from './modules/indicadores/index.js'
import {
	catalogos,
	type ConsultasCatalogos
} from './modules/catalogos/index.js'
import { health } from './plugins/health.js'
import { analises, type ConsultasAnalises } from './modules/analises/index.js'
import { registrarFrontend } from './frontend.js'
import { registrarSeguranca } from './plugins/seguranca.js'
import { randomUUID } from 'node:crypto'
import {
	registrarAcesso,
	registrarAutenticacao,
	type RepositorioAutenticacao
} from './modules/autenticacao/index.js'
import type { ConfigAutenticacao } from './config/autenticacao.js'
import {
	codigoErroSeguro,
	configurarLogger,
	registrarLogs
} from './plugins/logs.js'

export interface Dependencias {
	indicadores: ConsultasIndicadores
	catalogos: ConsultasCatalogos
	analises: ConsultasAnalises
	health: () => Promise<void>
	autenticacao?: {
		config: ConfigAutenticacao
		repositorio: RepositorioAutenticacao
	}
}

export async function buildApp(
	dependencias: Dependencias,
	options: {
		docs?: boolean
		logger?: boolean
		logStream?: { write(message: string): void }
		frontendDir?: string
		maxRequisicoes?: number
		proxiesConfiaveis?: string[]
		// false: as consultas exigem login com painel:consultar.
		painelPublico?: boolean
	} = {}
) {
	const app = Fastify({
		logger: options.logger ? configurarLogger(options.logStream) : false,
		logController: new LogController({ disableRequestLogging: true }),
		requestIdHeader: false,
		genReqId: () => randomUUID(),
		// Só os endereços listados: confiar em qualquer origem deixaria o
		// cliente escolher o próprio IP pelo X-Forwarded-For.
		trustProxy: options.proxiesConfiaveis?.length
			? options.proxiesConfiaveis
			: false,
		bodyLimit: 16 * 1024,
		requestTimeout: 10_000,
		ajv: { customOptions: { removeAdditional: false, coerceTypes: true } }
	})
	app.setErrorHandler<FastifyError>((error, request, reply) => {
		if (error.validation || error.statusCode === 400) {
			return reply.code(400).send({
				erro: 'PARAMETROS_INVALIDOS',
				mensagem: 'Confira os campos e parâmetros enviados.'
			})
		}
		if (error.code === 'GOLD_INDISPONIVEL') {
			return reply.code(503).send({ erro: error.code, mensagem: error.message })
		}
		const errosHttp: Record<number, [string, string]> = {
			401: ['NAO_AUTENTICADO', 'Autenticação necessária.'],
			403: ['ACESSO_NEGADO', 'Acesso não permitido.'],
			404: ['ROTA_NAO_ENCONTRADA', 'Rota não encontrada.'],
			408: ['TEMPO_ESGOTADO', 'Tempo de recebimento da solicitação esgotado.'],
			413: ['CORPO_MUITO_GRANDE', 'O corpo da solicitação excede 16 KiB.'],
			415: ['TIPO_NAO_SUPORTADO', 'Tipo de conteúdo não suportado.'],
			429: [
				'LIMITE_REQUISICOES',
				'Limite de requisições atingido. Aguarde o tempo indicado em Retry-After.'
			]
		}
		const erroHttp = errosHttp[error.statusCode ?? 500]
		if (erroHttp) {
			return reply
				.code(error.statusCode!)
				.send({ erro: erroHttp[0], mensagem: erroHttp[1] })
		}
		request.log.error({ code: codigoErroSeguro(error) }, 'Erro interno')
		return reply.code(500).send({
			erro: 'ERRO_INTERNO',
			mensagem: 'Não foi possível processar a solicitação.'
		})
	})
	registrarLogs(app)
	await registrarSeguranca(app, options.maxRequisicoes)
	const painelPublico = options.painelPublico ?? true
	await registrarAcesso(app, dependencias.autenticacao, painelPublico)
	if (!options.frontendDir) {
		app.setNotFoundHandler((_request, reply) =>
			reply
				.code(404)
				.send({ erro: 'ROTA_NAO_ENCONTRADA', mensagem: 'Rota não encontrada.' })
		)
	}

	if (options.docs) {
		await app.register(swagger, {
			openapi: {
				components: {
					securitySchemes: {
						bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
					}
				},
				info: {
					title: 'Evasão no ensino superior público de MT',
					version: '0.1.0',
					description:
						'API de consulta à Gold da pipeline SEDAP+. Indicadores agregados por vínculo aluno–curso.'
				},
				tags: [
					{ name: 'Autenticação' },
					{ name: 'Indicadores' },
					{ name: 'Catálogos' },
					{ name: 'Análises' },
					{ name: 'Operação' }
				]
			}
		})
		await app.register(swaggerUi, {
			routePrefix: '/docs',
			uiConfig: { validatorUrl: null },
			staticCSP: true,
			transformStaticCSP: (header) =>
				header
					.replace('upgrade-insecure-requests;', '')
					.replace("frame-ancestors 'self'", "frame-ancestors 'none'")
					.replace(' validator.swagger.io', '')
		})
	}
	if (dependencias.autenticacao)
		await registrarAutenticacao(
			app,
			dependencias.autenticacao.repositorio,
			dependencias.autenticacao.config
		)
	await app.register(health, { consultar: dependencias.health })
	// Pública: a interface precisa saber, antes do login, se o painel é restrito.
	app.get(
		'/api/v1/configuracao',
		{
			config: { acesso: 'publico' },
			schema: {
				tags: ['Operação'],
				summary:
					'Informa se o painel exige login e se o login está habilitado.',
				response: {
					200: {
						type: 'object',
						additionalProperties: false,
						required: ['painel_restrito', 'autenticacao'],
						properties: {
							painel_restrito: {
								type: 'boolean',
								description:
									'true: as consultas exigem login com painel:consultar (PAINEL_PUBLICO=false).'
							},
							autenticacao: { type: 'boolean' }
						}
					}
				}
			}
		},
		async () => ({
			painel_restrito: !painelPublico,
			autenticacao: !!dependencias.autenticacao
		})
	)
	await app.register(catalogos, { consultas: dependencias.catalogos })
	await app.register(indicadores, { consultas: dependencias.indicadores })
	await app.register(analises, { consultas: dependencias.analises })
	if (options.frontendDir) await registrarFrontend(app, options.frontendDir)
	return app
}
