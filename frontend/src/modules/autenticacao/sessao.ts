import { ErroHttp } from '../../lib/http'
import {
	entrar,
	renovar,
	sair,
	trocarSenha,
	type RespostaToken,
	type Usuario
} from './api'
import { precisaRenovar } from './regras'

interface Sessao {
	token: string
	expiraEm: number
	usuario: Usuario
}

// JWT só em memória; a sessão longa fica no cookie HttpOnly.
let sessao: Sessao | null = null
let renovacao: Promise<Sessao | null> | null = null
let restauracao: Promise<Usuario | null> | null = null
const ouvintes = new Set<(usuario: Usuario | null) => void>()

// Evita chamar /renovar em toda visita anônima.
const MARCA = 'tcc-evasao:sessao'
const canal =
	typeof BroadcastChannel === 'function'
		? new BroadcastChannel('tcc-evasao-sessao')
		: null

function marcar(ativa: boolean) {
	try {
		if (ativa) localStorage.setItem(MARCA, '1')
		else localStorage.removeItem(MARCA)
	} catch {
		// Storage bloqueado: só não restaura a sessão ao recarregar.
	}
}

function temMarca() {
	try {
		return localStorage.getItem(MARCA) === '1'
	} catch {
		return false
	}
}

// Renovações não são anunciadas, para não dispará-las em cascata nas outras abas.
function definir(nova: Sessao | null, aviso?: 'entrou' | 'saiu') {
	sessao = nova
	marcar(!!nova)
	for (const ouvinte of ouvintes) ouvinte(nova?.usuario ?? null)
	if (aviso) canal?.postMessage(aviso)
}

function aplicar(resposta: RespostaToken, aviso?: 'entrou'): Sessao {
	const nova = {
		token: resposta.access_token,
		expiraEm: Date.now() + resposta.expires_in * 1000,
		usuario: resposta.usuario
	}
	definir(nova, aviso)
	return nova
}

// Reusar um cookie já rotacionado revoga a sessão, então renovações nunca
// correm juntas: na aba, a promessa é compartilhada; entre abas, o Web Lock enfileira.
function renovarSessao(): Promise<Sessao | null> {
	renovacao ??= comTrava(async () => {
		try {
			return aplicar(await renovar())
		} catch (erro) {
			// 401: sessão expirada/revogada; 404: autenticação desabilitada.
			if (erro instanceof ErroHttp && [401, 404].includes(erro.status)) {
				definir(null, sessao ? 'saiu' : undefined)
				return null
			}
			throw erro
		}
	}).finally(() => {
		renovacao = null
	})
	return renovacao
}

async function comTrava<T>(tarefa: () => Promise<T>): Promise<T> {
	return navigator.locks
		? await navigator.locks.request('tcc-evasao-renovacao', tarefa)
		: tarefa()
}

canal?.addEventListener('message', (evento) => {
	if (evento.data === 'saiu') definir(null)
	else if (evento.data === 'entrou' && !sessao) void renovarSessao()
})

export function observarSessao(ouvinte: (usuario: Usuario | null) => void) {
	ouvintes.add(ouvinte)
	return () => {
		ouvintes.delete(ouvinte)
	}
}

export const usuarioAtual = () => sessao?.usuario ?? null

export async function iniciarSessao(email: string, senha: string) {
	return aplicar(await entrar(email, senha), 'entrou').usuario
}

export function restaurarSessao() {
	restauracao ??= temMarca()
		? renovarSessao().then(
				(nova) => nova?.usuario ?? null,
				() => null
			)
		: Promise.resolve(null)
	return restauracao
}

export async function encerrarSessao() {
	try {
		await sair()
	} finally {
		definir(null, 'saiu')
	}
}

export async function alterarSenha(senhaAtual: string, novaSenha: string) {
	const token = await tokenAcesso()
	if (!token) throw new ErroHttp(401)
	try {
		await trocarSenha(token, senhaAtual, novaSenha)
	} catch (erro) {
		if (erro instanceof ErroHttp && erro.status === 401)
			definir(null, sessao ? 'saiu' : undefined)
		throw erro
	}
}

// Para as futuras rotas administrativas.
export async function tokenAcesso(): Promise<string | null> {
	if (sessao && !precisaRenovar(sessao.expiraEm, Date.now()))
		return sessao.token
	if (!sessao && !temMarca()) return null
	return (await renovarSessao())?.token ?? null
}
