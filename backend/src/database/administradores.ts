import { randomUUID } from 'node:crypto'
import type { Pool } from 'pg'
import { criarHash } from '../modules/autenticacao/senhas.js'

export async function criarAdministrador(
	pool: Pool,
	email: string,
	senha: string
) {
	const normalizado = email.trim().toLowerCase()
	if (
		normalizado.length > 254 ||
		!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizado)
	)
		throw new Error('E-mail inválido')
	const senhaHash = await criarHash(senha)
	const client = await pool.connect()
	try {
		await client.query('BEGIN')
		const id = randomUUID()
		// INSERT simples: nunca substituir silenciosamente uma conta existente.
		await client.query(
			'INSERT INTO app.usuarios (id, email, senha_hash) VALUES ($1, $2, $3)',
			[id, normalizado, senhaHash]
		)
		await client.query(
			"INSERT INTO app.usuario_permissoes (usuario_id, permissao) VALUES ($1, 'etl:consultar'), ($1, 'etl:reprocessar')",
			[id]
		)
		await client.query('COMMIT')
	} catch (error) {
		await client.query('ROLLBACK')
		throw error
	} finally {
		client.release()
	}
}
