import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import type { FastifyInstance } from 'fastify'
import type { Pool } from 'pg'
import {
	agrupamentos,
	type montarComparacao
} from '../../src/modules/analises/comparacoes.js'

type Resultado = ReturnType<typeof montarComparacao>
const base = '/api/v1/analises/comparacoes'

export async function testarComparacoes(
	t: TestContext,
	app: FastifyInstance,
	db: Pool
) {
	async function comparar(
		params: Record<string, string> = {},
		selecionados: string[] = []
	) {
		const query = new URLSearchParams({
			ano: '2023',
			agrupar_por: 'curso',
			...params
		})
		for (const grupo of selecionados) query.append('grupos', grupo)
		const res = await app.inject(`${base}?${query}`)
		assert.equal(res.statusCode, 200, res.body)
		return res.json<Resultado>()
	}
	await t.test(
		'comparações por sete dimensões coincidem com o resumo de cada grupo e ano',
		async () => {
			for (const ano of ['2022', '2023', '2024']) {
				for (const [agrupar_por, { filtro }] of Object.entries(agrupamentos)) {
					const result = await comparar({ ano, agrupar_por })
					assert.equal(result.truncado, false)
					assert.equal(result.total_grupos, result.grupos.length)
					for (const { grupo, ...valores } of result.grupos) {
						if (grupo.valor === null) continue
						const response = await app.inject(
							`/api/v1/indicadores/resumo?${new URLSearchParams({ ano, [filtro]: grupo.valor })}`
						)
						assert.equal(response.statusCode, 200)
						const { filtros: _filtros, ...resumo } = response.json()
						assert.deepEqual(
							valores,
							resumo,
							`${ano}/${agrupar_por}/${grupo.valor}`
						)
					}
				}
			}
			const categorias = await comparar({
				agrupar_por: 'categoria_administrativa'
			})
			const federal = categorias.grupos.find(
				(g) => g.grupo.valor === 'Pública Federal'
			)!
			assert.equal(federal.base_risco, 1000)
			assert.equal(federal.taxas.evasao_curso, 0.24)
			assert.notEqual(federal.taxas.evasao_curso, (0.15 + 0.25) / 2)
			const municipal = categorias.grupos.find(
				(g) => g.grupo.valor === 'Pública Municipal'
			)!
			assert.equal(municipal.base_risco, 40)
			assert.equal(municipal.qualidade.flag_grupo_pequeno, false)
		}
	)
	await t.test(
		'comparações preservam zero, docentes, ruído, ausências parciais e recorte vazio',
		async () => {
			const result = await comparar()
			const porCurso = new Map(result.grupos.map((g) => [g.grupo.valor, g]))
			assert.equal(porCurso.get('003')!.totais.vinculos_total, null)
			assert.equal(porCurso.get('003')!.qualidade.sem_dados, true)
			assert.equal(porCurso.get('003')!.qualidade.registros_sem_alunos, 1)
			assert.equal(porCurso.get('004')!.base_risco, 0)
			assert.equal(porCurso.get('004')!.taxas.evasao_curso, null)
			assert.equal(porCurso.get('005')!.totais.alunos_desvinculados, -2.5)
			assert.equal(porCurso.get('005')!.taxas.evasao_curso, 0.75 / 20.5)
			assert.equal(porCurso.get('005')!.qualidade.flag_valor_negativo, true)
			assert.equal(porCurso.get('005')!.qualidade.flag_grupo_pequeno, true)
			assert.equal(porCurso.get('006')!.taxas.evasao_curso, null)
			assert.equal(porCurso.get('006')!.qualidade.dados_incompletos, true)
			const recortesVazios: Record<string, string>[] = [
				{ ano: '1999' },
				{ codigo_curso: '99999' }
			]
			for (const filtros of recortesVazios) {
				assert.deepEqual(await comparar(filtros), {
					filtros: {
						agrupar_por: 'curso',
						...filtros,
						ano: Number(filtros.ano ?? '2023'),
						limite: 20
					},
					total_grupos: 0,
					truncado: false,
					grupos: []
				})
			}
		}
	)
	await t.test(
		'filtros combinam por E e seleção por OU, sem transformar textos em SQL',
		async () => {
			const filtros = {
				codigo_curso: '001',
				codigo_area_geral: '01',
				codigo_municipio_oferta: '5103403',
				codigo_municipio_sede: '5103403',
				modalidade: 'Presencial',
				categoria_administrativa: 'Pública Federal',
				organizacao_academica: 'Universidade'
			}
			const result = await comparar(filtros, ['001', '002'])
			assert.deepEqual(
				result.grupos.map((g) => g.grupo.valor),
				['001']
			)
			assert.equal(result.grupos[0]!.totais.vinculos_total, 100)
			assert.equal(
				(await comparar({ ...filtros, codigo_area_geral: '06' })).grupos.length,
				0
			)
			assert.equal((await comparar(filtros, ['002'])).grupos.length, 0)
			const selecionados = await comparar({}, ['008', '001', '999'])
			assert.deepEqual(
				selecionados.grupos.map((g) => g.grupo.valor),
				['001', '008']
			)
			assert.equal(selecionados.total_grupos, 2)
			assert.equal(
				(await comparar({ agrupar_por: 'area_geral' }, ['01'])).grupos[0]!.grupo
					.valor,
				'01'
			)
			const injecao = "x' OR TRUE --"
			assert.equal((await comparar({ modalidade: injecao })).total_grupos, 0)
			assert.equal(
				(await comparar({ agrupar_por: 'modalidade' }, [injecao])).total_grupos,
				0
			)
		}
	)
	await t.test(
		'municípios de oferta e sede permanecem distintos e o grupo sem código é preservado',
		async () => {
			const oferta = await comparar({ agrupar_por: 'municipio_oferta' })
			assert.deepEqual(
				oferta.grupos.map((g) => g.grupo.valor),
				['5103403', '5107909', null]
			)
			const desconhecido = oferta.grupos.at(-1)!
			assert.deepEqual(desconhecido.grupo, { valor: null, nome: null })
			assert.equal(desconhecido.totais.vinculos_total, 900)
			assert.equal(desconhecido.qualidade.registros_sem_alunos, 1)
			const ead = { codigo_curso: '002' }
			const ofertaEad = await comparar({
				...ead,
				agrupar_por: 'municipio_oferta'
			})
			const sedeEad = await comparar({ ...ead, agrupar_por: 'municipio_sede' })
			assert.equal(ofertaEad.grupos[0]!.grupo.valor, null)
			assert.deepEqual(sedeEad.grupos[0]!.grupo, {
				valor: '5103403',
				nome: 'Cuiabá'
			})
			assert.equal(
				(await comparar({ ...ead, codigo_municipio_oferta: '5103403' }))
					.total_grupos,
				0
			)
			const semArea = (
				await comparar({ ano: '2024', agrupar_por: 'area_geral' })
			).grupos[0]!
			assert.equal(semArea.grupo.valor, null)
			assert.equal(semArea.qualidade.sem_dados, true)
		}
	)
	await t.test(
		'limite sinaliza truncamento sem mudar totais nem ordenar por taxa',
		async () => {
			const limitado = await comparar({ limite: '2' })
			const completo = await comparar()
			assert.equal(limitado.total_grupos, 8)
			assert.equal(limitado.truncado, true)
			assert.deepEqual(limitado.grupos, completo.grupos.slice(0, 2))
			const selecionado = await comparar({ limite: '1' }, ['007', '008'])
			assert.equal(selecionado.total_grupos, 2)
			assert.equal(selecionado.truncado, true)
			assert.equal(selecionado.grupos[0]!.grupo.valor, '007')
			const maximo = await comparar({ limite: '20' })
			assert.deepEqual(maximo.grupos, completo.grupos)
		}
	)
	await t.test(
		'mais de vinte grupos respeitam o limite e sinalizam o total completo',
		async () => {
			await db.query(
				"INSERT INTO gold.dim_curso (id_curso, codigo_curso, nome_curso) SELECT n, n::text, 'Curso sintético ' || n FROM generate_series(100, 124) AS n"
			)
			await db.query(
				'INSERT INTO gold.fato_evasao_curso (id_tempo, id_instituicao, id_curso, id_area_conhecimento, id_localidade, id_oferta, codigo_curso, vinculos_total) SELECT 3, 1, n, 1, 1, 1, n::text, 50 FROM generate_series(100, 124) AS n'
			)
			try {
				const result = await comparar()
				assert.equal(result.total_grupos, 33)
				assert.equal(result.grupos.length, 20)
				assert.equal(result.truncado, true)
				const ultimo = await comparar({}, ['124'])
				assert.equal(ultimo.total_grupos, 1)
				assert.equal(ultimo.truncado, false)
				assert.equal(ultimo.grupos[0]!.grupo.valor, '124')
			} finally {
				await db.query(
					'DELETE FROM gold.fato_evasao_curso WHERE id_curso BETWEEN 100 AND 124'
				)
				await db.query(
					'DELETE FROM gold.dim_curso WHERE id_curso BETWEEN 100 AND 124'
				)
			}
		}
	)
	await t.test(
		'áreas com mesmo código agregam juntas mesmo com nomes divergentes ou ausentes',
		async () => {
			await db.query(
				"INSERT INTO gold.dim_area_conhecimento (id_area_conhecimento, codigo_rotulo_cine, codigo_area_geral, area_geral) VALUES (20, 'teste', '01', 'Z outro rótulo')"
			)
			await db.query(
				'UPDATE gold.fato_evasao_curso SET id_area_conhecimento = 20 WHERE id_curso = 2'
			)
			try {
				const filtros = {
					agrupar_por: 'area_geral',
					categoria_administrativa: 'Pública Federal'
				}
				const result = await comparar(filtros)
				assert.equal(result.total_grupos, 1)
				assert.deepEqual(result.grupos[0]!.grupo, {
					valor: '01',
					nome: 'Educação'
				})
				assert.equal(result.grupos[0]!.base_risco, 1000)
				assert.equal(result.grupos[0]!.taxas.evasao_curso, 0.24)
				await db.query(
					'UPDATE gold.dim_area_conhecimento SET area_geral = NULL WHERE id_area_conhecimento IN (1, 20)'
				)
				const semNome = await comparar(filtros)
				assert.deepEqual(semNome.grupos[0]!.grupo, { valor: '01', nome: null })
				assert.equal(semNome.grupos[0]!.base_risco, 1000)
			} finally {
				await db.query(
					"UPDATE gold.dim_area_conhecimento SET area_geral = 'Educação' WHERE id_area_conhecimento = 1"
				)
				await db.query(
					'UPDATE gold.fato_evasao_curso SET id_area_conhecimento = 2 WHERE id_curso = 2'
				)
				await db.query(
					'DELETE FROM gold.dim_area_conhecimento WHERE id_area_conhecimento = 20'
				)
			}
		}
	)
}
