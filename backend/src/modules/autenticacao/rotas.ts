import { randomBytes } from 'node:crypto'
import cookie from '@fastify/cookie'
import type { FastifyInstance, FastifyReply } from 'fastify'
import type { ConfigAutenticacao } from '../../config/autenticacao.js'
import { criarHash, verificarSenha } from './senhas.js'
import {
	hashToken,
	type Identidade,
	type RepositorioAutenticacao
} from './repositorio.js'
import { erroAcesso } from './acesso.js'
import {
	csrfSchema,
	errosAuth,
	identidadeSchema,
	loginSchema,
	tokenSchema,
	trocaSenhaSchema
} from './schemas.js'
import { erroSchema } from '../../plugins/erros.js'

export async function registrarRotas(
	app: FastifyInstance,
	repo: RepositorioAutenticacao,
	config: ConfigAutenticacao
) {
	await app.register(cookie)
	const prefixo = '/api/v1/autenticacao'
	const nomeCookie = config.secure ? '__Secure-tcc_refresh' : 'tcc_refresh'
	const cookieOptions = {
		httpOnly: true,
		secure: config.secure,
		sameSite: 'strict' as const,
		path: prefixo
	}
	const hashFicticio = await criarHash(randomBytes(32).toString('hex'))
	const limiteIp = app.createRateLimit({ max: 5, timeWindow: 60_000 })
	const limiteConta = app.createRateLimit({
		max: 5,
		timeWindow: 60_000,
		keyGenerator: (request) =>
			`conta:${hashToken((request.body as { email: string }).email.toLowerCase())}`
	})
	// shortcut: limite por processo; compartilhar armazenamento antes de escalar réplicas.
	app.addHook('onRequest', async (request, reply) => {
		if (!request.routeOptions.url?.startsWith(prefixo + '/')) return
		reply.header('Cache-Control', 'no-store')
		if (
			request.method === 'POST' &&
			(request.headers.origin !== config.origin ||
				request.headers['x-csrf-protection'] !== '1')
		)
			throw erroAcesso(403)
	})
	async function emitir(
		reply: FastifyReply,
		sessao: { id: string; expira_em: Date; token: string },
		identidade: Identidade
	) {
		const access_token = await reply.jwtSign({
			sub: identidade.id,
			sid: sessao.id
		})
		reply.setCookie(nomeCookie, sessao.token, {
			...cookieOptions,
			maxAge: Math.max(
				0,
				Math.floor((sessao.expira_em.getTime() - Date.now()) / 1000)
			)
		})
		return {
			access_token,
			token_type: 'Bearer',
			expires_in: 600,
			usuario: identidade
		}
	}
	app.post<{ Body: { email: string; senha: string } }>(
		`${prefixo}/login`,
		{
			config: { acesso: 'publico' },
			schema: {
				tags: ['Autenticação'],
				summary: 'Autentica administrador e inicia sessão de sete dias.',
				headers: csrfSchema,
				body: loginSchema,
				response: { 200: tokenSchema, ...errosAuth }
			},
			preHandler: async (request, reply) => {
				for (const limitar of [limiteIp, limiteConta]) {
					const result = await limitar(request)
					if (!result.isAllowed && result.isExceeded) {
						reply.header('Retry-After', result.ttlInSeconds)
						throw erroAcesso(429)
					}
				}
			}
		},
		async (request, reply) => {
			const usuario = await repo.usuario(request.body.email.toLowerCase())
			const senhaValida = await verificarSenha(
				usuario?.senha_hash ?? hashFicticio,
				request.body.senha
			)
			if (!senhaValida || !usuario?.ativo) throw erroAcesso(401)
			const sessao = await repo.abrirSessao(usuario.id)
			const identidade = sessao && (await repo.identidade(sessao.id))
			if (!sessao || !identidade) throw erroAcesso(401)
			return emitir(reply, sessao, identidade)
		}
	)
	app.post(
		`${prefixo}/renovar`,
		{
			config: { acesso: 'publico' },
			schema: {
				tags: ['Autenticação'],
				summary: 'Rotaciona o cookie de renovação e emite novo JWT.',
				headers: csrfSchema,
				response: { 200: tokenSchema, ...errosAuth }
			}
		},
		async (request, reply) => {
			const token = request.cookies[nomeCookie]
			const sessao =
				token && /^[A-Za-z0-9_-]{43}$/.test(token)
					? await repo.renovar(token)
					: undefined
			if (!sessao) {
				reply.clearCookie(nomeCookie, cookieOptions)
				throw erroAcesso(401)
			}
			return emitir(reply, sessao, sessao.identidade)
		}
	)
	app.post(
		`${prefixo}/logout`,
		{
			config: { acesso: 'publico' },
			schema: {
				tags: ['Autenticação'],
				summary: 'Revoga a sessão do cookie, incluindo os JWTs emitidos.',
				headers: csrfSchema,
				response: { 204: { type: 'null' }, ...errosAuth }
			}
		},
		async (request, reply) => {
			const token = request.cookies[nomeCookie]
			if (token && /^[A-Za-z0-9_-]{43}$/.test(token)) await repo.revogar(token)
			reply.clearCookie(nomeCookie, cookieOptions)
			return reply.code(204).send()
		}
	)
	app.get(
		`${prefixo}/me`,
		{
			config: { acesso: 'autenticado' },
			schema: {
				tags: ['Autenticação'],
				summary: 'Consulta identidade e permissões atuais usando Bearer.',
				security: [{ bearerAuth: [] }],
				response: { 200: identidadeSchema, ...errosAuth }
			}
		},
		async (request) => request.identidade
	)
	// Por conta: um JWT roubado não serve para testar senhas sem limite.
	const limiteTroca = app.createRateLimit({
		max: 5,
		timeWindow: 60_000,
		keyGenerator: (request) => `troca:${request.identidade?.id}`
	})
	app.post<{ Body: { senha_atual: string; nova_senha: string } }>(
		`${prefixo}/senha`,
		{
			config: { acesso: 'autenticado' },
			schema: {
				tags: ['Autenticação'],
				summary:
					'Troca a própria senha e revoga as demais sessões do usuário, mantendo a atual.',
				security: [{ bearerAuth: [] }],
				headers: csrfSchema,
				body: trocaSenhaSchema,
				response: { 204: { type: 'null' }, 422: erroSchema, ...errosAuth }
			},
			preHandler: async (request, reply) => {
				const result = await limiteTroca(request)
				if (!result.isAllowed && result.isExceeded) {
					reply.header('Retry-After', result.ttlInSeconds)
					throw erroAcesso(429)
				}
			}
		},
		async (request, reply) => {
			const identidade = request.identidade!
			const usuario = await repo.usuario(identidade.email)
			// 422 e não 401: a sessão continua válida, só a senha informada falhou.
			const senhaIncorreta = () =>
				reply.code(422).send({
					erro: 'SENHA_ATUAL_INCORRETA',
					mensagem: 'A senha atual não confere.'
				})
			if (
				!usuario ||
				!(await verificarSenha(usuario.senha_hash, request.body.senha_atual))
			)
				return senhaIncorreta()
			const trocou = await repo.trocarSenha(
				identidade.id,
				request.sessaoId!,
				usuario.senha_hash,
				await criarHash(request.body.nova_senha)
			)
			if (!trocou) return senhaIncorreta()
			return reply.code(204).send()
		}
	)
}
