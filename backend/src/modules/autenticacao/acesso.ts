import type { FastifyInstance } from 'fastify'
import jwt from '@fastify/jwt'
import type { ConfigAutenticacao } from '../../config/autenticacao.js'
import {
	permissoes,
	type Identidade,
	type Permissao,
	type RepositorioAutenticacao
} from './repositorio.js'

declare module 'fastify' {
	interface FastifyContextConfig {
		// painel: público ou painel:consultar, conforme PAINEL_PUBLICO.
		acesso?: 'publico' | 'painel' | 'autenticado' | Permissao
	}
	interface FastifyRequest {
		identidade: Identidade | null
		sessaoId: string | null
	}
}

export function erroAcesso(statusCode: number) {
	return Object.assign(new Error('Acesso não permitido'), { statusCode })
}

export async function registrarAcesso(
	app: FastifyInstance,
	auth?: { config: ConfigAutenticacao; repositorio: RepositorioAutenticacao },
	painelPublico = true
) {
	if (!painelPublico && !auth)
		throw new Error('Painel restrito exige autenticação habilitada')
	app.decorateRequest('identidade', null)
	app.decorateRequest('sessaoId', null)
	if (auth)
		await app.register(jwt, {
			secret: auth.config.secret,
			sign: {
				algorithm: 'HS256',
				iss: 'tcc-evasao-api',
				aud: 'tcc-evasao-admin',
				expiresIn: '10m'
			},
			verify: {
				algorithms: ['HS256'],
				allowedIss: 'tcc-evasao-api',
				allowedAud: 'tcc-evasao-admin'
			}
		})
	app.addHook('onRoute', (route) => {
		if (!route.url.startsWith('/api/')) return
		const acesso = route.config?.acesso
		if (
			!acesso ||
			!['publico', 'painel', 'autenticado', ...permissoes].includes(acesso)
		)
			throw new Error(`Declare o acesso da rota ${route.url}`)
	})
	app.addHook('preHandler', async (request, reply) => {
		const declarado = request.routeOptions.config.acesso
		const acesso =
			declarado === 'painel'
				? painelPublico
					? 'publico'
					: 'painel:consultar'
				: declarado
		if (!acesso || acesso === 'publico') return
		reply.header('Cache-Control', 'no-store')
		if (
			!auth ||
			!/^Bearer [A-Za-z0-9_.-]+$/i.test(request.headers.authorization ?? '')
		)
			throw erroAcesso(401)
		let claims: { sub?: string; sid?: string; exp?: number }
		try {
			claims = await request.jwtVerify<typeof claims>()
		} catch {
			throw erroAcesso(401)
		}
		const uuid =
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
		if (
			!claims.sub ||
			!claims.sid ||
			!uuid.test(claims.sub) ||
			!uuid.test(claims.sid) ||
			!Number.isFinite(claims.exp)
		)
			throw erroAcesso(401)
		const identidade = await auth.repositorio.identidade(claims.sid)
		if (!identidade || identidade.id !== claims.sub) throw erroAcesso(401)
		request.identidade = identidade
		request.sessaoId = claims.sid
		if (acesso !== 'autenticado' && !identidade.permissoes.includes(acesso))
			throw erroAcesso(403)
	})
}
