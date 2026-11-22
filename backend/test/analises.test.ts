import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildApp } from '../src/app.js'
import {
	consultaEvolucao,
	type AgregadoAnual,
	type FiltrosEvolucao
} from '../src/modules/analises/consultas.js'
import { montarSerie } from '../src/modules/analises/evolucao.js'

const registro: AgregadoAnual = {
	ano: 2023,
	vinculos_total: '1000',
	ingressantes_total: '120',
	matriculas_total: '670',
	concluintes_total: '120',
	alunos_cursando: '550',
	alunos_desvinculados: '190',
	alunos_transferidos: '50',
	alunos_matricula_trancada: '90',
	alunos_falecidos: '0',
	registros_com_alunos: 2,
	registros_sem_alunos: 0,
	flag_valor_negativo: false,
	dados_incompletos: false
}

test('evolução valida período antes de consultar e preserva os sete filtros', async (t) => {
	const chamadas: FiltrosEvolucao[] = []
	const unused = async (): Promise<never> => {
		throw new Error('Módulo inesperado')
	}
	const app = await buildApp({
		health: unused,
		catalogos: { filtros: unused },
		indicadores: { resumo: unused },
		analises: {
			async evolucao(filtros) {
				chamadas.push(filtros)
				return []
			}
		}
	})
	t.after(() => app.close())
	const base = '/api/v1/analises/evolucao-temporal'
	for (const query of [
		'',
		'?ano_inicial=2022',
		'?ano_final=2024',
		'?ano_inicial=x&ano_final=2024',
		'?ano_inicial=2022.5&ano_final=2024',
		'?ano_inicial=1899&ano_final=2024',
		'?ano_inicial=9999&ano_final=10000',
		'?ano_inicial=2024&ano_final=2022',
		'?ano_inicial=2000&ano_final=2030',
		'?ano_inicial=2022&ano_inicial=2023&ano_final=2024',
		'?ano_inicial=2022&ano_final=2024&ano_final=2025',
		'?ano_inicial=2022&ano_final=2024&ano=2023',
		'?ano_inicial=2022&ano_final=2024&codigo_curso=',
		'?ano_inicial=2022&ano_final=2024&codigo_curso=001&codigo_curso=002',
		'?ano_inicial=2022&ano_final=2024&modalidade=%20',
		'?ano_inicial=2022&ano_final=2024&outro=x'
	]) {
		const response = await app.inject(base + query)
		assert.equal(response.statusCode, 400, query)
		assert.equal(response.json().erro, 'PARAMETROS_INVALIDOS')
	}
	assert.equal(chamadas.length, 0)
	const filtros = {
		ano_inicial: '2023',
		ano_final: '2023',
		codigo_curso: '001',
		codigo_area_geral: '01',
		modalidade: 'Presencial',
		categoria_administrativa: 'Pública Federal',
		organizacao_academica: 'Universidade',
		codigo_municipio_oferta: '5103403',
		codigo_municipio_sede: '5102504'
	}
	const response = await app.inject(`${base}?${new URLSearchParams(filtros)}`)
	assert.equal(response.statusCode, 200)
	assert.deepEqual(
		{ ...chamadas[0] },
		{ ...filtros, ano_inicial: 2023, ano_final: 2023 }
	)
	assert.deepEqual(response.json().filtros, { ...chamadas[0] })
	assert.equal(response.json().serie.length, 1)
	assert.equal(response.json().serie[0].qualidade.sem_dados, true)
	assert.equal(response.json().serie[0].totais.vinculos_total, null)
	const limite = await app.inject(`${base}?ano_inicial=2000&ano_final=2029`)
	assert.equal(limite.statusCode, 200)
	assert.equal(limite.json().serie.length, 30)
})

test('SQL agrupa por ano em uma consulta e parametriza intervalo e filtros', () => {
	const query = consultaEvolucao({
		ano_inicial: 2022,
		ano_final: 2024,
		codigo_curso: '001',
		codigo_area_geral: '01',
		codigo_municipio_oferta: '5103403',
		modalidade: "x' OR TRUE --",
		categoria_administrativa: 'Pública Federal',
		organizacao_academica: 'Universidade',
		codigo_municipio_sede: '5102504'
	})
	assert.deepEqual(query.values, [
		2022,
		2024,
		'001',
		'01',
		'5103403',
		"x' OR TRUE --",
		'Pública Federal',
		'Universidade',
		'5102504'
	])
	assert.match(query.text, /BETWEEN \$1 AND \$2/)
	assert.match(query.text, /i.codigo_municipio_sede = \$9/)
	assert.match(query.text, /GROUP BY t.ano_censo/)
	assert.match(query.text, /ORDER BY t.ano_censo ASC/)
	assert.ok(!query.text.includes("x' OR TRUE"))
})

test('série ordena anos, mantém lacunas e calcula cada ano separadamente', () => {
	const serie = montarSerie({ ano_inicial: 2021, ano_final: 2024 }, [
		registro,
		{
			...registro,
			ano: 2022,
			alunos_desvinculados: '90',
			alunos_transferidos: '10'
		}
	])
	assert.deepEqual(
		serie.map((ponto) => ponto.ano),
		[2021, 2022, 2023, 2024]
	)
	assert.deepEqual(
		serie.map((ponto) => ponto.taxas.evasao_curso),
		[null, 0.1, 0.24, null]
	)
	assert.deepEqual(
		serie.map((ponto) => ponto.taxas.evasao_ies),
		[null, 0.09, 0.19, null]
	)
	for (const ponto of [serie[0]!, serie[3]!]) {
		assert.ok(Object.values(ponto.totais).every((valor) => valor === null))
		assert.equal(ponto.base_risco, null)
		assert.equal(ponto.qualidade.sem_dados, true)
		assert.equal(ponto.qualidade.registros_com_alunos, 0)
		assert.equal(ponto.qualidade.flag_grupo_pequeno, null)
	}
})

test('série preserva ruído, base não positiva e medidas parciais por ano', () => {
	const serie = montarSerie({ ano_inicial: 2022, ano_final: 2024 }, [
		{ ...registro, ano: 2022, vinculos_total: '-1', flag_valor_negativo: true },
		{
			...registro,
			vinculos_total: '20.5',
			alunos_desvinculados: '-2.5',
			alunos_transferidos: '3.25',
			flag_valor_negativo: true
		},
		{
			...registro,
			ano: 2024,
			alunos_desvinculados: null,
			dados_incompletos: true
		}
	])
	assert.equal(serie[0]!.base_risco, -1)
	assert.equal(serie[0]!.taxas.evasao_curso, null)
	assert.equal(serie[1]!.totais.alunos_desvinculados, -2.5)
	assert.equal(serie[1]!.taxas.evasao_curso, 0.75 / 20.5)
	assert.equal(serie[1]!.qualidade.flag_grupo_pequeno, true)
	assert.equal(serie[2]!.taxas.evasao_curso, null)
	assert.equal(serie[2]!.qualidade.dados_incompletos, true)
})
