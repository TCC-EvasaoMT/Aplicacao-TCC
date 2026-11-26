import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildApp } from '../src/app.js'

test('logs mantêm correlação e resultado sem expor credenciais ou URLs recebidas', async (t) => {
	let output = ''
	const segredo = 'segredo-nao-registrar'
	const fail = async (): Promise<never> => {
		throw Object.assign(new Error(`postgresql://admin:${segredo}@host/base`), {
			code: segredo
		})
	}
	const app = await buildApp(
		{
			health: fail,
			catalogos: { filtros: fail },
			indicadores: { resumo: fail },
			analises: {
				evolucao: fail,
				comparacao: fail,
				dispersao: fail,
				ranking: fail,
				perfil: fail
			}
		},
		{
			logger: true,
			logStream: {
				write(message) {
					output += message
				}
			},
			maxRequisicoes: 1
		}
	)
	app.post('/teste-logs', async (request, reply) => {
		reply.header('set-cookie', `sessao=${segredo}`)
		request.log.info(
			{
				req: request,
				res: reply,
				err: new Error(segredo),
				token: segredo,
				password: segredo,
				headers: request.headers,
				body: request.body,
				query: request.query
			},
			'Evento controlado'
		)
		return { ok: true }
	})
	app.get('/teste-erro', async () => {
		throw Object.assign(new Error(segredo), { code: segredo })
	})
	t.after(() => app.close())
	const headers = {
		authorization: `Bearer ${segredo}`,
		cookie: `sessao=${segredo}`,
		'x-request-id': segredo,
		host: `${segredo}.test`
	}
	const falha = await app.inject({ url: '/api/v1/filtros', headers })
	assert.equal(falha.statusCode, 503)
	const limitado = await app.inject({ url: '/api/v1/filtros', headers })
	assert.equal(limitado.statusCode, 429)
	assert.equal(
		(await app.inject({ url: `/${segredo}?token=${segredo}`, headers }))
			.statusCode,
		404
	)
	assert.equal(
		(
			await app.inject({
				url: `/teste-logs?token=${segredo}`,
				method: 'POST',
				headers,
				payload: { password: segredo }
			})
		).statusCode,
		200
	)
	assert.equal((await app.inject('/teste-erro')).statusCode, 500)
	assert.ok(!output.includes(segredo), output)
	assert.ok(!output.includes('postgresql://'))
	const logs = output
		.trim()
		.split('\n')
		.map((line) => JSON.parse(line))
	for (const response of [falha, limitado]) {
		const id = response.headers['x-request-id']
		assert.match(String(id), /^[a-f0-9-]{36}$/)
		const concluida = logs.find(
			(log) => log.reqId === id && log.msg === 'Requisição concluída'
		)
		assert.equal(concluida.statusCode, response.statusCode)
		assert.equal(concluida.route, '/api/v1/filtros')
		assert.equal(typeof concluida.responseTime, 'number')
	}
	assert.notEqual(
		falha.headers['x-request-id'],
		limitado.headers['x-request-id']
	)
	assert.ok(logs.some((log) => log.code === 'INTERNAL_ERROR'))
})
