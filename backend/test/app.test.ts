import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildApp, type Dependencias } from '../src/app.js'
import { readConfig } from '../src/config/index.js'
import { medidas, type Agregado } from '../src/modules/indicadores/calculos.js'
import {
	consultaResumo,
	type Filtros
} from '../src/modules/indicadores/consultas.js'

const catalogo = {
	anos: [2023],
	cursos: [],
	areas_gerais: [],
	municipios_oferta: [],
	municipios_sede: [],
	modalidades: [],
	categorias_administrativas: [],
	organizacoes_academicas: []
}
function fakeConsultas(): Dependencias {
	return {
		async health() {},
		analises: {
			comparacao: async () => [],
			dispersao: async () => [],
			ranking: async () => [],
			perfil: async () => [],
			async evolucao() {
				return []
			}
		},
		catalogos: {
			async filtros() {
				return catalogo
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
		}
	}
}

test('API valida parâmetros e preserva códigos como texto', async (t) => {
	let received: Filtros | undefined
	const consultas = fakeConsultas()
	const original = consultas.indicadores.resumo
	consultas.indicadores.resumo = async (filtros) => {
		received = filtros
		return original(filtros)
	}
	const app = await buildApp(consultas)
	t.after(() => app.close())
	const result = await app.inject(
		'/api/v1/indicadores/resumo?ano=2023&codigo_curso=001&codigo_area_geral=01'
	)
	assert.equal(result.statusCode, 200)
	assert.deepEqual(
		{ ...received },
		{ ano: 2023, codigo_curso: '001', codigo_area_geral: '01' }
	)
	assert.equal(result.json().qualidade.sem_dados, true)
	assert.equal(result.json().totais.matriculas_total, null)
	for (const query of [
		'',
		'?ano=abc',
		'?ano=2023.5',
		'?ano=0',
		'?ano=2023&ano=2022',
		'?ano=2023&codigo_curso=1&codigo_curso=2',
		'?ano=2023&codigo_curso=',
		'?ano=2023&desconhecido=x',
		'?ano=2023&codigo_curso=1%27',
		'?ano=2023&modalidade=%20%20'
	]) {
		const invalid = await app.inject(`/api/v1/indicadores/resumo${query}`)
		assert.equal(invalid.statusCode, 400, query)
		assert.equal(invalid.json().erro, 'PARAMETROS_INVALIDOS')
	}
	assert.equal((await app.inject('/api/v1/filtros?ano=2023')).statusCode, 400)
})

test('consultas usam parâmetros para todos os filtros, inclusive texto arbitrário', () => {
	const query = consultaResumo({
		ano: 2023,
		codigo_curso: '001',
		codigo_area_geral: '01',
		codigo_municipio_oferta: '5103403',
		modalidade: "x' OR TRUE --",
		categoria_administrativa: 'Pública Federal',
		organizacao_academica: 'Universidade',
		codigo_municipio_sede: '5102504'
	})
	assert.equal(query.values.length, 8)
	assert.ok(query.text.includes('i.codigo_municipio_sede = $8'))
	assert.ok(!query.text.includes("x' OR TRUE"))
	assert.equal(query.values[2], '01')
})

test('health e endpoints retornam 503 sem vazar erro do banco', async (t) => {
	const fail = async (): Promise<never> => {
		throw new Error('postgresql://admin:segredo@host/base SELECT confidencial')
	}
	const app = await buildApp({
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
	})
	t.after(() => app.close())
	for (const route of [
		'/health',
		'/api/v1/filtros',
		'/api/v1/indicadores/resumo?ano=2023',
		'/api/v1/analises/evolucao-temporal?ano_inicial=2022&ano_final=2024'
	]) {
		const result = await app.inject(route)
		assert.equal(result.statusCode, 503)
		assert.equal(result.json().erro, 'GOLD_INDISPONIVEL')
		assert.ok(!result.body.includes('segredo'))
	}
})

test('Swagger documenta contratos e fica ausente quando desativado', async (t) => {
	const dev = await buildApp(fakeConsultas(), { docs: true })
	const prod = await buildApp(fakeConsultas())
	t.after(async () => {
		await dev.close()
		await prod.close()
	})
	assert.equal((await dev.inject('/docs/')).statusCode, 200)
	const spec = (await dev.inject('/docs/json')).json()
	const resumo = spec.paths['/api/v1/indicadores/resumo'].get
	assert.deepEqual(spec.paths['/api/v1/filtros'].get.tags, ['Catálogos'])
	const evolucao = spec.paths['/api/v1/analises/evolucao-temporal'].get
	assert.deepEqual(evolucao.tags, ['Análises'])
	assert.deepEqual(
		evolucao.parameters
			.filter((p: { required: boolean }) => p.required)
			.map((p: { name: string }) => p.name),
		['ano_inicial', 'ano_final']
	)
	assert.equal(
		resumo.parameters.find((p: { name: string }) => p.name === 'ano').required,
		true
	)
	assert.ok(resumo.responses['200'])
	assert.ok(resumo.responses['503'])
	assert.equal((await prod.inject('/docs/')).statusCode, 404)
	assert.deepEqual((await dev.inject('/api/v1/filtros')).json(), catalogo)
	assert.deepEqual((await dev.inject('/health')).json(), { status: 'ok' })
})

test('configuração falha cedo quando incompleta, sem incluir senhas no erro', () => {
	const env = {
		POSTGRES_DB: 'tcc',
		POSTGRES_USER: 'tcc_api',
		POSTGRES_PASSWORD: 'segredo'
	}
	assert.equal(readConfig(env).port, 3000)
	assert.equal(readConfig(env).docs, true)
	assert.equal(readConfig({ ...env, NODE_ENV: 'production' }).docs, false)
	assert.throws(
		() => readConfig({ ...env, PORT: '3000abc' }),
		/Porta inválida: PORT/
	)
	assert.throws(
		() => readConfig({ ...env, POSTGRES_PORT: '65536' }),
		/POSTGRES_PORT/
	)
	assert.throws(
		() => readConfig({ ...env, POSTGRES_PASSWORD: '' }),
		/POSTGRES_PASSWORD/
	)
})
