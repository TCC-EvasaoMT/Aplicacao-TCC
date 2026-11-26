import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildApp } from '../src/app.js'
import { consultaDispersao } from '../src/modules/analises/consultas.js'
import {
	montarDispersao,
	type AgregadoCurso,
	type FiltrosDispersao
} from '../src/modules/analises/dispersao.js'

// vínculos, desvinculados, transferidos; cursando e concluintes fixos.
function curso(
	codigo: string | null,
	vinculos: string | null,
	desvinculados: string | null,
	transferidos: string | null
): AgregadoCurso {
	return {
		curso_codigo: codigo,
		curso_nome: codigo && `Curso ${codigo}`,
		vinculos_total: vinculos,
		concluintes_total: vinculos === null ? null : '1',
		alunos_cursando: vinculos === null ? null : '2',
		alunos_desvinculados: desvinculados,
		alunos_transferidos: transferidos,
		alunos_matricula_trancada: vinculos === null ? null : '0',
		alunos_falecidos: vinculos === null ? null : '0',
		ingressantes_total: null,
		registros_com_alunos: vinculos === null ? 0 : 1,
		registros_sem_alunos: vinculos === null ? 1 : 0,
		registros_sem_ingressantes: vinculos === null ? 0 : 1,
		flag_valor_negativo: false,
		dados_incompletos: desvinculados === null || transferidos === null
	}
}

test('referência soma numeradores e bases, sem média das taxas dos cursos', () => {
	const { referencias, cursos } = montarDispersao([
		curso('001', '100', '10', '5'),
		curso('002', '900', '180', '45')
	])
	// Média simples daria (0,15 + 0,25) / 2 = 0,20; a soma dá 240 / 1000.
	assert.equal(referencias.alta_evasao.evasao_curso, 0.24)
	assert.equal(referencias.alta_evasao.evasao_ies, 0.19)
	assert.deepEqual(referencias.cursos_na_referencia, {
		evasao_curso: 2,
		evasao_ies: 2
	})
	assert.equal(referencias.base_minima, 30)
	assert.deepEqual(
		cursos.map((c) => [c.curso.codigo, c.zona_critica.evasao_curso]),
		[
			['001', false],
			['002', true]
		]
	)
	assert.equal(cursos[0]!.totais.matriculas_total, 3)
})

test('cursos sem taxa ficam na lista, mas fora da referência e da zona crítica', () => {
	const { referencias, cursos } = montarDispersao([
		curso('001', '100', '10', '5'),
		curso('002', '900', '180', '45'),
		curso('003', null, null, null), // só docentes
		curso('004', '0', '1', '0'), // base zero
		curso('006', '30', null, '1') // medida ausente
	])
	assert.equal(cursos.length, 5)
	assert.equal(referencias.alta_evasao.evasao_curso, 0.24)
	assert.deepEqual(referencias.cursos_fora_da_referencia, {
		evasao_curso: 3,
		evasao_ies: 3
	})
	for (const c of cursos.slice(2))
		assert.deepEqual(c.zona_critica, { evasao_curso: false, evasao_ies: false })
})

test('contagens da referência são por taxa', () => {
	// Sem transferidos, só a evasão da IES é calculável.
	const { referencias } = montarDispersao([
		curso('001', '100', '10', '5'),
		curso('009', '100', '50', null)
	])
	assert.deepEqual(referencias.cursos_na_referencia, {
		evasao_curso: 1,
		evasao_ies: 2
	})
	assert.equal(referencias.alta_evasao.evasao_curso, 0.15)
	assert.equal(referencias.alta_evasao.evasao_ies, 60 / 200)
})

test('zona crítica exige taxa acima da referência e base de pelo menos 30', () => {
	const { referencias, cursos } = montarDispersao([
		curso('001', '1000', '100', '0'), // 0,10, define a referência
		curso('029', '29', '29', '0'), // alta evasão, base pequena
		curso('030', '30', '30', '0'), // alta evasão, base no limite
		curso('031', '1000', '0', '0') // abaixo da referência
	])
	const ref = referencias.alta_evasao.evasao_ies!
	assert.equal(ref, 159 / 2059)
	const zona = Object.fromEntries(
		cursos.map((c) => [c.curso.codigo, c.zona_critica.evasao_ies])
	)
	assert.deepEqual(zona, {
		'001': true,
		'029': false,
		'030': true,
		'031': false
	})
	// Taxa igual à referência não entra.
	const empate = montarDispersao([
		curso('001', '100', '10', '0'),
		curso('002', '100', '10', '0')
	])
	assert.equal(empate.referencias.alta_evasao.evasao_ies, 0.1)
	assert.ok(empate.cursos.every((c) => !c.zona_critica.evasao_ies))
})

test('ruído negativo é preservado e referência fica null sem cursos com taxa', () => {
	const ruido = montarDispersao([curso('005', '20.5', '-2.5', '3.25')])
	assert.equal(ruido.cursos[0]!.taxas.evasao_ies, -2.5 / 20.5)
	assert.equal(ruido.referencias.alta_evasao.evasao_ies, -2.5 / 20.5)
	const vazio = montarDispersao([])
	assert.deepEqual(vazio.referencias.alta_evasao, {
		evasao_curso: null,
		evasao_ies: null
	})
	assert.deepEqual(vazio.cursos, [])
	const semTaxa = montarDispersao([curso('003', null, null, null)])
	assert.equal(semTaxa.referencias.alta_evasao.evasao_curso, null)
	assert.equal(semTaxa.cursos.length, 1)
})

test('SQL da dispersão parametriza ano e filtros e agrupa por curso', () => {
	const { text, values } = consultaDispersao({
		ano: 2023,
		codigo_area_geral: '01',
		modalidade: "Presencial'; DROP"
	})
	assert.deepEqual(values, [2023, '01', "Presencial'; DROP"])
	assert.ok(!text.includes('DROP'))
	assert.match(text, /GROUP BY c\.codigo_curso/)
	assert.doesNotMatch(text, /LIMIT/)
})

async function servidor(
	dispersao: (filtros: FiltrosDispersao) => Promise<AgregadoCurso[]>,
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
			analises: {
				evolucao: unused,
				comparacao: unused,
				dispersao,
				ranking: unused
			}
		},
		{ docs }
	)
}

test('rota rejeita parâmetros inválidos antes do banco e responde o contrato', async (t) => {
	const recebidos: FiltrosDispersao[] = []
	const app = await servidor(async (filtros) => {
		// request.query não tem protótipo; a cópia permite comparar o conteúdo.
		recebidos.push({ ...filtros })
		return [curso('001', '100', '10', '5'), curso('002', '900', '180', '45')]
	}, true)
	t.after(() => app.close())
	for (const query of [
		'',
		'ano=x',
		'ano=1899',
		'ano=2023&ano=2024',
		'ano=2023&limite=5',
		'ano=2023&codigo_area_geral=abc',
		'ano=2023&modalidade=a&modalidade=b'
	]) {
		const response = await app.inject(`/api/v1/analises/dispersao?${query}`)
		assert.equal(response.statusCode, 400, query)
	}
	assert.equal(recebidos.length, 0)
	const response = await app.inject(
		'/api/v1/analises/dispersao?ano=2023&codigo_area_geral=01&modalidade=Presencial'
	)
	assert.equal(response.statusCode, 200, response.body)
	assert.deepEqual(recebidos, [
		{ ano: 2023, codigo_area_geral: '01', modalidade: 'Presencial' }
	])
	const corpo = response.json()
	assert.equal(corpo.filtros.codigo_area_geral, '01')
	assert.equal(corpo.referencias.alta_evasao.evasao_curso, 0.24)
	assert.deepEqual(corpo.cursos[1].curso, { codigo: '002', nome: 'Curso 002' })
	assert.equal(corpo.cursos[1].zona_critica.evasao_curso, true)
	const swagger = (await app.inject('/docs/json')).json()
	assert.ok(swagger.paths['/api/v1/analises/dispersao'].get)
})
