import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildApp } from '../src/app.js'
import { consultaCoorte } from '../src/modules/analises/consultas.js'
import {
	montarCoorte,
	type AnoCoorte,
	type FiltrosCoorte
} from '../src/modules/analises/coorte.js'

// Medidas de um ano da turma: vínculos, cursando, trancados, desvinculados,
// transferidos, concluintes e falecidos.
function ano(
	valor: number,
	medidas: (number | null)[] | null,
	extra: Partial<AnoCoorte> = {}
): AnoCoorte {
	const [v, c, tr, d, t, co, f] = (medidas ?? Array(7).fill(null)).map((m) =>
		m === null ? null : String(m)
	)
	return {
		ano: valor,
		vinculos_total: v ?? null,
		alunos_cursando: c ?? null,
		alunos_matricula_trancada: tr ?? null,
		alunos_desvinculados: d ?? null,
		alunos_transferidos: t ?? null,
		concluintes_total: co ?? null,
		alunos_falecidos: f ?? null,
		cursos_iniciais: 1,
		cursos_iniciais_ausentes: medidas ? 0 : 1,
		registros: medidas ? 1 : 0,
		registros_fora_da_turma: 0,
		vinculos_fora_da_turma: null,
		flag_valor_negativo: false,
		dados_incompletos: false,
		...extra
	}
}

test('acumula saídas e conclusões sobre o tamanho inicial e mostra o resíduo', () => {
	const coorte = montarCoorte(
		[
			ano(2022, [100, 90, 2, 6, 2, 0, 0]),
			ano(2023, [88, 70, 3, 8, -1, 8, 0], {
				flag_valor_negativo: true,
				registros_fora_da_turma: 1,
				vinculos_fora_da_turma: '15'
			})
		],
		2022
	)
	assert.equal(coorte.tamanho_inicial, 100)
	assert.deepEqual(
		coorte.serie.map((p) => [p.ano, p.anos_desde_ingresso, p.taxas]),
		[
			[
				2022,
				0,
				{
					evadiu: 0.08,
					evadiu_ies: 0.06,
					concluiu: 0,
					continua: 0.92,
					residuo: 0
				}
			],
			[
				2023,
				1,
				{
					evadiu: 0.15,
					evadiu_ies: 0.14,
					concluiu: 0.08,
					continua: 0.73,
					residuo: 0.04
				}
			]
		]
	)
	assert.equal(coorte.serie[1]!.qualidade.vinculos_fora_da_turma, 15)
	assert.equal(coorte.serie[1]!.qualidade.flag_valor_negativo, true)
})

test('ano sem linhas da turma interrompe os acumulados dali em diante', () => {
	const coorte = montarCoorte(
		[
			ano(2022, [100, 90, 2, 6, 2, 0, 0]),
			ano(2023, null),
			ano(2024, [80, 70, 0, 5, 0, 5, 0])
		],
		2022
	)
	assert.deepEqual(
		coorte.serie.map((p) => [p.qualidade.sem_dados, p.taxas.evadiu]),
		[
			[false, 0.08],
			[true, null],
			[false, null]
		]
	)
	// Continua no curso não depende do acumulado.
	assert.equal(coorte.serie[2]!.taxas.continua, 0.7)
})

test('sem linha inicial, tamanho não positivo ou turma pequena', () => {
	assert.deepEqual(montarCoorte([ano(2023, [10, 10, 0, 0, 0, 0, 0])], 2022), {
		tamanho_inicial: null,
		base_minima: 30,
		cursos_iniciais: 0,
		serie: []
	})
	assert.equal(
		montarCoorte([ano(2022, [0, 0, 0, 0, 0, 0, 0])], 2022).serie.length,
		0
	)
	const pequena = montarCoorte([ano(2022, [20, 18, 0, 2, 0, 0, 0])], 2022)
	assert.equal(pequena.serie[0]!.qualidade.flag_grupo_pequeno, true)
	// Medida ausente: taxa dependente fica null, sem virar zero.
	const incompleta = montarCoorte(
		[ano(2022, [100, 90, 2, null, 2, 0, 0], { dados_incompletos: true })],
		2022
	)
	assert.equal(incompleta.serie[0]!.taxas.evadiu, null)
	assert.equal(incompleta.serie[0]!.taxas.concluiu, 0)
})

test('SQL da turma parametriza ano de ingresso e filtros e separa cursos sem linha inicial', () => {
	const { text, values } = consultaCoorte({
		ano_ingresso: 2019,
		codigo_area_geral: "01'; DROP"
	})
	assert.deepEqual(values, [2019, "01'; DROP"])
	assert.ok(!text.includes('DROP'))
	assert.match(text, /ti\.ano_censo = \$1 AND a\.codigo_area_geral = \$2/)
	assert.match(text, /FROM gold\.fato_evasao_coorte f/)
	assert.match(text, /AS da_turma/)
	assert.doesNotMatch(text, /ingressantes_total/)
})

async function servidor(
	coorte: (filtros: FiltrosCoorte) => Promise<AnoCoorte[]>
) {
	const unused = async (): Promise<never> => {
		throw new Error('Dependência inesperada')
	}
	return buildApp(
		{
			health: unused,
			indicadores: { resumo: unused },
			catalogos: { filtros: unused },
			analises: {
				evolucao: unused,
				comparacao: unused,
				dispersao: unused,
				ranking: unused,
				perfil: unused,
				coorte
			}
		},
		{ docs: true }
	)
}

test('rota valida o ano de ingresso antes do banco e responde o contrato', async (t) => {
	const recebidos: FiltrosCoorte[] = []
	const app = await servidor(async (filtros) => {
		recebidos.push({ ...filtros })
		return [ano(2022, [100, 90, 2, 6, 2, 0, 0])]
	})
	t.after(() => app.close())
	for (const query of [
		'',
		'ano=2022',
		'ano_ingresso=abc',
		'ano_ingresso=2022&ano_ingresso=2023',
		'ano_ingresso=2022&fator=sexo'
	]) {
		const response = await app.inject(`/api/v1/analises/coorte?${query}`)
		assert.equal(response.statusCode, 400, query)
	}
	assert.equal(recebidos.length, 0)
	const response = await app.inject(
		'/api/v1/analises/coorte?ano_ingresso=2022&modalidade=Presencial'
	)
	assert.equal(response.statusCode, 200, response.body)
	assert.deepEqual(recebidos, [
		{ ano_ingresso: 2022, modalidade: 'Presencial' }
	])
	const corpo = response.json()
	assert.equal(corpo.tamanho_inicial, 100)
	assert.equal(corpo.serie[0].taxas.evadiu, 0.08)
	const swagger = (await app.inject('/docs/json')).json()
	assert.ok(swagger.paths['/api/v1/analises/coorte'].get)
})
