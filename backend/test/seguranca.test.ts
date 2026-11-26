import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildApp, type Dependencias } from '../src/app.js'
import { readConfig } from '../src/config/index.js'
import { medidas, type Agregado } from '../src/modules/indicadores/calculos.js'

const consultas: Dependencias = {
	async health() {},
	catalogos: {
		async filtros() {
			return {
				anos: [],
				cursos: [],
				areas_gerais: [],
				municipios_oferta: [],
				municipios_sede: [],
				modalidades: [],
				categorias_administrativas: [],
				organizacoes_academicas: []
			}
		}
	},
	indicadores: {
		async resumo() {
			return {
				...Object.fromEntries(medidas.map((m) => [m, null])),
				registros_com_alunos: 0,
				registros_sem_alunos: 0,
				registros_sem_ingressantes: 0,
				ingressantes_total: null,
				flag_valor_negativo: null,
				dados_incompletos: null
			} as Agregado
		}
	},
	analises: {
		comparacao: async () => [],
		dispersao: async () => [],
		async evolucao() {
			return []
		}
	}
}

test('consultas públicas mantêm acesso sem login e cabeçalhos de proteção', async (t) => {
	const app = await buildApp(consultas)
	t.after(() => app.close())
	for (const url of [
		'/health',
		'/api/v1/filtros',
		'/api/v1/indicadores/resumo?ano=2023',
		'/api/v1/analises/evolucao-temporal?ano_inicial=2022&ano_final=2023',
		'/api/v1/analises/comparacoes?ano=2023&agrupar_por=modalidade',
		'/api/v1/analises/dispersao?ano=2023'
	]) {
		const res = await app.inject(url)
		assert.equal(res.statusCode, 200, url)
		assert.equal(res.headers['x-content-type-options'], 'nosniff')
		assert.equal(res.headers['x-frame-options'], 'DENY')
		assert.equal(res.headers['referrer-policy'], 'no-referrer')
		assert.match(
			String(res.headers['content-security-policy']),
			/script-src 'self';/
		)
		assert.match(
			String(res.headers['content-security-policy']),
			/frame-ancestors 'none'/
		)
		assert.doesNotMatch(
			String(res.headers['content-security-policy']),
			/upgrade-insecure-requests|unsafe-eval/
		)
	}
})

test('limite é compartilhado entre rotas e não confia em cabeçalhos do cliente', async (t) => {
	const app = await buildApp(consultas, { maxRequisicoes: 2 })
	t.after(() => app.close())
	assert.equal((await app.inject('/api/v1/filtros')).statusCode, 200)
	assert.equal(
		(await app.inject('/api/v1/indicadores/resumo?ano=2023')).statusCode,
		200
	)
	const limitado = await app.inject({
		url: '/api/v1/analises/evolucao-temporal?ano_inicial=2023&ano_final=2023',
		headers: { 'x-forwarded-for': '203.0.113.3', 'x-real-ip': '203.0.113.4' }
	})
	assert.equal(limitado.statusCode, 429)
	assert.equal(limitado.json().erro, 'LIMITE_REQUISICOES')
	assert.ok(Number(limitado.headers['retry-after']) > 0)
	assert.equal(limitado.headers['x-ratelimit-remaining'], '0')
	assert.equal(limitado.headers['x-content-type-options'], 'nosniff')
	assert.equal((await app.inject('/api/inexistente')).statusCode, 429)
	assert.equal((await app.inject('/health')).statusCode, 200)
	assert.equal(
		(await app.inject({ url: '/api/v1/filtros', remoteAddress: '203.0.113.5' }))
			.statusCode,
		200
	)
})

test('limite renova a janela e mantém contadores separados por instância', async (t) => {
	t.mock.timers.enable({ apis: ['Date'] })
	const app = await buildApp(consultas, { maxRequisicoes: 1 })
	const outro = await buildApp(consultas, { maxRequisicoes: 1 })
	t.after(async () => {
		await app.close()
		await outro.close()
	})
	assert.equal((await app.inject('/api/v1/filtros')).statusCode, 200)
	assert.equal((await app.inject('/api/v1/filtros')).statusCode, 429)
	assert.equal((await outro.inject('/api/v1/filtros')).statusCode, 200)
	t.mock.timers.tick(60_001)
	assert.equal((await app.inject('/api/v1/filtros')).statusCode, 200)
})

test('erros HTTP preservam status sem expor mensagens internas e limitam corpos', async (t) => {
	const app = await buildApp(consultas)
	app.post('/teste-corpo', async () => ({ ok: true }))
	for (const status of [401, 403, 404, 408, 500]) {
		app.get(`/teste-${status}`, async () => {
			throw Object.assign(new Error('segredo-interno'), { statusCode: status })
		})
	}
	t.after(() => app.close())
	for (const status of [401, 403, 404, 408, 500]) {
		const res = await app.inject(`/teste-${status}`)
		assert.equal(res.statusCode, status)
		assert.ok(!res.body.includes('segredo-interno'))
	}
	assert.equal(
		(
			await app.inject({
				method: 'POST',
				url: '/teste-corpo',
				payload: { valor: 'x'.repeat(16 * 1024) }
			})
		).statusCode,
		413
	)
	assert.equal(
		(
			await app.inject({
				method: 'POST',
				url: '/teste-corpo',
				headers: { 'content-type': 'application/xml' },
				payload: '<x />'
			})
		).statusCode,
		415
	)
	assert.equal(app.server.requestTimeout, 10_000)
})

test('Swagger restringe scripts, documenta 429 e fica ausente em produção', async (t) => {
	const env = {
		POSTGRES_DB: 'tcc',
		POSTGRES_USER: 'leitura',
		POSTGRES_PASSWORD: 'teste',
		NODE_ENV: 'production'
	}
	const prod = await buildApp(consultas, readConfig(env))
	const dev = await buildApp(consultas, { docs: true, maxRequisicoes: 1 })
	t.after(async () => {
		await prod.close()
		await dev.close()
	})
	assert.equal((await prod.inject('/docs/')).statusCode, 404)
	await dev.inject('/api/v1/filtros')
	assert.equal((await dev.inject('/api/v1/filtros')).statusCode, 429)
	const docs = await dev.inject('/docs/')
	assert.equal(docs.statusCode, 200)
	assert.match(
		String(docs.headers['content-security-policy']),
		/script-src 'self'/
	)
	assert.doesNotMatch(
		String(docs.headers['content-security-policy']),
		/unsafe-eval|upgrade-insecure-requests/
	)
	const spec = (await dev.inject('/docs/json')).json()
	assert.ok(spec.paths['/api/v1/filtros'].get.responses['429'])
	assert.equal(
		spec.paths['/api/v1/filtros'].get.responses['429'].content[
			'application/json'
		].schema.example.erro,
		'LIMITE_REQUISICOES'
	)
	for (const value of ['0', '-1', 'abc', '1.5', '10001', '']) {
		assert.throws(
			() => readConfig({ ...env, HTTP_RATE_LIMIT_MAX: value }),
			/HTTP_RATE_LIMIT_MAX/
		)
	}
	assert.equal(readConfig(env).maxRequisicoes, 120)
	assert.equal(
		readConfig({ ...env, HTTP_RATE_LIMIT_MAX: '300' }).maxRequisicoes,
		300
	)
})
