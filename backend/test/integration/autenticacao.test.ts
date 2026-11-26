import assert from 'node:assert/strict'
import { createHmac, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'
import { migrarApp } from '../../src/database/migracoes.js'
import { criarAdministrador } from '../../src/database/administradores.js'
import { buildApp } from '../../src/app.js'
import {
	criarRepositorioAutenticacao,
	hashToken
} from '../../src/modules/autenticacao/repositorio.js'
import { criarConsultasCatalogos } from '../../src/modules/catalogos/index.js'
import { criarConsultasIndicadores } from '../../src/modules/indicadores/index.js'
import { criarConsultasAnalises } from '../../src/modules/analises/index.js'
import type { FastifyInstance } from 'fastify'

test(
	'schema app, migrações e autenticação no PostgreSQL',
	{
		skip:
			!process.env.TEST_DATABASE_URL &&
			'Defina TEST_DATABASE_URL para executar em PostgreSQL 17.'
	},
	async (t) => {
		const admin = new Pool({
			connectionString: process.env.TEST_DATABASE_URL,
			max: 1
		})
		const nome = `auth_test_${randomUUID().replaceAll('-', '')}`
		const role = `${nome}_api`
		const ownerRole = `${nome}_owner`
		const password = randomUUID()
		let bancoCriado = false
		const roles: string[] = []
		const pools: Pool[] = []
		const apps: FastifyInstance[] = []
		t.after(async () => {
			for (const app of apps) await app.close()
			for (const pool of pools) await pool.end()
			try {
				if (bancoCriado) await admin.query(`DROP DATABASE "${nome}"`)
				for (const r of roles) await admin.query(`DROP ROLE "${r}"`)
			} finally {
				await admin.end()
			}
		})
		await admin.query(`CREATE DATABASE "${nome}"`)
		bancoCriado = true
		for (const r of [role, ownerRole]) {
			await admin.query(
				`CREATE ROLE "${r}" LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT`
			)
			roles.push(r)
		}
		const url = new URL(process.env.TEST_DATABASE_URL!)
		url.pathname = `/${nome}`
		const db = new Pool({ connectionString: url.toString() })
		pools.push(db)
		await db.query(`CREATE SCHEMA app AUTHORIZATION "${ownerRole}"`)
		url.username = ownerRole
		url.password = password
		const owner = new Pool({ connectionString: url.toString() })
		pools.push(owner)
		url.username = role
		const runtime = new Pool({ connectionString: url.toString() })
		pools.push(runtime)
		const email = 'admin@example.com'
		const senha = 'senha longa sintética 2026'
		await t.test(
			'migração idempotente e criação controlada sem sobrescrever usuário',
			async () => {
				await migrarApp(owner)
				await migrarApp(owner)
				assert.equal(
					(await db.query('SELECT * FROM app.migracoes')).rowCount,
					1
				)
				await criarAdministrador(owner, email.toUpperCase(), senha)
				await assert.rejects(criarAdministrador(owner, email, senha), {
					code: '23505'
				})
				assert.equal((await db.query('SELECT * FROM app.usuarios')).rowCount, 1)
				assert.equal(
					(await db.query('SELECT * FROM app.usuario_permissoes')).rowCount,
					2
				)
			}
		)
		await t.test(
			'runtime tem privilégio mínimo e Gold pode ser reconstruída sem apagar contas',
			async () => {
				await assert.rejects(runtime.query('SELECT * FROM app.usuarios'), {
					code: '42501'
				})
				const grants = await readFile(
					new URL('../../sql/permissoes-app.sql', import.meta.url),
					'utf8'
				)
				await owner.query(grants.replaceAll(':"auth_role"', `"${role}"`))
				assert.equal(
					(await runtime.query('SELECT email FROM app.usuarios')).rows[0].email,
					email
				)
				for (const sql of [
					'DELETE FROM app.usuarios',
					'UPDATE app.usuarios SET ativo = false',
					"UPDATE app.usuarios SET email = 'outro@example.com'",
					'DELETE FROM app.usuario_permissoes',
					'CREATE TABLE app.invasao (id int)',
					'SELECT * FROM app.migracoes'
				]) {
					await assert.rejects(runtime.query(sql), { code: '42501' })
				}
				await db.query('CREATE SCHEMA gold; CREATE TABLE gold.teste (id int)')
				await assert.rejects(
					runtime.query('INSERT INTO gold.teste VALUES (1)'),
					{ code: '42501' }
				)
				await db.query('DROP SCHEMA gold CASCADE; CREATE SCHEMA gold')
				assert.equal(
					(await runtime.query('SELECT * FROM app.usuarios')).rowCount,
					1
				)
			}
		)
		await t.test(
			'provisionamento repetido pela CLI preserva senha, bloqueio e permissões',
			async () => {
				const antes = (
					await db.query(
						'SELECT id, senha_hash FROM app.usuarios WHERE email = $1',
						[email]
					)
				).rows[0]
				await db.query('UPDATE app.usuarios SET ativo = false WHERE id = $1', [
					antes.id
				])
				await db.query(
					'DELETE FROM app.usuario_permissoes WHERE usuario_id = $1',
					[antes.id]
				)
				const env = {
					...process.env,
					POSTGRES_HOST: url.hostname,
					POSTGRES_PORT: url.port || '5432',
					POSTGRES_DB: nome,
					APP_MIGRATION_USER: ownerRole,
					APP_MIGRATION_PASSWORD: password
				}
				const cli = ['--import', 'tsx', 'src/database/cli.ts', 'criar-admin']
				const options = {
					cwd: fileURLToPath(new URL('../../', import.meta.url)),
					env
				}
				const result = await promisify(execFile)(
					process.execPath,
					[...cli, email.toUpperCase(), '--se-ausente'],
					options
				)
				assert.match(result.stdout, /Conta já existe/)
				assert.ok(!result.stdout.includes(antes.senha_hash))
				const depois = (
					await db.query(
						'SELECT id, senha_hash, ativo FROM app.usuarios WHERE email = $1',
						[email]
					)
				).rows[0]
				assert.deepEqual(depois, { ...antes, ativo: false })
				assert.equal(
					(await db.query('SELECT * FROM app.usuario_permissoes')).rowCount,
					0
				)
				// Sem terminal e sem conta, deve falhar em vez de criar senha padrão.
				await assert.rejects(
					promisify(execFile)(
						process.execPath,
						[...cli, 'nova@example.com', '--se-ausente'],
						options
					)
				)
				assert.equal((await db.query('SELECT * FROM app.usuarios')).rowCount, 1)
				await db.query('UPDATE app.usuarios SET ativo = true WHERE id = $1', [
					antes.id
				])
				await db.query(
					"INSERT INTO app.usuario_permissoes (usuario_id, permissao) VALUES ($1, 'etl:consultar'), ($1, 'etl:reprocessar')",
					[antes.id]
				)
			}
		)
		const config = {
			secret: 'ab'.repeat(32),
			origin: 'http://127.0.0.1:3000',
			secure: false
		}
		const csrf = { origin: config.origin, 'x-csrf-protection': '1' }
		const logs: string[] = []
		async function servidor(secure = false) {
			const app = await buildApp(
				{
					health: async () => {},
					catalogos: criarConsultasCatalogos(runtime),
					indicadores: criarConsultasIndicadores(runtime),
					analises: criarConsultasAnalises(runtime),
					autenticacao: {
						config: { ...config, secure },
						repositorio: criarRepositorioAutenticacao(runtime)
					}
				},
				{
					docs: true,
					logger: true,
					logStream: {
						write: (line) => {
							logs.push(line)
						}
					}
				}
			)
			// Rotas apenas do teste: ETL ainda não foi implementado no produto.
			app.get(
				'/api/teste/etl',
				{ config: { acesso: 'etl:consultar' } },
				async () => ({ ok: true })
			)
			app.post(
				'/api/teste/reprocessar',
				{ config: { acesso: 'etl:reprocessar' } },
				async () => ({ ok: true })
			)
			apps.push(app)
			return app
		}
		const prefixo = '/api/v1/autenticacao'
		const login = (
			app: FastifyInstance,
			dados = { email, senha },
			remoteAddress = '127.0.0.1'
		) =>
			app.inject({
				method: 'POST',
				url: `${prefixo}/login`,
				headers: csrf,
				payload: dados,
				remoteAddress
			})
		const cookie = (response: {
			headers: { 'set-cookie'?: string | string[] }
		}) => String(response.headers['set-cookie']).split(';')[0]!
		const bearer = (response: { json(): { access_token: string } }) => ({
			authorization: `Bearer ${response.json().access_token}`
		})
		const post = (app: FastifyInstance, rota: string, tokenCookie: string) =>
			app.inject({
				method: 'POST',
				url: `${prefixo}/${rota}`,
				headers: { ...csrf, cookie: tokenCookie }
			})

		await t.test(
			'login, Bearer, rotação e logout revogam a sessão no servidor',
			async () => {
				const app = await servidor()
				const inicial = await login(app)
				assert.equal(inicial.statusCode, 200, inicial.body)
				assert.equal(inicial.headers['cache-control'], 'no-store')
				assert.match(String(inicial.headers['set-cookie']), /HttpOnly/)
				assert.match(String(inicial.headers['set-cookie']), /SameSite=Strict/)
				assert.equal(inicial.json().token_type, 'Bearer')
				assert.equal(inicial.json().expires_in, 600)
				assert.ok(!inicial.body.includes('senha'))
				const claims = app.jwt.decode<{ sid: string; sub: string }>(
					inicial.json().access_token
				)!
				const stored = (
					await db.query(
						'SELECT hash FROM app.tokens_renovacao WHERE sessao_id = $1',
						[claims.sid]
					)
				).rows[0].hash
				assert.equal(stored, hashToken(cookie(inicial).split('=')[1]!))
				assert.notEqual(stored, cookie(inicial).split('=')[1])
				assert.equal(
					(await app.inject({ url: `${prefixo}/me`, headers: bearer(inicial) }))
						.statusCode,
					200
				)
				assert.equal(
					(
						await app.inject({
							url: '/api/teste/etl',
							headers: bearer(inicial)
						})
					).statusCode,
					200
				)
				const renovado = await post(app, 'renovar', cookie(inicial))
				assert.equal(renovado.statusCode, 200, renovado.body)
				assert.notEqual(cookie(inicial), cookie(renovado))
				assert.equal(
					(await post(app, 'logout', cookie(renovado))).statusCode,
					204
				)
				assert.equal(
					(await app.inject({ url: `${prefixo}/me`, headers: bearer(inicial) }))
						.statusCode,
					401
				)
				assert.equal(
					(
						await app.inject({
							url: `${prefixo}/me`,
							headers: bearer(renovado)
						})
					).statusCode,
					401
				)
				assert.equal(
					(await post(app, 'renovar', cookie(renovado))).statusCode,
					401
				)
				assert.equal(
					(await post(app, 'logout', cookie(renovado))).statusCode,
					204
				)
			}
		)
		await t.test(
			'tokens forjados, expirados ou com emissor/audiência incorretos são rejeitados',
			async () => {
				const app = await servidor()
				const inicial = await login(app)
				const claims = app.jwt.decode<{ sid: string; sub: string }>(
					inicial.json().access_token
				)!
				const assinar = (payload: object, algorithm = 'HS256') => {
					const entrada = [{ alg: algorithm, typ: 'JWT' }, payload]
						.map((v) => Buffer.from(JSON.stringify(v)).toString('base64url'))
						.join('.')
					return `${entrada}.${createHmac('sha256', config.secret).update(entrada).digest('base64url')}`
				}
				for (const [indice, token] of [
					'invalido',
					inicial.json().access_token + 'x',
					assinar({ ...claims, exp: 1 }),
					assinar({
						sub: claims.sub,
						sid: claims.sid,
						iss: 'tcc-evasao-api',
						aud: 'tcc-evasao-admin'
					}),
					assinar(claims, 'none'),
					app.jwt.sign({ sub: claims.sub, sid: claims.sid }, { aud: 'outro' }),
					app.jwt.sign({ sub: claims.sub, sid: claims.sid }, { iss: 'outro' }),
					app.jwt.sign({ sub: randomUUID(), sid: claims.sid }),
					app.jwt.sign({ sub: claims.sub, sid: 'invalido' })
				].entries()) {
					assert.equal(
						(
							await app.inject({
								url: `${prefixo}/me`,
								headers: { authorization: `Bearer ${token}` }
							})
						).statusCode,
						401,
						`Caso inválido ${indice}`
					)
				}
				assert.equal((await app.inject(`${prefixo}/me`)).statusCode, 401)
				assert.equal(
					(
						await app.inject({
							url: `${prefixo}/me`,
							headers: { cookie: cookie(inicial) }
						})
					).statusCode,
					401
				)
				assert.equal(
					(
						await app.inject(
							`${prefixo}/me?access_token=${inicial.json().access_token}`
						)
					).statusCode,
					401
				)
			}
		)
		await t.test(
			'permissões atuais, desativação e expiração prevalecem sobre o JWT',
			async () => {
				const app = await servidor()
				const inicial = await login(app)
				await db.query(
					"DELETE FROM app.usuario_permissoes WHERE permissao = 'etl:reprocessar'"
				)
				assert.equal(
					(
						await app.inject({
							method: 'POST',
							url: '/api/teste/reprocessar?admin=true',
							headers: { ...bearer(inicial), 'x-role': 'admin' }
						})
					).statusCode,
					403
				)
				assert.equal(
					(
						await app.inject({
							url: '/api/teste/etl',
							headers: bearer(inicial)
						})
					).statusCode,
					200
				)
				await db.query('UPDATE app.usuarios SET ativo = false')
				assert.equal(
					(await app.inject({ url: `${prefixo}/me`, headers: bearer(inicial) }))
						.statusCode,
					401
				)
				assert.equal((await login(app)).statusCode, 401)
				await db.query('UPDATE app.usuarios SET ativo = true')
				await db.query(
					"UPDATE app.sessoes SET expira_em = now() - interval '1 second'"
				)
				assert.equal(
					(await app.inject({ url: `${prefixo}/me`, headers: bearer(inicial) }))
						.statusCode,
					401
				)
				assert.equal(
					(await post(app, 'renovar', cookie(inicial))).statusCode,
					401
				)
				await db.query(
					"INSERT INTO app.usuario_permissoes SELECT id, 'etl:reprocessar' FROM app.usuarios"
				)
			}
		)
		await t.test(
			'reutilização sequencial ou concorrente do refresh revoga toda a sessão',
			async () => {
				const app = await servidor()
				const inicial = await login(app)
				const primeira = await post(app, 'renovar', cookie(inicial))
				assert.equal(primeira.statusCode, 200)
				assert.equal(
					(await post(app, 'renovar', cookie(inicial))).statusCode,
					401
				)
				assert.equal(
					(
						await app.inject({
							url: `${prefixo}/me`,
							headers: bearer(primeira)
						})
					).statusCode,
					401
				)
				const nova = await login(app)
				const concorrentes = await Promise.all([
					post(app, 'renovar', cookie(nova)),
					post(app, 'renovar', cookie(nova))
				])
				assert.deepEqual(
					concorrentes.map((r) => r.statusCode).sort(),
					[200, 401]
				)
				const sucesso = concorrentes.find((r) => r.statusCode === 200)!
				assert.equal(
					(await app.inject({ url: `${prefixo}/me`, headers: bearer(sucesso) }))
						.statusCode,
					401
				)
			}
		)
		await t.test(
			'troca de senha exige a atual, mantém esta sessão e revoga as demais',
			async () => {
				const app = await servidor()
				const atual = await login(app)
				const outra = await login(app, { email, senha }, '127.0.0.2')
				const trocar = (
					autorizacao: Record<string, string>,
					payload: object,
					headers: Record<string, string> = csrf
				) =>
					app.inject({
						method: 'POST',
						url: `${prefixo}/senha`,
						headers: { ...headers, ...autorizacao },
						payload
					})
				const nova = 'outra senha longa sintética'
				const hashAntes = (
					await db.query('SELECT senha_hash FROM app.usuarios')
				).rows[0].senha_hash
				const valida = { senha_atual: senha, nova_senha: nova }
				assert.equal((await trocar({}, valida)).statusCode, 401)
				assert.equal(
					(await trocar(bearer(atual), valida, { origin: config.origin }))
						.statusCode,
					403
				)
				assert.equal(
					(
						await trocar(bearer(atual), {
							senha_atual: senha,
							nova_senha: 'curta'
						})
					).statusCode,
					400
				)
				const errada = await trocar(bearer(atual), {
					senha_atual: 'errada',
					nova_senha: nova
				})
				assert.equal(errada.statusCode, 422)
				assert.equal(errada.json().erro, 'SENHA_ATUAL_INCORRETA')
				assert.equal(
					(await db.query('SELECT senha_hash FROM app.usuarios')).rows[0]
						.senha_hash,
					hashAntes
				)
				const corrida = await Promise.all([
					trocar(bearer(atual), valida),
					trocar(bearer(atual), valida)
				])
				assert.deepEqual(corrida.map((r) => r.statusCode).sort(), [204, 422])
				for (const [resposta, esperado] of [
					[atual, 200],
					[outra, 401]
				] as const) {
					assert.equal(
						(
							await app.inject({
								url: `${prefixo}/me`,
								headers: bearer(resposta)
							})
						).statusCode,
						esperado
					)
					assert.equal(
						(await post(app, 'renovar', cookie(resposta))).statusCode,
						esperado
					)
				}
				assert.equal(
					(await login(app, { email, senha }, '127.0.0.3')).statusCode,
					401
				)
				assert.equal(
					(await login(app, { email, senha: nova }, '127.0.0.4')).statusCode,
					200
				)
				const logado = await login(app, { email, senha: nova }, '127.0.0.5')
				assert.equal(
					(
						await trocar(bearer(logado), {
							senha_atual: nova,
							nova_senha: senha
						})
					).statusCode,
					204
				)
				const texto = logs.join('')
				assert.ok(!texto.includes(nova))
			}
		)
		await t.test(
			'troca de senha limita tentativas por conta autenticada',
			async () => {
				const app = await servidor()
				const sessao = await login(app)
				const tentar = () =>
					app.inject({
						method: 'POST',
						url: `${prefixo}/senha`,
						headers: { ...csrf, ...bearer(sessao) },
						payload: {
							senha_atual: 'errada',
							nova_senha: 'qualquer senha longa'
						}
					})
				for (let i = 0; i < 5; i++)
					assert.equal((await tentar()).statusCode, 422)
				const limitado = await tentar()
				assert.equal(limitado.statusCode, 429)
				assert.ok(Number(limitado.headers['retry-after']) > 0)
			}
		)
		await t.test(
			'CSRF, validação, cookie Secure e contrato Swagger',
			async () => {
				const app = await servidor(true)
				for (const rota of ['login', 'renovar', 'logout']) {
					for (const headers of [
						{},
						{ origin: config.origin },
						{ ...csrf, origin: 'https://invasor.example.com' }
					]) {
						assert.equal(
							(
								await app.inject({
									method: 'POST',
									url: `${prefixo}/${rota}`,
									headers
								})
							).statusCode,
							403
						)
					}
				}
				assert.equal(
					(
						await app.inject({
							method: 'POST',
							url: `${prefixo}/login`,
							headers: csrf,
							payload: { email, senha, admin: true }
						})
					).statusCode,
					400
				)
				assert.equal(
					(await login(app, { email: 'invalido', senha })).statusCode,
					400
				)
				const inicial = await login(app)
				assert.equal(inicial.statusCode, 200)
				assert.match(
					String(inicial.headers['set-cookie']),
					/^__Secure-tcc_refresh=/
				)
				assert.match(String(inicial.headers['set-cookie']), /; Secure/)
				assert.equal(
					(await post(app, 'renovar', cookie(inicial))).statusCode,
					200
				)
				const swagger = (await app.inject('/docs/json')).json()
				assert.equal(
					swagger.components.securitySchemes.bearerAuth.scheme,
					'bearer'
				)
				assert.deepEqual(swagger.paths[`${prefixo}/me`].get.security, [
					{ bearerAuth: [] }
				])
				assert.equal((await app.inject('/health')).statusCode, 200)
			}
		)
		await t.test(
			'login tem erro genérico e limita tentativas por IP e por conta',
			async () => {
				const app = await servidor()
				const errado = await login(app, { email, senha: 'errada' })
				const inexistente = await login(app, {
					email: 'naoexiste@example.com',
					senha
				})
				assert.equal(errado.statusCode, 401)
				assert.equal(errado.body, inexistente.body)
				for (let i = 0; i < 3; i++)
					assert.equal(
						(await login(app, { email: `outro${i}@example.com`, senha }))
							.statusCode,
						401
					)
				const limitado = await login(app)
				assert.equal(limitado.statusCode, 429)
				assert.ok(Number(limitado.headers['retry-after']) > 0)
				const outroApp = await servidor()
				for (let i = 1; i <= 5; i++)
					assert.equal(
						(
							await login(
								outroApp,
								{ email: email.toUpperCase(), senha: 'errada' },
								`127.0.0.${i}`
							)
						).statusCode,
						401
					)
				assert.equal(
					(await login(outroApp, { email, senha }, '127.0.0.6')).statusCode,
					429
				)
			}
		)
		await t.test(
			'logs não contêm senha, e-mail, cookies ou JWT; falha de banco fecha acesso',
			async () => {
				const app = await servidor()
				const inicial = await login(app)
				const jwt = inicial.json().access_token
				const refresh = cookie(inicial).split('=')[1]!
				await owner.query(`REVOKE SELECT ON app.sessoes FROM "${role}"`)
				const falha = await app.inject({
					url: `${prefixo}/me`,
					headers: bearer(inicial)
				})
				assert.equal(falha.statusCode, 500)
				assert.ok(!falha.body.includes('sessoes'))
				await owner.query(`GRANT SELECT ON app.sessoes TO "${role}"`)
				const texto = logs.join('')
				for (const segredo of [
					senha,
					email,
					jwt,
					refresh,
					'senha_hash',
					'permission denied'
				])
					assert.ok(!texto.includes(segredo), segredo)
			}
		)
		await t.test(
			'consultas públicas continuam sem login quando a autenticação está habilitada',
			async () => {
				await db.query('DROP SCHEMA gold CASCADE')
				await db.query(
					await readFile(
						new URL('../fixtures/gold-schema.sql', import.meta.url),
						'utf8'
					)
				)
				await db.query(
					await readFile(
						new URL('../fixtures/dados.sql', import.meta.url),
						'utf8'
					)
				)
				const grants = await readFile(
					new URL('../../sql/permissoes.sql', import.meta.url),
					'utf8'
				)
				// Somente nesta fixture a conexão de consulta compartilha a role do teste.
				await db.query(grants.replaceAll(':"api_role"', `"${role}"`))
				const app = await servidor()
				for (const url of [
					'/api/v1/filtros',
					'/api/v1/indicadores/resumo?ano=2023',
					'/api/v1/analises/evolucao-temporal?ano_inicial=2022&ano_final=2023',
					'/api/v1/analises/comparacoes?ano=2023&agrupar_por=curso',
					'/api/v1/analises/dispersao?ano=2023'
				]) {
					assert.equal((await app.inject(url)).statusCode, 200)
				}
			}
		)
	}
)
