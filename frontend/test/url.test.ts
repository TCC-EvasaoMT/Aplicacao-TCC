import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
	lerSelecao,
	limparFiltros
} from '../src/modules/indicadores/filtros.ts'
import { lerPeriodo } from '../src/modules/analises/periodo.ts'
import { lerAba } from '../src/modules/indicadores/abas.ts'
import {
	comparacaoPadrao,
	lerComparacao
} from '../src/modules/analises/comparacoes.ts'

test('seleção da URL preserva códigos e ignora parâmetros desconhecidos', () => {
	const selecao = lerSelecao(
		new URLSearchParams(
			'ano=2023&codigo_curso=001&modalidade=A%20dist%C3%A2ncia&x=1'
		)
	)
	assert.deepEqual(selecao, {
		...limparFiltros('2023'),
		codigo_curso: '001',
		modalidade: 'A distância'
	})
	assert.deepEqual(lerSelecao(new URLSearchParams('')), limparFiltros())
})

test('período da URL só vale quando o intervalo é válido', () => {
	assert.deepEqual(
		lerPeriodo(new URLSearchParams('ano_inicial=2022&ano_final=2024')),
		{ ano_inicial: '2022', ano_final: '2024' }
	)
	for (const busca of [
		'',
		'ano_inicial=2024&ano_final=2022',
		'ano_inicial=2000&ano_final=2030',
		'ano_inicial=abc&ano_final=2024'
	])
		assert.equal(lerPeriodo(new URLSearchParams(busca)), null)
})

test('comparação da URL valida a dimensão, remove repetidos e limita a 20 grupos', () => {
	assert.deepEqual(
		lerComparacao(
			new URLSearchParams('agrupar_por=curso&grupos=001&grupos=001&grupos=002')
		),
		{ agrupar_por: 'curso', grupos: ['001', '002'] }
	)
	assert.equal(
		lerComparacao(new URLSearchParams('agrupar_por=toString')),
		comparacaoPadrao
	)
	const muitos = new URLSearchParams(
		Array.from({ length: 25 }, (_, i) => ['grupos', String(i)])
	)
	muitos.set('agrupar_por', 'modalidade')
	assert.equal(lerComparacao(muitos).grupos.length, 20)
})

test('aba da URL aceita só as abas existentes', () => {
	assert.equal(lerAba(new URLSearchParams('aba=comparacao')), 'comparacao')
	assert.equal(lerAba(new URLSearchParams('aba=evolucao')), 'evolucao')
	assert.equal(lerAba(new URLSearchParams('aba=dispersao')), 'dispersao')
	assert.equal(lerAba(new URLSearchParams('aba=outra')), 'resumo')
	assert.equal(lerAba(new URLSearchParams('')), 'resumo')
})
