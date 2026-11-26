import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildApp } from '../src/app.js'
import { consultaPerfil } from '../src/modules/analises/consultas.js'
import {
	codigosFatores,
	montarPerfil,
	type AgregadoPerfil,
	type FiltrosPerfil
} from '../src/modules/analises/perfil.js'

// vínculos, desvinculados e transferidos de uma categoria (ou do conjunto).
function linha(
	codigo: string | null,
	vinculos: string | null,
	desvinculados: string | null,
	transferidos: string | null = '0',
	conjunto = false
): AgregadoPerfil {
	return {
		conjunto,
		codigo_categoria: conjunto ? null : codigo,
		categoria: conjunto
			? null
			: codigo === null
				? 'Não informado'
				: `Categoria ${codigo}`,
		ordem_categoria: conjunto ? null : 1,
		vinculos_total: vinculos,
		concluintes_total: vinculos === null ? null : '1',
		alunos_cursando: vinculos === null ? null : '2',
		alunos_desvinculados: desvinculados,
		alunos_transferidos: transferidos,
		alunos_matricula_trancada: vinculos === null ? null : '0',
		alunos_falecidos: vinculos === null ? null : '0',
		ingressantes_total: null,
		registros_com_alunos: vinculos === null ? 0 : 1,
		registros_sem_alunos: 0,
		registros_sem_ingressantes: 0,
		flag_valor_negativo: false,
		dados_incompletos: vinculos !== null && desvinculados === null
	}
}

test('cada categoria tem as taxas do resumo, sem ingressantes, e o conjunto vem à parte', () => {
	const perfil = montarPerfil(
		[
			linha('1', '112.5', '0.5'),
			linha('0', '907.5', '193.5', '51'),
			linha('7', null, null, null),
			linha(null, '1020', '194', '51', true)
		],
		'apoio_social'
	)
	assert.deepEqual(perfil.fator, {
		codigo: 'apoio_social',
		nome: 'Recebe apoio social',
		grupo: 'Permanência'
	})
	assert.equal(perfil.base_minima, 30)
	assert.deepEqual(
		perfil.categorias.map((c) => [
			c.categoria.codigo,
			c.base_risco,
			c.taxas.evasao_curso
		]),
		[
			['1', 112.5, 0.5 / 112.5],
			['0', 907.5, 244.5 / 907.5],
			['7', null, null]
		]
	)
	assert.equal(perfil.categorias[2]!.qualidade.sem_dados, true)
	assert.equal(perfil.conjunto!.taxas.evasao_curso, 245 / 1020)
	for (const item of [perfil.conjunto!, ...perfil.categorias]) {
		assert.ok(!('ingressantes_total' in item.totais))
		assert.ok(!('ingressantes_minimo' in item.qualidade))
		assert.ok(!('registros_sem_ingressantes' in item.qualidade))
	}
	// Matrículas seguem a regra do resumo: cursando + concluintes.
	assert.equal(perfil.categorias[0]!.totais.matriculas_total, 3)
})

test('base pequena, medida ausente e fator fora do catálogo', () => {
	const perfil = montarPerfil(
		[
			linha('1', '29', '3'),
			linha('2', '30', null),
			linha(null, '59', null, '0', true)
		],
		'sexo'
	)
	assert.deepEqual(
		perfil.categorias.map((c) => [
			c.qualidade.flag_grupo_pequeno,
			c.qualidade.dados_incompletos,
			c.taxas.evasao_curso
		]),
		[
			[true, false, 3 / 29],
			[false, true, null]
		]
	)
	assert.equal(perfil.conjunto!.taxas.evasao_curso, null)
	// Só a linha do conjunto: o fator não tem categorias na dim_perfil.
	assert.deepEqual(
		montarPerfil([linha(null, null, null, null, true)], 'turno'),
		{
			fator: { codigo: 'turno', nome: 'Turno do aluno', grupo: 'Oferta' },
			base_minima: 30,
			conjunto: null,
			categorias: []
		}
	)
})

test('SQL do perfil filtra um fator por parâmetro e lê a fato de perfil', () => {
	const { text, values } = consultaPerfil({
		ano: 2023,
		fator: 'sexo',
		codigo_area_geral: "01'; DROP"
	})
	assert.deepEqual(values, [2023, "01'; DROP", 'Sexo'])
	assert.ok(!text.includes('DROP'))
	assert.match(text, /FROM gold\.fato_evasao_perfil f/)
	assert.match(text, /FROM gold\.dim_perfil p\s+LEFT JOIN recorte/)
	assert.match(text, /p\.fator = \$3/)
	assert.match(text, /GROUPING SETS/)
	assert.doesNotMatch(text, /fato_evasao_coorte|fato_evasao_curso/)
	assert.throws(() =>
		consultaPerfil({ ano: 2023, fator: '__proto__' as never })
	)
	assert.equal(codigosFatores.length, 12)
})

async function servidor(
	perfil: (filtros: FiltrosPerfil) => Promise<AgregadoPerfil[]>
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
				coorte: unused,
				perfil
			}
		},
		{ docs: true }
	)
}

test('rota valida o fator antes do banco e responde o contrato', async (t) => {
	const recebidos: FiltrosPerfil[] = []
	const app = await servidor(async (filtros) => {
		recebidos.push({ ...filtros })
		return [
			linha('1', '60', '6', '3'),
			linha('2', '40', '4', '2'),
			linha(null, '100', '10', '5', true)
		]
	})
	t.after(() => app.close())
	for (const query of [
		'ano=2023',
		'fator=sexo',
		'ano=2023&fator=Sexo',
		'ano=2023&fator=__proto__',
		'ano=2023&fator=tipo_apoio_moradia',
		'ano=2023&fator=sexo&taxa=evasao_ies',
		'ano=2023&fator=sexo&fator=turno'
	]) {
		const response = await app.inject(`/api/v1/analises/perfil?${query}`)
		assert.equal(response.statusCode, 400, query)
	}
	assert.equal(recebidos.length, 0)
	const response = await app.inject(
		'/api/v1/analises/perfil?ano=2023&fator=sexo&modalidade=Presencial'
	)
	assert.equal(response.statusCode, 200, response.body)
	assert.deepEqual(recebidos, [
		{ ano: 2023, fator: 'sexo', modalidade: 'Presencial' }
	])
	const corpo = response.json()
	assert.equal(corpo.fator.nome, 'Sexo')
	assert.deepEqual(
		corpo.categorias.map(
			(c: {
				categoria: { codigo: string }
				taxas: { evasao_curso: number }
			}) => [c.categoria.codigo, c.taxas.evasao_curso]
		),
		[
			['1', 9 / 60],
			['2', 6 / 40]
		]
	)
	assert.equal(corpo.conjunto.taxas.evasao_curso, 0.15)
	const swagger = (await app.inject('/docs/json')).json()
	assert.ok(swagger.paths['/api/v1/analises/perfil'].get)
})
