import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
	calcularResumo,
	medidas,
	type Agregado
} from '../src/modules/indicadores/calculos.js'

function agregado(changes: Partial<Agregado> = {}): Agregado {
	return {
		vinculos_total: '1000',
		ingressantes_total: '100',
		matriculas_total: '700',
		concluintes_total: '200',
		alunos_cursando: '500',
		alunos_desvinculados: '100',
		alunos_transferidos: '50',
		alunos_matricula_trancada: '150',
		alunos_falecidos: '0',
		registros_com_alunos: 2,
		registros_sem_alunos: 0,
		flag_valor_negativo: false,
		dados_incompletos: false,
		...changes
	}
}

test('calcula as taxas sobre os totais e exclui falecidos da base', () => {
	const resumo = calcularResumo(agregado({ alunos_falecidos: '20' }))
	assert.equal(resumo.base_risco, 980)
	assert.equal(resumo.taxas.evasao_curso, 150 / 980)
	assert.equal(resumo.taxas.evasao_ies, 100 / 980)
})

test('preserva decimais, negativos e taxas fora de [0, 1]', () => {
	const resumo = calcularResumo(
		agregado({
			vinculos_total: '10.5',
			alunos_desvinculados: '-2.5',
			alunos_transferidos: '20',
			flag_valor_negativo: true
		})
	)
	assert.equal(resumo.totais.alunos_desvinculados, -2.5)
	assert.equal(resumo.taxas.evasao_curso, 17.5 / 10.5)
	assert.equal(resumo.taxas.evasao_ies, -2.5 / 10.5)
	assert.equal(resumo.qualidade.flag_valor_negativo, true)
})

for (const base of ['0', '-1', null]) {
	test(`retorna taxas nulas para base ${base}`, () => {
		const resumo = calcularResumo(agregado({ vinculos_total: base }))
		assert.deepEqual(resumo.taxas, { evasao_curso: null, evasao_ies: null })
	})
}

test('não substitui transferidos ausentes por zero', () => {
	const resumo = calcularResumo(agregado({ alunos_transferidos: null }))
	assert.equal(resumo.taxas.evasao_curso, null)
	assert.equal(resumo.taxas.evasao_ies, 0.1)
})

test('recalcula grupo pequeno pela base agregada, com limite estrito de 30', () => {
	assert.equal(
		calcularResumo(agregado({ vinculos_total: '29.9' })).qualidade
			.flag_grupo_pequeno,
		true
	)
	assert.equal(
		calcularResumo(agregado({ vinculos_total: '30' })).qualidade
			.flag_grupo_pequeno,
		false
	)
})

test('sem dados de alunos não é zero, mesmo havendo docentes', () => {
	const valoresNulos = Object.fromEntries(medidas.map((m) => [m, null]))
	const resumo = calcularResumo(
		agregado({
			...valoresNulos,
			registros_com_alunos: 0,
			registros_sem_alunos: 1
		})
	)
	assert.deepEqual(resumo.totais, valoresNulos)
	assert.equal(resumo.base_risco, null)
	assert.equal(resumo.qualidade.sem_dados, true)
	assert.equal(resumo.qualidade.flag_grupo_pequeno, null)
})

test('recusa números não finitos para não serializar resultados enganosos', () => {
	assert.throws(() => calcularResumo(agregado({ vinculos_total: 'NaN' })))
})
