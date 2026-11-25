import { ErroHttp } from '../../lib/http'

export interface Usuario {
	id: string
	email: string
	permissoes: string[]
}

export interface RespostaToken {
	access_token: string
	expires_in: number
	usuario: Usuario
}

const base = '/api/v1/autenticacao'

async function postar(caminho: string, corpo?: unknown) {
	const response = await fetch(`${base}/${caminho}`, {
		method: 'POST',
		credentials: 'same-origin',
		headers: {
			Accept: 'application/json',
			'X-CSRF-Protection': '1',
			...(corpo === undefined ? {} : { 'Content-Type': 'application/json' })
		},
		body: corpo === undefined ? undefined : JSON.stringify(corpo)
	})
	if (!response.ok) throw new ErroHttp(response.status)
	return response
}

export async function entrar(email: string, senha: string) {
	const response = await postar('login', { email, senha })
	return response.json() as Promise<RespostaToken>
}

export async function renovar() {
	const response = await postar('renovar')
	return response.json() as Promise<RespostaToken>
}

export async function sair() {
	await postar('logout')
}
