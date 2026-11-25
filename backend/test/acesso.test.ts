import assert from 'node:assert/strict'
import { test } from 'node:test'
import Fastify from 'fastify'
import { registrarAcesso } from '../src/modules/autenticacao/index.js'

test('rotas da API exigem classificação explícita e auth desabilitada não abre acesso protegido', async (t) => {
	const app = Fastify()
	t.after(() => app.close())
	await registrarAcesso(app)
	assert.throws(
		() => app.get('/api/esquecida', async () => ({})),
		/Declare o acesso/
	)
	app.get('/api/publica', { config: { acesso: 'publico' } }, async () => ({
		ok: true
	}))
	app.get(
		'/api/administracao',
		{ config: { acesso: 'etl:consultar' } },
		async () => ({ ok: true })
	)
	assert.equal((await app.inject('/api/publica')).statusCode, 200)
	assert.equal((await app.inject('/api/administracao')).statusCode, 401)
})
