import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildApp } from '../src/app.js'
import { consultaComparacao } from '../src/modules/analises/consultas.js'
import {
	MAX_GRUPOS,
	type AgregadoGrupo,
	type FiltrosComparacao
} from '../src/modules/analises/comparacoes.js'

const base = '/api/v1/analises/comparacoes'
const registro: AgregadoGrupo = {
	grupo_valor: '001',
	grupo_nome: 'Pedagogia',
	total_grupos: 3,
	vinculos_total: '1000',
	ingressantes_total: '120',
	concluintes_total: '120',
	alunos_cursando: '550',
	alunos_desvinculados: '190',
	alunos_transferidos: '50',
	alunos_matricula_trancada: '90',
	alunos_falecidos: '0',
	registros_com_alunos: 2,
	registros_sem_alunos: 0,
	registros_sem_ingressantes: 0,
	flag_valor_negativo: false,
	dados_incompletos: false
}

async function servidor(
	comparacao: (filtros: FiltrosComparacao) => Promise<AgregadoGrupo[]>,
	docs = false
) {
	const unused = async (): Promise<never> => {
		throw new Error('Dependência inesperada')
	}
	return buildApp(
		{
			health: unused,
			indicadores: { resumo: unused },
			catalogos: { filtros: unused },
			analises: { evolucao: unused, comparacao, dispersao: unused }
		},
		{ docs }
	)
}

test('comparações rejeitam dimensão, limites, filtros e seleções inválidos antes do banco', async (t) => {
	let chamadas = 0
	const app = await servidor(async () => {
		chamadas++
		return []
	})
	t.after(() => app.close())
	const padrao = 'ano=2023&agrupar_por=curso'
	for (const query of [
		'',
		'ano=2023',
		'agrupar_por=curso',
		'ano=x&agrupar_por=curso',
		'ano=1899&agrupar_por=curso',
		'ano=2023.5&agrupar_por=curso',
		'ano=2023&agrupar_por=ies',
		'ano=2023&agrupar_por=__proto__',
		'ano=2023&agrupar_por=constructor',
		'ano=2023&agrupar_por=curso;DROP',
		`${padrao}&agrupar_por=modalidade`,
		`${padrao}&ano=2024`,
		`${padrao}&limite=0`,
		`${padrao}&limite=21`,
		`${padrao}&limite=2.5`,
		`${padrao}&limite=2&limite=3`,
		`${padrao}&grupos=`,
		`${padrao}&grupos=abc`,
		`${padrao}&grupos=001,002`,
		`${padrao}&grupos=001&grupos=001`,
		`${padrao}&${Array.from({ length: MAX_GRUPOS + 1 }, (_, i) => `grupos=${i}`).join('&')}`,
		`${padrao}&grupos=${'1'.repeat(33)}`,
		'ano=2023&agrupar_por=modalidade&grupos=%20',
		'ano=2023&agrupar_por=modalidade&grupos=' + 'x'.repeat(201),
		`${padrao}&codigo_curso=abc`,
		`${padrao}&codigo_curso=001&codigo_curso=002`,
		`${padrao}&modalidade=%20`,
		`${padrao}&ordem=taxa`,
		`${padrao}&ano_final=2024`
	]) {
		const resposta = await app.inject(`${base}?${query}`)
		assert.equal(resposta.statusCode, 400, query)
		assert.equal(resposta.json().erro, 'PARAMETROS_INVALIDOS')
	}
	assert.equal(chamadas, 0)
})

test('comparações públicas normalizam seleção única, preservam códigos e documentam truncamento', async (t) => {
	const chamadas: FiltrosComparacao[] = []
	const app = await servidor(async (filtros) => {
		chamadas.push(filtros)
		return [registro]
	}, true)
	t.after(() => app.close())
	const filtros = {
		ano: '2023',
		agrupar_por: 'curso',
		limite: '1',
		codigo_curso: '001',
		codigo_area_geral: '01',
		codigo_municipio_oferta: '5103403',
		codigo_municipio_sede: '5102504',
		modalidade: 'Presencial',
		categoria_administrativa: 'Pública Federal',
		organizacao_academica: 'Universidade'
	}
	const res = await app.inject(
		`${base}?${new URLSearchParams(filtros)}&grupos=001&grupos=002`
	)
	assert.equal(res.statusCode, 200, res.body)
	assert.deepEqual(
		{ ...chamadas[0] },
		{ ...filtros, ano: 2023, limite: 1, grupos: ['001', '002'] }
	)
	assert.deepEqual(res.json().filtros, { ...chamadas[0] })
	assert.equal(res.json().total_grupos, 3)
	assert.equal(res.json().truncado, true)
	assert.deepEqual(res.json().grupos[0].grupo, {
		valor: '001',
		nome: 'Pedagogia'
	})
	assert.equal(res.json().grupos[0].taxas.evasao_curso, 0.24)
	assert.ok(!('total_grupos' in res.json().grupos[0]))
	const unico = await app.inject(
		`${base}?ano=2023&agrupar_por=curso&grupos=001`
	)
	assert.equal(unico.statusCode, 200)
	assert.deepEqual(chamadas[1]?.grupos, ['001'])
	assert.equal(chamadas[1]?.limite, MAX_GRUPOS)
	const swagger = (await app.inject('/docs/json')).json()
	const rota = swagger.paths[base].get
	assert.ok(rota.responses['200'])
	assert.ok(rota.responses['429'])
	assert.ok(rota.parameters.some((p: { name: string }) => p.name === 'grupos'))
	assert.equal(rota.security, undefined)
})

test('comparação sem grupos retorna lista vazia e falha de banco retorna 503 controlado', async (t) => {
	let falhar = false
	const app = await servidor(async () => {
		if (falhar) throw new Error('password=segredo SQL privado')
		return []
	})
	t.after(() => app.close())
	const res = await app.inject(`${base}?ano=1999&agrupar_por=area_geral`)
	assert.equal(res.statusCode, 200)
	assert.deepEqual(res.json(), {
		filtros: { ano: 1999, agrupar_por: 'area_geral', limite: MAX_GRUPOS },
		total_grupos: 0,
		truncado: false,
		grupos: []
	})
	falhar = true
	const erro = await app.inject(`${base}?ano=2023&agrupar_por=modalidade`)
	assert.equal(erro.statusCode, 503)
	assert.equal(erro.json().erro, 'GOLD_INDISPONIVEL')
	assert.ok(!erro.body.includes('segredo'))
})

test('SQL parametriza filtros, seleção e limite, e usa apenas agrupamentos da lista interna', () => {
	const malicioso = "x' OR TRUE --"
	const query = consultaComparacao({
		ano: 2023,
		agrupar_por: 'modalidade',
		limite: 5,
		grupos: [malicioso, 'Presencial'],
		codigo_curso: '001',
		codigo_area_geral: '01',
		codigo_municipio_oferta: '5103403',
		modalidade: malicioso,
		categoria_administrativa: 'Pública Federal',
		organizacao_academica: 'Universidade',
		codigo_municipio_sede: '5102504'
	})
	assert.deepEqual(query.values, [
		2023,
		'001',
		'01',
		'5103403',
		malicioso,
		'Pública Federal',
		'Universidade',
		'5102504',
		[malicioso, 'Presencial'],
		5
	])
	assert.ok(!query.text.includes(malicioso))
	assert.match(query.text, /GROUP BY o.modalidade_ensino/)
	assert.match(query.text, /o.modalidade_ensino = ANY\(\$9::text\[\]\)/)
	assert.match(query.text, /LIMIT \$10/)
	assert.match(query.text, /ORDER BY grupo_valor COLLATE "C" ASC NULLS LAST/)
	assert.throws(
		() =>
			consultaComparacao({
				ano: 2023,
				limite: 20,
				agrupar_por: '__proto__' as FiltrosComparacao['agrupar_por']
			}),
		/Agrupamento inválido/
	)
})
