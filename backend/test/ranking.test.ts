import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildApp } from '../src/app.js'
import { consultaRanking } from '../src/modules/analises/consultas.js'
import {
	montarRanking,
	type AgregadoCategoria,
	type FiltrosRanking
} from '../src/modules/analises/ranking.js'

// vínculos, desvinculados e transferidos de cada grupo.
function grupo(
	valor: string | null,
	vinculos: string | null,
	desvinculados: string | null,
	transferidos: string | null = '0'
): AgregadoCategoria {
	return {
		grupo_valor: valor,
		grupo_nome: valor && `Grupo ${valor}`,
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

const resumo = (resultado: ReturnType<typeof montarRanking>) =>
	resultado.grupos.map((g) => [g.grupo.valor, g.posicao, g.empate, g.situacao])

test('ordena da maior para a menor taxa, com posições por competição', () => {
	const resultado = montarRanking(
		[
			grupo('01', '100', '10'), // 0,10
			grupo('02', '100', '30'), // 0,30
			grupo('03', '200', '40'), // 0,20
			grupo('04', '100', '20'), // 0,20, empata com o 03
			grupo('05', '1000', '50') // 0,05
		],
		'evasao_ies'
	)
	assert.deepEqual(resumo(resultado), [
		['02', 1, false, 'classificado'],
		['03', 2, true, 'classificado'],
		['04', 2, true, 'classificado'],
		['01', 4, false, 'classificado'],
		['05', 5, false, 'classificado']
	])
	assert.equal(resultado.classificados, 5)
	assert.equal(resultado.base_minima, 30)
})

test('empate considera taxas iguais até o arredondamento de ponto flutuante', () => {
	// 9,000000000000002 / 30 difere de 30 / 100 no último bit; é a mesma taxa.
	const resultado = montarRanking(
		[grupo('02', '100', '30'), grupo('01', '30', '9.000000000000002')],
		'evasao_curso'
	)
	assert.notEqual(
		resultado.grupos[0]!.taxas.evasao_curso,
		resultado.grupos[1]!.taxas.evasao_curso
	)
	assert.deepEqual(
		resultado.grupos.map((g) => [g.grupo.valor, g.posicao, g.empate]),
		[
			['01', 1, true],
			['02', 1, true]
		]
	)
})

test('base pequena, sem taxa e sem identificador aparecem sem posição', () => {
	const resultado = montarRanking(
		[
			grupo(null, '500', '100'), // sem identificador, mesmo com base grande
			grupo('09', null, null), // só docentes
			grupo('08', '30', null), // medida ausente
			grupo('07', '0', '1'), // base zero
			grupo('06', '29', '29'), // taxa 1,0, mas base pequena
			grupo('05', '30', '3'), // base no limite: classificado
			grupo('04', '20', '1') // base pequena
		],
		'evasao_ies'
	)
	assert.deepEqual(resumo(resultado), [
		['05', 1, false, 'classificado'],
		['04', null, false, 'base_pequena'],
		['06', null, false, 'base_pequena'],
		['07', null, false, 'sem_taxa'],
		['08', null, false, 'sem_taxa'],
		['09', null, false, 'sem_taxa'],
		[null, null, false, 'sem_identificador']
	])
	assert.equal(resultado.classificados, 1)
	// Os dados do grupo continuam disponíveis, inclusive a taxa da base pequena.
	assert.equal(resultado.grupos[2]!.taxas.evasao_ies, 1)
})

test('a taxa escolhida muda a ordem', () => {
	const grupos = [
		grupo('01', '100', '10', '20'), // curso 0,30; IES 0,10
		grupo('02', '100', '20', '0') // curso 0,20; IES 0,20
	]
	assert.deepEqual(
		montarRanking(grupos, 'evasao_curso').grupos.map((g) => g.grupo.valor),
		['01', '02']
	)
	assert.deepEqual(
		montarRanking(grupos, 'evasao_ies').grupos.map((g) => g.grupo.valor),
		['02', '01']
	)
})

test('recorte sem grupos devolve lista vazia', () => {
	assert.deepEqual(montarRanking([], 'evasao_curso'), {
		base_minima: 30,
		classificados: 0,
		grupos: []
	})
})

test('SQL do ranking usa só identificadores internos e não limita categorias', () => {
	const { text, values } = consultaRanking({
		ano: 2023,
		dimensao: 'modalidade',
		taxa: 'evasao_curso',
		codigo_area_geral: "01'; DROP"
	})
	assert.deepEqual(values, [2023, "01'; DROP"])
	assert.ok(!text.includes('DROP'))
	assert.match(text, /GROUP BY o\.modalidade_ensino/)
	assert.doesNotMatch(text, /LIMIT/)
	assert.throws(() =>
		consultaRanking({
			ano: 2023,
			dimensao: 'curso' as never,
			taxa: 'evasao_curso'
		})
	)
})

async function servidor(
	ranking: (filtros: FiltrosRanking) => Promise<AgregadoCategoria[]>
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
				perfil: unused,
				coorte: unused,
				ranking
			}
		},
		{ docs: true }
	)
}

test('rota valida dimensão e taxa antes do banco e responde o contrato', async (t) => {
	const recebidos: FiltrosRanking[] = []
	const app = await servidor(async (filtros) => {
		// request.query não tem protótipo; a cópia permite comparar o conteúdo.
		recebidos.push({ ...filtros })
		return [grupo('01', '100', '10'), grupo('02', '100', '30')]
	})
	t.after(() => app.close())
	for (const query of [
		'ano=2023',
		'dimensao=area_geral',
		'ano=2023&dimensao=curso',
		'ano=2023&dimensao=__proto__',
		'ano=2023&dimensao=area_geral&taxa=outra',
		'ano=2023&dimensao=area_geral&limite=5',
		'ano=2023&dimensao=area_geral&dimensao=modalidade'
	]) {
		const response = await app.inject(`/api/v1/analises/ranking?${query}`)
		assert.equal(response.statusCode, 400, query)
	}
	assert.equal(recebidos.length, 0)
	const response = await app.inject(
		'/api/v1/analises/ranking?ano=2023&dimensao=area_geral&modalidade=Presencial'
	)
	assert.equal(response.statusCode, 200, response.body)
	// Taxa padrão: evasão do curso.
	assert.deepEqual(recebidos, [
		{
			ano: 2023,
			dimensao: 'area_geral',
			taxa: 'evasao_curso',
			modalidade: 'Presencial'
		}
	])
	const corpo = response.json()
	assert.equal(corpo.filtros.taxa, 'evasao_curso')
	assert.deepEqual(
		corpo.grupos.map((g: { grupo: { valor: string }; posicao: number }) => [
			g.grupo.valor,
			g.posicao
		]),
		[
			['02', 1],
			['01', 2]
		]
	)
	const swagger = (await app.inject('/docs/json')).json()
	assert.ok(swagger.paths['/api/v1/analises/ranking'].get)
})
