import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
	alternarFiltroGrupo,
	alternarGrupo,
	dimensoesComparacao,
	grupoEmDestaque,
	gruposAusentes,
	opcoesComparacao,
	rotuloGrupo,
	serializarComparacao
} from '../src/modules/analises/comparacoes.ts'
import { limparFiltros } from '../src/modules/indicadores/filtros.ts'
import type { Catalogo } from '../src/modules/catalogos/api.ts'

const catalogo: Catalogo = {
	anos: [2023],
	cursos: [
		{ codigo: '001', nome: 'Pedagogia' },
		{ codigo: '002', nome: null }
	],
	areas_gerais: [{ codigo: '01', nome: 'Educação' }],
	municipios_oferta: [{ codigo: '5103403', nome: 'Cuiabá' }],
	municipios_sede: [{ codigo: '5108402', nome: 'Várzea Grande' }],
	modalidades: ['A distância'],
	categorias_administrativas: ['Pública Federal'],
	organizacoes_academicas: ['Universidade']
}

test('serializa ano, filtros e grupos sem perder zeros; omite só o filtro da dimensão agrupada', () => {
	const selecao = {
		...limparFiltros('2023'),
		codigo_curso: '001',
		codigo_area_geral: '01',
		codigo_municipio_oferta: '5103403',
		codigo_municipio_sede: '5108402',
		modalidade: 'A distância',
		categoria_administrativa: 'Pública Federal',
		organizacao_academica: 'Universidade'
	}
	const query = new URLSearchParams(
		serializarComparacao(
			{ agrupar_por: 'curso', grupos: ['001', '002'] },
			selecao
		)
	)
	for (const [campo, valor] of Object.entries(selecao))
		assert.equal(query.get(campo), campo === 'codigo_curso' ? null : valor)
	assert.deepEqual(query.getAll('grupos'), ['001', '002'])
	assert.equal(query.get('limite'), '20')
	assert.equal(query.get('agrupar_por'), 'curso')
	assert.equal(
		new URLSearchParams(
			serializarComparacao(
				{ agrupar_por: 'modalidade', grupos: ['A distância'] },
				selecao
			)
		).get('grupos'),
		'A distância'
	)
})

test('seleção vazia consulta todos os grupos limitados; filtros vazios são omitidos', () => {
	const query = new URLSearchParams(
		serializarComparacao(
			{ agrupar_por: 'curso', grupos: [] },
			limparFiltros('2024')
		)
	)
	assert.deepEqual(
		[...query],
		[
			['ano', '2024'],
			['agrupar_por', 'curso'],
			['limite', '20']
		]
	)
})

test('sete dimensões usam o catálogo correto, distinguindo oferta e sede', () => {
	for (const dimensao of Object.keys(
		dimensoesComparacao
	) as (keyof typeof dimensoesComparacao)[]) {
		assert.ok(opcoesComparacao(catalogo, dimensao).length)
		assert.deepEqual(opcoesComparacao(null, dimensao), [])
	}
	assert.deepEqual(opcoesComparacao(catalogo, 'curso'), [
		{ valor: '001', rotulo: 'Pedagogia (001)' },
		{ valor: '002', rotulo: '002' }
	])
	assert.equal(
		opcoesComparacao(catalogo, 'municipio_oferta')[0]?.valor,
		'5103403'
	)
	assert.equal(
		opcoesComparacao(catalogo, 'municipio_sede')[0]?.valor,
		'5108402'
	)
	assert.deepEqual(opcoesComparacao(catalogo, 'modalidade'), [
		{ valor: 'A distância', rotulo: 'A distância' }
	])
})

test('limita a seleção a 20 grupos, permite desmarcar e preserva a entrada', () => {
	const grupos = Array.from({ length: 20 }, (_, i) =>
		String(i).padStart(3, '0')
	)
	assert.deepEqual(alternarGrupo(grupos, '021'), grupos)
	const removidos = alternarGrupo(grupos, '001')
	assert.equal(removidos.length, 19)
	assert.equal(alternarGrupo(removidos, '021').length, 20)
	assert.equal(grupos.length, 20)
	assert.deepEqual(alternarGrupo([], '001'), ['001'])
})

test('identifica seleções sem correspondência sem criar grupos com zero', () => {
	assert.deepEqual(
		gruposAusentes(
			['001', '002', '003'],
			[{ grupo: { valor: '001' } }, { grupo: { valor: null } }]
		),
		['002', '003']
	)
	assert.deepEqual(gruposAusentes([], []), [])
	assert.deepEqual(gruposAusentes(['001'], []), ['001'])
})

test('rótulos preservam código sem nome e distinguem identificador nulo do texto Não informado', () => {
	assert.equal(rotuloGrupo({ valor: '001', nome: null }), '001')
	assert.equal(
		rotuloGrupo({ valor: null, nome: null }),
		'Não informado (sem identificador)'
	)
	assert.equal(
		rotuloGrupo({ valor: 'Não informado', nome: 'Não informado' }),
		'Não informado'
	)
})

test('filtro da dimensão agrupada destaca o grupo sem restringir a comparação', () => {
	const selecao = { ...limparFiltros('2023'), modalidade: 'Presencial' }
	const porModalidade = new URLSearchParams(
		serializarComparacao({ agrupar_por: 'modalidade', grupos: [] }, selecao)
	)
	assert.equal(porModalidade.get('modalidade'), null)
	assert.equal(grupoEmDestaque('modalidade', selecao), 'Presencial')
	const porCurso = new URLSearchParams(
		serializarComparacao({ agrupar_por: 'curso', grupos: [] }, selecao)
	)
	assert.equal(porCurso.get('modalidade'), 'Presencial')
	assert.equal(grupoEmDestaque('curso', selecao), '')
})

test('clique no grupo aplica o filtro, repetir remove e grupo sem identificador não filtra', () => {
	const inicial = limparFiltros('2023')
	const comCurso = alternarFiltroGrupo(inicial, 'curso', '001')
	assert.equal(comCurso.codigo_curso, '001')
	assert.equal(comCurso.ano, '2023')
	assert.equal(
		alternarFiltroGrupo(comCurso, 'curso', '002').codigo_curso,
		'002'
	)
	assert.deepEqual(alternarFiltroGrupo(comCurso, 'curso', '001'), inicial)
	assert.equal(alternarFiltroGrupo(inicial, 'area_geral', null), inicial)
	assert.equal(
		alternarFiltroGrupo(inicial, 'municipio_sede', '5108402')
			.codigo_municipio_sede,
		'5108402'
	)
})
