import { randomUUID } from 'node:crypto'
import type { Pool } from 'pg'
import type { Permissao } from '../modules/autenticacao/repositorio.js'
import { criarHash } from '../modules/autenticacao/senhas.js'

export function normalizarEmail(email: string) {
	const normalizado = email.trim().toLowerCase()
	if (
		normalizado.length > 254 ||
		!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizado)
	)
		throw new Error('E-mail inválido')
	return normalizado
}

async function criarConta(
	pool: Pool,
	email: string,
	senha: string,
	permissoes: Permissao[]
) {
	const normalizado = normalizarEmail(email)
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
			'INSERT INTO app.usuario_permissoes (usuario_id, permissao) SELECT $1, unnest($2::text[])',
			[id, permissoes]
		)
		await client.query('COMMIT')
	} catch (error) {
		await client.query('ROLLBACK')
		throw error
	} finally {
		client.release()
	}
}

export function criarAdministrador(pool: Pool, email: string, senha: string) {
	return criarConta(pool, email, senha, [
		'etl:consultar',
		'etl:reprocessar',
		'painel:consultar'
	])
}

// Leitor: só consulta o painel quando ele é restrito.
export function criarLeitor(pool: Pool, email: string, senha: string) {
	return criarConta(pool, email, senha, ['painel:consultar'])
}

// Desativa a conta e revoga as sessões abertas; não apaga dados. Devolve
// false se o e-mail não existe.
export async function desativarConta(pool: Pool, email: string) {
	const normalizado = normalizarEmail(email)
	const client = await pool.connect()
	try {
		await client.query('BEGIN')
		const conta = await client.query<{ id: string }>(
			'UPDATE app.usuarios SET ativo = false WHERE email = $1 RETURNING id',
			[normalizado]
		)
		const id = conta.rows[0]?.id
		if (id)
			await client.query(
				'UPDATE app.sessoes SET revogada_em = now() WHERE usuario_id = $1 AND revogada_em IS NULL',
				[id]
			)
		await client.query('COMMIT')
		return !!id
	} catch (error) {
		await client.query('ROLLBACK')
		throw error
	} finally {
		client.release()
	}
}
