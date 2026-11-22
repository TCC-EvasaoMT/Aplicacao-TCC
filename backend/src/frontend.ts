import { access } from 'node:fs/promises'
import { extname, join } from 'node:path'
import type { FastifyInstance } from 'fastify'
import fastifyStatic from '@fastify/static'

export async function registrarFrontend(app: FastifyInstance, root: string) {
	try {
		await access(join(root, 'index.html'))
	} catch {
		throw new Error(
			'Frontend compilado não encontrado. Execute pnpm build na raiz antes de pnpm start.'
		)
	}
	await app.register(async (web) => {
		await web.register(fastifyStatic, { root, dotfiles: 'ignore', maxAge: 0 })
		web.setNotFoundHandler((request, reply) => {
			const pathname = new URL(request.url, 'http://localhost').pathname
			const reservado = /^\/(api|docs|health|assets)(\/|$)/.test(pathname)
			const navegacao =
				(request.method === 'GET' || request.method === 'HEAD') &&
				request.headers.accept?.includes('text/html')
			// Rotas da SPA recebem index.html; erros da API e arquivos ausentes mantêm 404.
			if (
				navegacao &&
				!reservado &&
				!extname(pathname) &&
				!pathname.includes('/.')
			) {
				return reply.sendFile('index.html')
			}
			return reply
				.code(404)
				.send({ erro: 'ROTA_NAO_ENCONTRADA', mensagem: 'Rota não encontrada.' })
		})
	})
}
