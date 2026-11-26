import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Catalogo } from '../src/modules/catalogos/api.ts'
import type { GrupoRanking } from '../src/modules/analises/api.ts'
import {
	categoriasSemRegistro,
	larguraBarra,
	lerTaxaRanking,
	motivosSemPosicao,
	rotuloCategoria,
	rotuloPosicao,
	serializarRanking
} from '../src/modules/analises/ranking.ts'
import { csvRanking } from '../src/modules/analises/exportacao.ts'
import { limparFiltros } from '../src/modules/indicadores/filtros.ts'

function grupo(
	valor: string | null,
	taxa: number | null,
	posicao: number | null,
	situacao: GrupoRanking['situacao'] = 'classificado',
	empate = false
): GrupoRanking {
	return {
		grupo: { valor, nome: valor && `Nome ${valor}` },
		totais: {
			vinculos_total: 100,
			matriculas_total: 70,
			ingressantes_total: null,
			concluintes_total: 20
		},
		base_risco: 100,
		taxas: { evasao_curso: taxa, evasao_ies: taxa },
		qualidade: {
			sem_dados: false,
			registros_com_alunos: 1,
			registros_sem_alunos: 0,
			registros_sem_ingressantes: 0,
			ingressantes_minimo: false,
			dados_incompletos: false,
			flag_valor_negativo: false,
			flag_grupo_pequeno: false
		},
		situacao,
		posicao,
		empate
	}
}

test('cada ranking omite o filtro da própria dimensão e mantém os demais', () => {
	const selecao = {
		...limparFiltros('2023'),
		codigo_area_geral: '01',
		modalidade: 'Presencial'
	}
	assert.equal(
		serializarRanking(selecao, 'area_geral', 'evasao_curso'),
		'ano=2023&modalidade=Presencial&dimensao=area_geral&taxa=evasao_curso'
	)
	assert.equal(
		serializarRanking(selecao, 'modalidade', 'evasao_ies'),
		'ano=2023&codigo_area_geral=01&dimensao=modalidade&taxa=evasao_ies'
	)
})

test('posição mostra empate e, fora da classificação, um traço com o motivo à parte', () => {
	assert.equal(rotuloPosicao(grupo('01', 0.3, 1)), '1º')
	assert.equal(
		rotuloPosicao(grupo('02', 0.2, 2, 'classificado', true)),
		'2º (empate)'
	)
	for (const situacao of [
		'base_pequena',
		'sem_taxa',
		'sem_identificador'
	] as const) {
		assert.equal(rotuloPosicao(grupo('03', 0.9, null, situacao)), '—')
		assert.match(motivosSemPosicao[situacao], /^Sem posição: /)
	}
	assert.equal(motivosSemPosicao.classificado, '')
})

test('categorias do catálogo sem registros são listadas, sem inventar valores', () => {
	const catalogo = {
		areas_gerais: [
			{ codigo: '01', nome: 'Educação' },
			{ codigo: '06', nome: 'Computação' },
			{ codigo: '09', nome: 'Saúde' }
		],
		modalidades: ['A distância', 'Presencial']
	} as Catalogo
	assert.deepEqual(
		categoriasSemRegistro(catalogo, 'area_geral', [grupo('06', 0.2, 1)]),
		['Educação (01)', 'Saúde (09)']
	)
	assert.deepEqual(
		categoriasSemRegistro(catalogo, 'modalidade', [
			grupo('Presencial', 0.1, 1),
			grupo('A distância', 0.2, 2)
		]),
		[]
	)
	assert.deepEqual(categoriasSemRegistro(null, 'area_geral', []), [])
})

test('barra é proporcional à maior taxa e some fora da classificação', () => {
	assert.equal(larguraBarra(grupo('01', 0.2, 1), 'evasao_curso', 0.4), 50)
	assert.equal(larguraBarra(grupo('02', -0.1, 3), 'evasao_curso', 0.4), 0)
	assert.equal(
		larguraBarra(grupo('03', 0.9, null, 'base_pequena'), 'evasao_curso', 0.4),
		0
	)
	assert.equal(larguraBarra(grupo('04', 0.2, 1), 'evasao_curso', 0), 0)
})

test('taxa do ranking vem da URL e aceita só as duas taxas', () => {
	assert.equal(lerTaxaRanking(new URLSearchParams('')), 'evasao_curso')
	assert.equal(
		lerTaxaRanking(new URLSearchParams('taxa_ranking=evasao_ies')),
		'evasao_ies'
	)
	assert.equal(
		lerTaxaRanking(new URLSearchParams('taxa_ranking=x')),
		'evasao_curso'
	)
})

test('rótulo da categoria usa nome e código sem inventar nome', () => {
	assert.equal(
		rotuloCategoria({ valor: '01', nome: 'Educação' }),
		'Educação (01)'
	)
	assert.equal(
		rotuloCategoria({ valor: 'Presencial', nome: 'Presencial' }),
		'Presencial'
	)
	assert.equal(
		rotuloCategoria({ valor: null, nome: null }),
		'Não informado (sem identificador)'
	)
})

test('CSV do ranking traz posição, empate e situação antes das medidas', () => {
	const [cabecalho, primeira, segunda] = csvRanking(
		[
			grupo('01', 0.3, 1, 'classificado', true),
			grupo('09', null, null, 'sem_taxa')
		],
		'ano=2023'
	).split('\r\n')
	assert.ok(
		cabecalho?.startsWith('Posição;Empate;Situação;Código;Nome;Vínculos')
	)
	assert.ok(primeira?.startsWith('1;sim;classificado;01;Nome 01;100;'))
	assert.ok(segunda?.startsWith(';não;sem taxa;09;Nome 09;100;'))
})
