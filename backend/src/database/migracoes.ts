import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import type { Pool } from 'pg'

export async function migrarApp(pool: Pool) {
	const pasta = new URL('../../sql/migrations/', import.meta.url)
	const arquivos = (await readdir(pasta))
		.filter((x) => /^\d+_[a-z_]+\.sql$/.test(x))
		.sort()
	const client = await pool.connect()
	try {
		await client.query('BEGIN')
		await client.query('SELECT pg_advisory_xact_lock(734921, 1)')
		const schema = await client.query("SELECT to_regnamespace('app') AS nome")
		if (!schema.rows[0]?.nome)
			throw new Error('Crie o schema app com seu dono antes das migrações')
		await client.query('REVOKE ALL ON SCHEMA app FROM PUBLIC')
		await client.query(`CREATE TABLE IF NOT EXISTS app.migracoes (
			versao text PRIMARY KEY, checksum text NOT NULL,
			aplicado_em timestamptz NOT NULL DEFAULT now())`)
		for (const arquivo of arquivos) {
			const sql = await readFile(new URL(arquivo, pasta), 'utf8')
			const checksum = createHash('sha256')
				.update(sql.replaceAll('\r\n', '\n'))
				.digest('hex')
			const existente = await client.query<{ checksum: string }>(
				'SELECT checksum FROM app.migracoes WHERE versao = $1',
				[arquivo]
			)
			if (existente.rows[0]) {
				if (existente.rows[0].checksum !== checksum)
					throw new Error(`Migração já aplicada foi alterada: ${arquivo}`)
				continue
			}
			await client.query(sql)
			await client.query(
				'INSERT INTO app.migracoes (versao, checksum) VALUES ($1, $2)',
				[arquivo, checksum]
			)
		}
		await client.query('COMMIT')
	} catch (error) {
		await client.query('ROLLBACK')
		throw error
	} finally {
		client.release()
	}
}
