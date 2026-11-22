import Fastify, { type FastifyError } from 'fastify'
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

export interface Dependencias {
	indicadores: ConsultasIndicadores
	catalogos: ConsultasCatalogos
	analises: ConsultasAnalises
	health: () => Promise<void>
}

export async function buildApp(
	dependencias: Dependencias,
	options: { docs?: boolean; logger?: boolean; frontendDir?: string } = {}
) {
	const app = Fastify({
		logger: options.logger ?? false,
		ajv: { customOptions: { removeAdditional: false, coerceTypes: true } }
	})
	app.setErrorHandler<FastifyError>((error, request, reply) => {
		if (error.validation || error.statusCode === 400) {
			return reply.code(400).send({
				erro: 'PARAMETROS_INVALIDOS',
				mensagem:
					'Confira os parâmetros e envie um único valor para cada filtro.'
			})
		}
		if (error.code === 'GOLD_INDISPONIVEL') {
			return reply.code(503).send({ erro: error.code, mensagem: error.message })
		}
		request.log.error({ code: error.code ?? 'INTERNAL_ERROR' }, 'Erro interno')
		return reply.code(500).send({
			erro: 'ERRO_INTERNO',
			mensagem: 'Não foi possível processar a solicitação.'
		})
	})
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
				info: {
					title: 'Evasão no ensino superior público de MT',
					version: '0.1.0',
					description:
						'API de consulta à Gold da pipeline SEDAP+. Indicadores agregados por vínculo aluno–curso.'
				},
				tags: [
					{ name: 'Indicadores' },
					{ name: 'Catálogos' },
					{ name: 'Análises' },
					{ name: 'Operação' }
				]
			}
		})
		await app.register(swaggerUi, { routePrefix: '/docs' })
	}
	await app.register(health, { consultar: dependencias.health })
	await app.register(catalogos, { consultas: dependencias.catalogos })
	await app.register(indicadores, { consultas: dependencias.indicadores })
	await app.register(analises, { consultas: dependencias.analises })
	if (options.frontendDir) await registrarFrontend(app, options.frontendDir)
	return app
}
