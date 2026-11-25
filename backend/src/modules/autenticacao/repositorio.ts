import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { Pool } from 'pg'

export const permissoes = ['etl:consultar', 'etl:reprocessar'] as const
export type Permissao = (typeof permissoes)[number]
export interface Identidade {
	id: string
	email: string
	permissoes: Permissao[]
}
interface Usuario extends Identidade {
	senha_hash: string
	ativo: boolean
}
interface Sessao {
	id: string
	usuario_id: string
	expira_em: Date
	revogada_em: Date | null
}
export const hashToken = (token: string) =>
	createHash('sha256').update(token).digest('hex')
const novoToken = () => randomBytes(32).toString('base64url')
const consultaIdentidade = `SELECT u.id, u.email,
	ARRAY(SELECT permissao FROM app.usuario_permissoes p WHERE p.usuario_id = u.id ORDER BY permissao) AS permissoes
	FROM app.usuarios u JOIN app.sessoes s ON s.usuario_id = u.id
	WHERE s.id = $1 AND u.ativo AND s.revogada_em IS NULL AND s.expira_em > now()`

export function criarRepositorioAutenticacao(pool: Pool) {
	return {
		async usuario(email: string) {
			const r = await pool.query<Usuario>(
				'SELECT id, email, senha_hash, ativo FROM app.usuarios WHERE email = $1',
				[email]
			)
			return r.rows[0]
		},
		async identidade(sessao: string) {
			return (await pool.query<Identidade>(consultaIdentidade, [sessao]))
				.rows[0]
		},
		async abrirSessao(usuario: string) {
			const client = await pool.connect()
			try {
				await client.query('BEGIN')
				const id = randomUUID(),
					token = novoToken()
				const result = await client.query<Sessao>(
					`INSERT INTO app.sessoes (id, usuario_id)
					SELECT $1, id FROM app.usuarios WHERE id = $2 AND ativo RETURNING *`,
					[id, usuario]
				)
				if (!result.rows[0]) {
					await client.query('ROLLBACK')
					return undefined
				}
				await client.query(
					'INSERT INTO app.tokens_renovacao (hash, sessao_id) VALUES ($1, $2)',
					[hashToken(token), id]
				)
				await client.query('COMMIT')
				return { ...result.rows[0], token }
			} catch (error) {
				await client.query('ROLLBACK')
				throw error
			} finally {
				client.release()
			}
		},
		async renovar(token: string) {
			const client = await pool.connect()
			try {
				await client.query('BEGIN')
				// Todos os caminhos de rotação serializam pelo mesmo lock de sessão.
				const result = await client.query<Sessao>(
					`SELECT s.* FROM app.sessoes s
					JOIN app.tokens_renovacao t ON t.sessao_id = s.id WHERE t.hash = $1 FOR UPDATE OF s`,
					[hashToken(token)]
				)
				const sessao = result.rows[0]
				if (!sessao) {
					await client.query('ROLLBACK')
					return undefined
				}
				const consumido = await client.query(
					'SELECT usado_em FROM app.tokens_renovacao WHERE hash = $1',
					[hashToken(token)]
				)
				const identidade = (
					await client.query<Identidade>(consultaIdentidade, [sessao.id])
				).rows[0]
				if (consumido.rows[0].usado_em || !identidade) {
					await client.query(
						'UPDATE app.sessoes SET revogada_em = COALESCE(revogada_em, now()) WHERE id = $1',
						[sessao.id]
					)
					await client.query('COMMIT')
					return undefined
				}
				const novo = novoToken()
				await client.query(
					'UPDATE app.tokens_renovacao SET usado_em = now() WHERE hash = $1',
					[hashToken(token)]
				)
				await client.query(
					'INSERT INTO app.tokens_renovacao (hash, sessao_id) VALUES ($1, $2)',
					[hashToken(novo), sessao.id]
				)
				await client.query('COMMIT')
				return { ...sessao, token: novo, identidade }
			} catch (error) {
				await client.query('ROLLBACK')
				throw error
			} finally {
				client.release()
			}
		},
		// Só troca se o hash ainda for o conferido: de duas trocas simultâneas, uma falha.
		async trocarSenha(
			usuario: string,
			sessaoAtual: string,
			hashAnterior: string,
			hashNovo: string
		) {
			const client = await pool.connect()
			try {
				await client.query('BEGIN')
				const result = await client.query(
					`UPDATE app.usuarios SET senha_hash = $3
					WHERE id = $1 AND ativo AND senha_hash = $2`,
					[usuario, hashAnterior, hashNovo]
				)
				if (!result.rowCount) {
					await client.query('ROLLBACK')
					return false
				}
				await client.query(
					`UPDATE app.sessoes SET revogada_em = now()
					WHERE usuario_id = $1 AND id <> $2 AND revogada_em IS NULL`,
					[usuario, sessaoAtual]
				)
				await client.query('COMMIT')
				return true
			} catch (error) {
				await client.query('ROLLBACK')
				throw error
			} finally {
				client.release()
			}
		},
		async revogar(token: string) {
			await pool.query(
				`UPDATE app.sessoes SET revogada_em = COALESCE(revogada_em, now())
				WHERE id = (SELECT sessao_id FROM app.tokens_renovacao WHERE hash = $1)`,
				[hashToken(token)]
			)
		}
	}
}

export type RepositorioAutenticacao = ReturnType<
	typeof criarRepositorioAutenticacao
>
