import type { FastifyInstance } from 'fastify'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import { erroSchema } from './erros.js'

export async function registrarSeguranca(
	app: FastifyInstance,
	maxRequisicoes = 120
) {
	await app.register(helmet, {
		// HTTPS e HSTS serão configurados no ingresso da implantação.
		strictTransportSecurity: false,
		frameguard: { action: 'deny' },
		referrerPolicy: { policy: 'no-referrer' },
		contentSecurityPolicy: {
			directives: {
				defaultSrc: ["'self'"],
				scriptSrc: ["'self'"],
				// Recharts usa estilos inline no gráfico e no tooltip; o PrimeReact injeta
				// uma folha de estilo pequena para esconder campos auxiliares.
				styleSrc: ["'self'", "'unsafe-inline'"],
				fontSrc: ["'self'"],
				imgSrc: ["'self'", 'data:'],
				connectSrc: ["'self'"],
				frameAncestors: ["'none'"],
				objectSrc: ["'none'"],
				upgradeInsecureRequests: null
			}
		}
	})
	await app.register(rateLimit, {
		global: false,
		max: maxRequisicoes,
		timeWindow: 60_000
	})
	// shortcut: memória por processo; usar armazenamento compartilhado ao escalar.
	const limitar = app.rateLimit()
	app.addHook('onRequest', async (request, reply) => {
		if (/^\/api(?:\/|\?|$)/.test(request.url)) {
			await limitar.call(app, request, reply)
		}
	})
	app.addHook('onRoute', (route) => {
		if (route.url.startsWith('/api/')) {
			route.schema = {
				...route.schema,
				response: {
					...(route.schema?.response as Record<string, unknown>),
					429: {
						...erroSchema,
						description:
							'Limite de requisições atingido. Consulte Retry-After (segundos).',
						example: {
							erro: 'LIMITE_REQUISICOES',
							mensagem:
								'Limite de requisições atingido. Aguarde o tempo indicado em Retry-After.'
						}
					}
				}
			}
		}
	})
}
