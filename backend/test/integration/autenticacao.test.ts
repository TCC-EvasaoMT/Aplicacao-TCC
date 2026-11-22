import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { Pool } from 'pg'
import { migrarApp } from '../../src/database/migracoes.js'
import { criarAdministrador } from '../../src/database/administradores.js'

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
		t.after(async () => {
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
	}
)
