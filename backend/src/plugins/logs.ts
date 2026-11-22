import type {
	FastifyInstance,
	FastifyRequest,
	FastifyServerOptions
} from 'fastify'

export function codigoErroSeguro(error: unknown): string {
	const code =
		error && typeof error === 'object' && 'code' in error
			? error.code
			: undefined
	if (
		typeof code === 'string' &&
		(/^[0-9A-Z]{5}$/.test(code) ||
			/^FST_ERR_[A-Z_]{1,60}$/.test(code) ||
			[
				'ECONNREFUSED',
				'ECONNRESET',
				'ETIMEDOUT',
				'ENOTFOUND',
				'GOLD_INDISPONIVEL'
			].includes(code))
	)
		return code
	return 'INTERNAL_ERROR'
}

export function configurarLogger(stream?: {
	write(message: string): void
}): FastifyServerOptions['logger'] {
	return {
		level: 'info',
		...(stream ? { stream } : {}),
		redact: {
			paths: [
				'headers',
				'body',
				'query',
				'password',
				'token',
				'access_token',
				'refresh_token',
				'authorization',
				'cookie',
				'req.headers',
				'req.body',
				'req.query',
				'res.headers'
			],
			remove: true
		},
		serializers: {
			req: (request: FastifyRequest) => ({
				method: request.method,
				route: request.routeOptions?.url ?? 'rota-desconhecida'
			}),
			res: (reply) => ({ statusCode: reply.statusCode }),
			err: (error: unknown) => ({
				type: 'Error',
				message: 'Erro interno',
				stack: '',
				code: codigoErroSeguro(error)
			})
		}
	}
}

export function registrarLogs(app: FastifyInstance) {
	app.addHook('onRequest', async (request, reply) => {
		reply.header('x-request-id', request.id)
	})
	app.addHook('onResponse', async (request, reply) => {
		request.log.info(
			{
				method: request.method,
				route: request.routeOptions.url ?? 'rota-desconhecida',
				statusCode: reply.statusCode,
				responseTime: reply.elapsedTime
			},
			'Requisição concluída'
		)
	})
}
