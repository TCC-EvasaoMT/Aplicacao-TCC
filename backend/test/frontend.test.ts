import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { buildApp, type Dependencias } from '../src/app.js'

const consultas: Dependencias = {
	analises: {
		comparacao: async () => [],
		dispersao: async () => [],
		ranking: async () => [],
		async evolucao() {
			return []
		}
	},
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
			throw new Error('indisponível')
		}
	}
}

test('Fastify serve a SPA sem mascarar erros da API, do Swagger ou de assets', async (t) => {
	const dir = await mkdtemp(join(tmpdir(), 'tcc-frontend-'))
	const html =
		'<!doctype html><title>Frontend de teste</title><div id="root"></div>'
	await mkdir(join(dir, 'assets'))
	await writeFile(join(dir, 'index.html'), html)
	await writeFile(join(dir, 'assets', 'app.js'), 'console.log("fixture")')
	await writeFile(join(dir, '.env'), 'fixture-nao-publica')
	const app = await buildApp(consultas, { frontendDir: dir })
	t.after(async () => {
		await app.close()
		await rm(dir, { recursive: true, force: true })
	})
	const root = await app.inject('/')
	assert.equal(root.statusCode, 200)
	assert.match(root.headers['content-type']!, /text\/html/)
	assert.equal(root.body, html)
	assert.equal((await app.inject('/assets/app.js')).statusCode, 200)
	const navegacao = await app.inject({
		url: '/analises/cursos',
		headers: { accept: 'text/html' }
	})
	assert.equal(navegacao.statusCode, 200)
	assert.equal(navegacao.body, html)
	for (const url of [
		'/api',
		'/api/inexistente',
		'/api/v1/inexistente',
		'/docs/',
		'/health/inexistente',
		'/assets/inexistente.js',
		'/assets/inexistente',
		'/favicon.ico',
		'/.env'
	]) {
		const response = await app.inject({ url, headers: { accept: 'text/html' } })
		assert.equal(response.statusCode, 404, url)
		assert.match(response.headers['content-type']!, /application\/json/, url)
		assert.ok(!response.body.includes('fixture-nao-publica'))
	}
	assert.equal((await app.inject('/analises/cursos')).statusCode, 404)
	assert.equal(
		(
			await app.inject({
				method: 'POST',
				url: '/analises',
				headers: { accept: 'text/html' }
			})
		).statusCode,
		404
	)
	assert.equal((await app.inject('/api/v1/indicadores/resumo')).statusCode, 400)
	assert.equal(
		(await app.inject('/api/v1/indicadores/resumo?ano=2023')).statusCode,
		503
	)
	assert.deepEqual((await app.inject('/api/v1/filtros')).json().anos, [])
	assert.equal((await app.inject('/health')).statusCode, 200)
})

test('Swagger e frontend podem coexistir no mesmo servidor', async (t) => {
	const dir = await mkdtemp(join(tmpdir(), 'tcc-swagger-'))
	await writeFile(join(dir, 'index.html'), '<html>frontend</html>')
	const app = await buildApp(consultas, { frontendDir: dir, docs: true })
	t.after(async () => {
		await app.close()
		await rm(dir, { recursive: true, force: true })
	})
	assert.equal((await app.inject('/')).statusCode, 200)
	assert.equal((await app.inject('/docs/')).statusCode, 200)
	assert.equal(
		(await app.inject('/docs/static/swagger-ui-bundle.js')).statusCode,
		200
	)
	const spec = (await app.inject('/docs/json')).json()
	assert.ok(spec.paths['/api/v1/filtros'])
	assert.ok(!spec.paths['/*'])
})

test('iniciar sem o build do frontend informa o comando necessário', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'tcc-missing-build-'))
	try {
		await assert.rejects(
			buildApp(consultas, { frontendDir: dir }),
			/Execute pnpm build/
		)
	} finally {
		await rm(dir, { recursive: true, force: true })
	}
})
