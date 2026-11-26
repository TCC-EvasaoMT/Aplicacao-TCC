import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import { test } from 'node:test'
import { Pool } from 'pg'
import { buildApp } from '../../src/app.js'
import { criarConsultasIndicadores } from '../../src/modules/indicadores/index.js'
import { criarConsultasCatalogos } from '../../src/modules/catalogos/index.js'
import { criarHealth } from '../../src/plugins/health.js'
import { criarConsultasAnalises } from '../../src/modules/analises/index.js'
import { testarComparacoes } from './comparacoes.js'

test(
	'API integrada ao PostgreSQL e a um usuário exclusivo de leitura',
	{
		skip:
			!process.env.TEST_DATABASE_URL &&
			'Defina TEST_DATABASE_URL para executar em PostgreSQL 17.'
	},
	async (t) => {
		const adminUrl = new URL(process.env.TEST_DATABASE_URL!)
		const name = `backend_test_${randomUUID().replaceAll('-', '')}`
		const password = randomUUID()
		const admin = new Pool({ connectionString: adminUrl.toString(), max: 1 })
		let createdDb = false
		let createdRole = false
		let owner: Pool | undefined
		let reader: Pool | undefined
		let app: Awaited<ReturnType<typeof buildApp>> | undefined
		t.after(async () => {
			await app?.close()
			await reader?.end()
			await owner?.end()
			// Só os objetos aleatórios criados por esta execução são removidos.
			try {
				if (createdDb) await admin.query(`DROP DATABASE "${name}"`)
				if (createdRole) await admin.query(`DROP ROLE "${name}"`)
			} finally {
				await admin.end()
			}
		})
		await admin.query(`CREATE DATABASE "${name}"`)
		createdDb = true
		await admin.query(
			`CREATE ROLE "${name}" LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT`
		)
		createdRole = true
		const dbUrl = new URL(adminUrl)
		dbUrl.pathname = `/${name}`
		owner = new Pool({ connectionString: dbUrl.toString(), max: 1 })
		const schema = await readFile(
			new URL('../fixtures/gold-schema.sql', import.meta.url),
			'utf8'
		)
		const dados = await readFile(
			new URL('../fixtures/dados.sql', import.meta.url),
			'utf8'
		)
		const permissions = (
			await readFile(
				new URL('../../sql/permissoes.sql', import.meta.url),
				'utf8'
			)
		).replaceAll(':"api_role"', `"${name}"`)
		await owner.query(schema + dados)
		await owner.query(
			'CREATE SCHEMA bronze; CREATE TABLE bronze.privado (valor text)'
		)
		dbUrl.username = name
		dbUrl.password = password
		reader = new Pool({
			connectionString: dbUrl.toString(),
			max: 2,
			statement_timeout: 2500,
			connectionTimeoutMillis: 2000
		})
		app = await buildApp(
			{
				indicadores: criarConsultasIndicadores(reader),
				catalogos: criarConsultasCatalogos(reader),
				analises: criarConsultasAnalises(reader),
				health: criarHealth(reader)
			},
			// A suíte compara muitos recortes em sequência; a cota é testada em seguranca.test.ts.
			{ docs: true, maxRequisicoes: 1000 }
		)
		const server = app
		const db = owner
		const apiUser = reader
		const resumo = async (params: Record<string, string> = {}) => {
			const response = await server.inject(
				`/api/v1/indicadores/resumo?${new URLSearchParams({ ano: '2023', ...params })}`
			)
			assert.equal(response.statusCode, 200, response.body)
			return response.json()
		}
		const evolucao = async (params: Record<string, string> = {}) => {
			const response = await server.inject(
				`/api/v1/analises/evolucao-temporal?${new URLSearchParams({ ano_inicial: '2021', ano_final: '2025', ...params })}`
			)
			assert.equal(response.statusCode, 200, response.body)
			return response.json()
		}

		await t.test(
			'sem permissões falha; com grants consulta sem permitir escrita nem acesso à Bronze',
			async () => {
				assert.equal((await server.inject('/health')).statusCode, 503)
				assert.equal(
					(
						await server.inject(
							'/api/v1/analises/evolucao-temporal?ano_inicial=2022&ano_final=2024'
						)
					).statusCode,
					503
				)
				await db.query(permissions)
				assert.equal((await server.inject('/health')).statusCode, 200)
				await assert.rejects(
					apiUser.query('DELETE FROM gold.fato_evasao_curso'),
					{
						code: '42501'
					}
				)
				await assert.rejects(apiUser.query('SELECT * FROM bronze.privado'), {
					code: '42501'
				})
			}
		)

		await t.test(
			'filtros vêm da fato, preservam códigos e distinguem oferta de sede',
			async () => {
				const response = await server.inject('/api/v1/filtros')
				assert.equal(response.statusCode, 200, response.body)
				const filtros = response.json()
				assert.deepEqual(filtros.anos, [2024, 2023, 2022])
				assert.ok(!filtros.anos.includes(2010))
				assert.ok(
					filtros.cursos.some((x: { codigo: string }) => x.codigo === '001')
				)
				assert.ok(
					filtros.areas_gerais.some(
						(x: { codigo: string }) => x.codigo === '01'
					)
				)
				assert.ok(
					filtros.municipios_sede.some(
						(x: { codigo: string }) => x.codigo === '5102504'
					)
				)
				assert.ok(
					!filtros.municipios_oferta.some(
						(x: { codigo: string }) => x.codigo === '5102504'
					)
				)
				assert.ok(!JSON.stringify(filtros).includes('id_instituicao'))
			}
		)

		await t.test(
			'taxa pondera cursos por base e não usa média das taxas',
			async () => {
				const result = await resumo({
					categoria_administrativa: 'Pública Federal'
				})
				assert.equal(result.totais.vinculos_total, 1000)
				assert.equal(result.totais.alunos_desvinculados, 190)
				assert.equal(result.taxas.evasao_curso, 0.24)
				assert.equal(result.taxas.evasao_ies, 0.19)
				assert.notEqual(result.taxas.evasao_curso, (0.15 + 0.25) / 2)
				assert.equal(result.qualidade.registros_com_alunos, 2)
			}
		)

		await t.test(
			'todos os filtros combinam por E; entrada textual não vira SQL',
			async () => {
				const filtros = {
					codigo_curso: '001',
					codigo_area_geral: '01',
					codigo_municipio_oferta: '5103403',
					modalidade: 'Presencial',
					categoria_administrativa: 'Pública Federal',
					organizacao_academica: 'Universidade',
					codigo_municipio_sede: '5103403'
				}
				assert.equal((await resumo(filtros)).totais.vinculos_total, 100)
				assert.equal(
					(await resumo({ ...filtros, codigo_area_geral: '06' })).qualidade
						.sem_dados,
					true
				)
				assert.equal(
					(await resumo({ modalidade: "x' OR TRUE --" })).qualidade.sem_dados,
					true
				)
				assert.equal(
					(await resumo({ ano: '2022' })).totais.vinculos_total,
					1000
				)
				assert.equal(
					(await resumo({ ano: '1999' })).totais.vinculos_total,
					null
				)
			}
		)

		await t.test(
			'EaD tem sede, mas não recebe município de oferta inventado',
			async () => {
				assert.equal(
					(
						await resumo({
							codigo_curso: '002',
							codigo_municipio_sede: '5103403'
						})
					).totais.vinculos_total,
					900
				)
				assert.equal(
					(
						await resumo({
							codigo_curso: '002',
							codigo_municipio_oferta: '5103403'
						})
					).qualidade.sem_dados,
					true
				)
			}
		)

		await t.test(
			'docentes não geram zeros, e base zero não gera uma taxa',
			async () => {
				const docentes = await resumo({ codigo_curso: '003' })
				assert.equal(docentes.qualidade.sem_dados, true)
				assert.equal(docentes.qualidade.registros_sem_alunos, 1)
				assert.equal(docentes.totais.matriculas_total, null)
				assert.equal(docentes.taxas.evasao_curso, null)
				const zero = await resumo({ codigo_curso: '004' })
				assert.equal(zero.base_risco, 0)
				assert.equal(zero.qualidade.sem_dados, false)
				assert.equal(zero.taxas.evasao_curso, null)
			}
		)

		await t.test(
			'matrículas e ingressantes não usam as colunas com ruído da Gold',
			async () => {
				const curso = await resumo({ codigo_curso: '001' })
				assert.equal(curso.totais.matriculas_total, 50 + 20)
				// Só a coorte que ingressou em 2023; a de 2022 é distrator.
				assert.equal(curso.totais.ingressantes_total, 20)
				assert.equal(curso.qualidade.registros_sem_ingressantes, 0)
				assert.equal(curso.qualidade.ingressantes_minimo, false)
				// A Gold marca valor negativo por causa das colunas descartadas.
				assert.equal(curso.qualidade.flag_valor_negativo, false)
				const anterior = await resumo({ ano: '2022', codigo_curso: '001' })
				assert.equal(anterior.totais.ingressantes_total, 100)
				assert.equal(anterior.totais.matriculas_total, 800)
			}
		)

		await t.test(
			'curso sem linha de ingresso torna o total de ingressantes um mínimo',
			async () => {
				const filtro = { categoria_administrativa: 'Pública Municipal' }
				await db.query('DELETE FROM gold.fato_evasao_coorte WHERE id_curso = 7')
				try {
					const parcial = await resumo(filtro)
					assert.equal(parcial.totais.ingressantes_total, 2)
					assert.equal(parcial.qualidade.registros_sem_ingressantes, 1)
					assert.equal(parcial.qualidade.ingressantes_minimo, true)
					// As outras medidas não ficam incompletas por isso.
					assert.equal(parcial.qualidade.dados_incompletos, false)
					assert.equal(parcial.totais.matriculas_total, 26)
					await db.query(
						'DELETE FROM gold.fato_evasao_coorte WHERE id_curso = 8'
					)
					const nenhum = await resumo(filtro)
					assert.equal(nenhum.totais.ingressantes_total, null)
					assert.equal(nenhum.qualidade.registros_sem_ingressantes, 2)
				} finally {
					await db.query(`INSERT INTO gold.fato_evasao_coorte
            (id_tempo, id_tempo_ingresso, id_instituicao, id_curso, id_area_conhecimento,
             id_localidade, id_oferta, codigo_curso, vinculos_total)
            VALUES (3, 3, 3, 7, 2, 2, 1, '007', 2), (3, 3, 3, 8, 2, 2, 1, '008', 2)
            ON CONFLICT DO NOTHING`)
				}
			}
		)

		await t.test(
			'ruído, dados parciais e grupos pequenos têm sinalização explícita',
			async () => {
				const ruido = await resumo({ codigo_curso: '005' })
				assert.equal(ruido.totais.alunos_desvinculados, -2.5)
				assert.equal(ruido.totais.ingressantes_total, 0.25)
				assert.equal(ruido.taxas.evasao_curso, 0.75 / 20.5)
				assert.equal(ruido.qualidade.flag_valor_negativo, true)
				const parcial = await resumo({
					categoria_administrativa: 'Pública Estadual'
				})
				assert.equal(parcial.qualidade.dados_incompletos, true)
				assert.equal(parcial.totais.alunos_desvinculados, null)
				assert.equal(parcial.taxas.evasao_curso, null)
				const grupo = await resumo({
					categoria_administrativa: 'Pública Municipal'
				})
				assert.equal(grupo.base_risco, 40)
				assert.equal(grupo.qualidade.flag_grupo_pequeno, false)
				assert.equal(
					(await resumo({ codigo_curso: '007' })).qualidade.flag_grupo_pequeno,
					true
				)
			}
		)

		await t.test(
			'evolução equivale ao resumo de cada ano, incluindo ausências e somente docentes',
			async () => {
				const recortes: Record<string, string>[] = [
					{},
					{ categoria_administrativa: 'Pública Federal' },
					{ codigo_curso: '005' },
					{ codigo_curso: '004' }
				]
				for (const recorte of recortes) {
					const result = await evolucao(recorte)
					assert.deepEqual(
						result.serie.map((p: { ano: number }) => p.ano),
						[2021, 2022, 2023, 2024, 2025]
					)
					for (const ponto of result.serie) {
						const { filtros: _filtros, ...anual } = await resumo({
							...recorte,
							ano: String(ponto.ano)
						})
						assert.deepEqual(ponto, { ano: ponto.ano, ...anual })
					}
				}
				const federal = (
					await evolucao({ categoria_administrativa: 'Pública Federal' })
				).serie
				assert.equal(federal[1].taxas.evasao_curso, 0.1)
				assert.equal(federal[2].taxas.evasao_curso, 0.24)
				assert.equal(federal[2].taxas.evasao_ies, 0.19)
				const geral = (await evolucao()).serie
				assert.equal(geral[0].totais.vinculos_total, null)
				assert.equal(geral[3].qualidade.registros_sem_alunos, 1)
				assert.equal(geral[3].qualidade.sem_dados, true)
				assert.equal(geral[4].qualidade.registros_sem_alunos, 0)
			}
		)

		await t.test(
			'evolução combina todos os filtros, preserva códigos e distingue oferta de sede',
			async () => {
				const filtros = {
					codigo_curso: '001',
					codigo_area_geral: '01',
					codigo_municipio_oferta: '5103403',
					modalidade: 'Presencial',
					categoria_administrativa: 'Pública Federal',
					organizacao_academica: 'Universidade',
					codigo_municipio_sede: '5103403'
				}
				const combinado = await evolucao(filtros)
				assert.equal(combinado.serie[1].totais.vinculos_total, 1000)
				assert.equal(combinado.serie[2].totais.vinculos_total, 100)
				assert.ok(
					(await evolucao({ ...filtros, codigo_area_geral: '06' })).serie.every(
						(p: { qualidade: { sem_dados: boolean } }) => p.qualidade.sem_dados
					)
				)
				assert.ok(
					(await evolucao({ modalidade: "x' OR TRUE --" })).serie.every(
						(p: { qualidade: { sem_dados: boolean } }) => p.qualidade.sem_dados
					)
				)
				const ead = { codigo_curso: '002', codigo_municipio_sede: '5103403' }
				assert.equal((await evolucao(ead)).serie[2].totais.vinculos_total, 900)
				assert.ok(
					(
						await evolucao({ ...ead, codigo_municipio_oferta: '5103403' })
					).serie.every(
						(p: { qualidade: { sem_dados: boolean } }) => p.qualidade.sem_dados
					)
				)
				const semDados = await evolucao({
					ano_inicial: '2000',
					ano_final: '2001'
				})
				assert.equal(semDados.serie.length, 2)
				assert.ok(
					semDados.serie.every(
						(p: { totais: { vinculos_total: number | null } }) =>
							p.totais.vinculos_total === null
					)
				)
			}
		)

		await testarComparacoes(t, server, db)

		await t.test(
			'ranking cobre todas as categorias, repete o resumo de cada uma e classifica só bases suficientes',
			async () => {
				const ranking = async (query: string) => {
					const response = await server.inject(
						`/api/v1/analises/ranking?${query}`
					)
					assert.equal(response.statusCode, 200, response.body)
					return response.json()
				}
				type Item = {
					grupo: { valor: string | null }
					posicao: number | null
					situacao: string
				}
				const linhas = (resultado: { grupos: Item[] }) =>
					resultado.grupos.map((g) => [g.grupo.valor, g.posicao, g.situacao])
				const areas = await ranking('ano=2023&dimensao=area_geral')
				// A área 01 tem o curso 006 sem desvinculados; o grupo sem código só
				// tem docentes.
				assert.deepEqual(linhas(areas), [
					['06', 1, 'classificado'],
					['01', null, 'sem_taxa'],
					[null, null, 'sem_identificador']
				])
				const modalidades = await ranking('ano=2023&dimensao=modalidade')
				assert.deepEqual(linhas(modalidades), [
					['A distância', 1, 'classificado'],
					['Não informado', null, 'sem_taxa'],
					['Presencial', null, 'sem_taxa']
				])
				for (const [filtro, resultado] of [
					['codigo_area_geral', areas],
					['modalidade', modalidades]
				] as const)
					for (const item of resultado.grupos) {
						if (item.grupo.valor === null) continue
						const {
							grupo: _g,
							situacao: _s,
							posicao: _p,
							empate: _e,
							...valores
						} = item
						const { filtros: _f, ...esperado } = await resumo({
							[filtro]: item.grupo.valor
						})
						assert.deepEqual(valores, esperado, item.grupo.valor)
					}
				const federal = 'ano=2023&categoria_administrativa=P%C3%BAblica+Federal'
				assert.deepEqual(
					linhas(await ranking(`${federal}&dimensao=area_geral`)),
					[
						['06', 1, 'classificado'],
						['01', 2, 'classificado']
					]
				)
				const porIes = await ranking(
					`${federal}&dimensao=modalidade&taxa=evasao_ies`
				)
				assert.equal(porIes.filtros.taxa, 'evasao_ies')
				assert.deepEqual(linhas(porIes), [
					['A distância', 1, 'classificado'],
					['Presencial', 2, 'classificado']
				])
				const vazio = await ranking('ano=1999&dimensao=area_geral')
				assert.deepEqual(vazio.grupos, [])
				assert.equal(vazio.classificados, 0)
			}
		)

		await t.test(
			'perfil soma cada categoria do fator, mostra as vazias e não mistura fatores',
			async () => {
				const perfil = async (query: string) => {
					const response = await server.inject(
						`/api/v1/analises/perfil?${query}`
					)
					assert.equal(response.statusCode, 200, response.body)
					return response.json()
				}
				type Categoria = {
					categoria: { codigo: string | null; nome: string }
					base_risco: number | null
					taxas: { evasao_curso: number | null; evasao_ies: number | null }
					qualidade: {
						sem_dados: boolean
						flag_valor_negativo: boolean
						flag_grupo_pequeno: boolean | null
						dados_incompletos: boolean
					}
				}
				const linhas = (resultado: { categorias: Categoria[] }) =>
					resultado.categorias.map((c) => [
						c.categoria.codigo,
						c.base_risco,
						c.taxas.evasao_curso
					])
				// O código 7 só tem registro em 2022: em 2023 é categoria sem dados.
				const apoio = await perfil('ano=2023&fator=apoio_social')
				assert.deepEqual(linhas(apoio), [
					['1', 112.5, 0.5 / 112.5],
					['0', 907.5, 244.5 / 907.5],
					['7', null, null]
				])
				assert.equal(
					apoio.categorias[2].categoria.nome,
					'Código 7 não previsto no catálogo'
				)
				assert.equal(apoio.categorias[2].qualidade.sem_dados, true)
				// O 007 tem desvinculados negativos na categoria Sim.
				assert.equal(apoio.categorias[0].qualidade.flag_valor_negativo, true)
				assert.equal(apoio.categorias[1].taxas.evasao_ies, 193.5 / 907.5)
				assert.equal(apoio.conjunto.base_risco, 1020)
				assert.equal(apoio.conjunto.taxas.evasao_curso, 245 / 1020)
				// O 006 masculino não tem desvinculados: a taxa fica null, sem zerar.
				const sexo = await perfil('ano=2023&fator=sexo')
				assert.deepEqual(linhas(sexo), [
					['1', 572, 122 / 572],
					['2', 478, null]
				])
				assert.equal(sexo.categorias[1].qualidade.dados_incompletos, true)
				assert.equal(sexo.conjunto.taxas.evasao_curso, null)
				const federal = await perfil(
					'ano=2023&fator=sexo&categoria_administrativa=P%C3%BAblica+Federal'
				)
				assert.deepEqual(linhas(federal), [
					['1', 560, 119 / 560],
					['2', 440, 121 / 440]
				])
				const pequeno = await perfil(
					'ano=2023&fator=sexo&categoria_administrativa=P%C3%BAblica+Municipal'
				)
				assert.deepEqual(
					pequeno.categorias.map(
						(c: Categoria) => c.qualidade.flag_grupo_pequeno
					),
					[true, true]
				)
				const area = await perfil(
					'ano=2023&fator=apoio_social&codigo_area_geral=01'
				)
				assert.deepEqual(linhas(area), [
					['1', 10, 0],
					['0', 90, 15 / 90],
					['7', null, null]
				])
				// Fator sem categorias na base: 200, lista vazia.
				const turno = await perfil('ano=2023&fator=turno')
				assert.deepEqual(turno.categorias, [])
				assert.equal(turno.conjunto, null)
				const vazio = await perfil('ano=1999&fator=sexo')
				assert.deepEqual(
					vazio.categorias.map((c: Categoria) => c.qualidade.sem_dados),
					[true, true]
				)
			}
		)

		await t.test(
			'dispersão repete o resumo de cada curso e calcula a referência sem cursos sem taxa',
			async () => {
				const dispersao = async (query: string) => {
					const response = await server.inject(
						`/api/v1/analises/dispersao?${query}`
					)
					assert.equal(response.statusCode, 200, response.body)
					return response.json()
				}
				const todos = await dispersao('ano=2023')
				assert.deepEqual(
					todos.cursos.map(
						(c: { curso: { codigo: string } }) => c.curso.codigo
					),
					['001', '002', '003', '004', '005', '006', '007', '008']
				)
				for (const { curso, zona_critica: _, ...ponto } of todos.cursos) {
					const { filtros: __, ...resumoCurso } = await resumo({
						codigo_curso: curso.codigo
					})
					assert.deepEqual(ponto, resumoCurso, curso.codigo)
				}
				const ref = todos.referencias
				assert.equal(ref.alta_evasao.evasao_curso, 248.75 / 1060.5)
				assert.equal(ref.alta_evasao.evasao_ies, 193.5 / 1060.5)
				assert.deepEqual(ref.cursos_fora_da_referencia, {
					evasao_curso: 3,
					evasao_ies: 3
				})
				const zona = (resultado: {
					cursos: {
						curso: { codigo: string }
						zona_critica: { evasao_curso: boolean }
					}[]
				}) =>
					resultado.cursos
						.filter((c) => c.zona_critica.evasao_curso)
						.map((c) => c.curso.codigo)
				// O 007 tem a mesma taxa do 002, mas base 20.
				assert.deepEqual(zona(todos), ['002'])
				const federal = await dispersao(
					'ano=2023&categoria_administrativa=P%C3%BAblica+Federal'
				)
				assert.equal(federal.referencias.alta_evasao.evasao_curso, 0.24)
				assert.deepEqual(zona(federal), ['002'])
				const presencialEducacao = await dispersao(
					'ano=2023&codigo_area_geral=01&modalidade=Presencial'
				)
				assert.deepEqual(
					presencialEducacao.cursos.map(
						(c: { curso: { codigo: string } }) => c.curso.codigo
					),
					['001', '004', '005', '006']
				)
				const vazio = await dispersao('ano=1999')
				assert.deepEqual(vazio.cursos, [])
				assert.equal(vazio.referencias.alta_evasao.evasao_curso, null)
			}
		)

		await t.test(
			'reconstrução altera IDs; reaplicar grants recupera consultas por código',
			async () => {
				const antes = await resumo({ codigo_curso: '001' })
				const serieAntes = await evolucao({ codigo_curso: '001' })
				const urlComparacao =
					'/api/v1/analises/comparacoes?ano=2023&agrupar_por=curso&grupos=001'
				const comparacaoAntes = (await server.inject(urlComparacao)).json()
				const urlPerfil =
					'/api/v1/analises/perfil?ano=2023&fator=sexo&codigo_curso=001'
				const perfilAntes = (await server.inject(urlPerfil)).json()
				await db.query(
					`BEGIN; DROP SCHEMA gold CASCADE; ${schema} ${dados} COMMIT;`
				)
				assert.equal((await server.inject('/health')).statusCode, 503)
				assert.equal((await server.inject(urlComparacao)).statusCode, 503)
				assert.equal(
					(
						await server.inject(
							'/api/v1/analises/evolucao-temporal?ano_inicial=2022&ano_final=2024'
						)
					).statusCode,
					503
				)
				await db.query(permissions)
				await db.query(`BEGIN;
      INSERT INTO gold.dim_curso (id_curso, codigo_curso, nome_curso) VALUES (101, 'temporario', 'Pedagogia');
      UPDATE gold.fato_evasao_curso SET id_curso = 101 WHERE id_curso = 1;
      UPDATE gold.fato_evasao_coorte SET id_curso = 101 WHERE id_curso = 1;
      UPDATE gold.fato_evasao_perfil SET id_curso = 101 WHERE id_curso = 1;
      DELETE FROM gold.dim_curso WHERE id_curso = 1;
      UPDATE gold.dim_curso SET codigo_curso = '001' WHERE id_curso = 101;
      COMMIT;`)
				assert.equal((await server.inject('/health')).statusCode, 200)
				assert.deepEqual(await resumo({ codigo_curso: '001' }), antes)
				assert.deepEqual(await evolucao({ codigo_curso: '001' }), serieAntes)
				assert.deepEqual(
					(await server.inject(urlComparacao)).json(),
					comparacaoAntes
				)
				assert.deepEqual((await server.inject(urlPerfil)).json(), perfilAntes)
			}
		)

		await t.test(
			'consulta sintética responde dentro de três segundos',
			async () => {
				const start = performance.now()
				await resumo()
				const duration = performance.now() - start
				t.diagnostic(
					`Resumo com dados sintéticos: ${duration.toFixed(1)} ms; não representa o volume real.`
				)
				assert.ok(duration < 3000, `${duration.toFixed(1)} ms`)
				const serieStart = performance.now()
				await evolucao({ ano_inicial: '2000', ano_final: '2029' })
				const serieDuration = performance.now() - serieStart
				t.diagnostic(
					`Série de 30 anos com dados sintéticos: ${serieDuration.toFixed(1)} ms.`
				)
				assert.ok(serieDuration < 3000, `${serieDuration.toFixed(1)} ms`)
				const comparacaoStart = performance.now()
				const comparacao = await server.inject(
					'/api/v1/analises/comparacoes?ano=2023&agrupar_por=curso'
				)
				assert.equal(comparacao.statusCode, 200)
				const comparacaoDuration = performance.now() - comparacaoStart
				t.diagnostic(
					`Comparação sintética: ${comparacaoDuration.toFixed(1)} ms; não representa o volume real.`
				)
				assert.ok(
					comparacaoDuration < 3000,
					`${comparacaoDuration.toFixed(1)} ms`
				)
			}
		)
	}
)
