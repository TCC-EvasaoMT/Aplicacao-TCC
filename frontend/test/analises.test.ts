import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
	periodoInicial,
	serializarEvolucao,
	validarPeriodo
} from '../src/modules/analises/periodo.ts'
import {
	avisosDoAno,
	formatarTaxa
} from '../src/modules/analises/apresentacao.ts'
import type { PontoTemporal } from '../src/modules/analises/api.ts'
import { limparFiltros } from '../src/modules/indicadores/filtros.ts'

test('período inicial usa extremos do catálogo e limita a 30 anos inclusivos', () => {
	assert.deepEqual(periodoInicial([]), { ano_inicial: '', ano_final: '' })
	assert.deepEqual(periodoInicial([2023, 2022, 2024]), {
		ano_inicial: '2022',
		ano_final: '2024'
	})
	assert.deepEqual(periodoInicial([2024]), {
		ano_inicial: '2024',
		ano_final: '2024'
	})
	assert.deepEqual(periodoInicial([1980, 2024]), {
		ano_inicial: '1995',
		ano_final: '2024'
	})
})

test('valida intervalo inclusivo, limites, anos ausentes no catálogo e entradas inválidas', () => {
	for (const [inicio, fim] of [
		['1900', '1900'],
		['2000', '2029'],
		['9999', '9999']
	])
		assert.equal(validarPeriodo({ ano_inicial: inicio!, ano_final: fim! }), '')
	for (const [inicio, fim] of [
		['', '2024'],
		['2023.5', '2024'],
		['2e3', '2024'],
		['1899', '1900'],
		['9999', '10000'],
		['2024', '2022'],
		['2000', '2030']
	])
		assert.notEqual(
			validarPeriodo({ ano_inicial: inicio!, ano_final: fim! }),
			''
		)
})

test('consulta temporal combina sete filtros, preserva códigos e ignora o ano do resumo', () => {
	const periodo = { ano_inicial: '2022', ano_final: '2024' }
	const selecao = {
		...limparFiltros('2023'),
		codigo_curso: '001',
		codigo_area_geral: '01',
		modalidade: 'A distância',
		categoria_administrativa: 'Pública Federal',
		organizacao_academica: 'Universidade',
		codigo_municipio_oferta: '5107909',
		codigo_municipio_sede: '5103403'
	}
	const { ano: _ano, ...recorte } = selecao
	assert.deepEqual(
		Object.fromEntries(
			new URLSearchParams(serializarEvolucao(periodo, selecao))
		),
		{ ...periodo, ...recorte }
	)
	assert.equal(
		serializarEvolucao(periodo, selecao),
		serializarEvolucao(periodo, { ...selecao, ano: '2024' })
	)
	assert.equal(
		serializarEvolucao(periodo, limparFiltros()),
		'ano_inicial=2022&ano_final=2024'
	)
})

test('formatação distingue ausência e zero e preserva taxas negativas e superiores a 100%', () => {
	assert.equal(formatarTaxa(null), 'Não disponível')
	assert.equal(formatarTaxa(0), '0%')
	assert.equal(formatarTaxa(0.15), '15%')
	assert.equal(formatarTaxa(-0.125), '-12,5%')
	assert.equal(formatarTaxa(1.5), '150%')
})

test('avisos distinguem ausência, somente docentes, base zero, ruído e grupos pequenos', () => {
	const ponto: PontoTemporal = {
		ano: 2024,
		base_risco: null,
		totais: {
			vinculos_total: null,
			matriculas_total: null,
			ingressantes_total: null,
			concluintes_total: null
		},
		taxas: { evasao_curso: null, evasao_ies: null },
		qualidade: {
			sem_dados: true,
			registros_com_alunos: 0,
			registros_sem_alunos: 0,
			dados_incompletos: false,
			flag_valor_negativo: false,
			flag_grupo_pequeno: null
		}
	}
	assert.deepEqual(avisosDoAno(ponto), ['Sem dados de alunos'])
	assert.deepEqual(
		avisosDoAno({
			...ponto,
			qualidade: { ...ponto.qualidade, registros_sem_alunos: 1 }
		}),
		['Sem dados de alunos', '1 registro(s) sem contagens de alunos']
	)
	assert.deepEqual(
		avisosDoAno({
			...ponto,
			base_risco: 0,
			qualidade: {
				...ponto.qualidade,
				sem_dados: false,
				flag_grupo_pequeno: true
			}
		}),
		['Base inferior a 30', 'Base não positiva; taxas indisponíveis']
	)
	assert.deepEqual(
		avisosDoAno({
			...ponto,
			base_risco: 20.5,
			qualidade: {
				...ponto.qualidade,
				sem_dados: false,
				dados_incompletos: true,
				flag_valor_negativo: true,
				flag_grupo_pequeno: true
			}
		}),
		['Dados incompletos', 'Valores negativos na origem', 'Base inferior a 30']
	)
})
