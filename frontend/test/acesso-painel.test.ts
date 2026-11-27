import assert from 'node:assert/strict'
import { test } from 'node:test'
import { estadoAcesso } from '../src/modules/autenticacao/regras.ts'
import { consultar, definirCredencial, ErroHttp } from '../src/lib/http.ts'

const leitor = { permissoes: ['painel:consultar'] }
const admin = { permissoes: ['etl:consultar', 'etl:reprocessar'] }

test('painel público fica liberado com ou sem sessão', () => {
	const publico = { painel_restrito: false }
	assert.equal(estadoAcesso(publico, null, true), 'liberado')
	assert.equal(estadoAcesso(publico, admin, false), 'liberado')
})

test('painel restrito pede login, verifica a permissão e trata carregamento e erro', () => {
	const restrito = { painel_restrito: true }
	assert.equal(estadoAcesso(null, null, false), 'carregando')
	assert.equal(estadoAcesso('erro', null, false), 'erro')
	assert.equal(estadoAcesso(restrito, null, true), 'carregando')
	assert.equal(estadoAcesso(restrito, null, false), 'login')
	assert.equal(estadoAcesso(restrito, admin, false), 'sem_permissao')
	assert.equal(estadoAcesso(restrito, leitor, false), 'liberado')
})

function simularFetch(respostas: number[]) {
	const chamadas: (string | undefined)[] = []
	const original = globalThis.fetch
	globalThis.fetch = (async (_url: string, init?: RequestInit) => {
		chamadas.push(
			(init?.headers as Record<string, string> | undefined)?.Authorization
		)
		const status = respostas.shift() ?? 200
		return new Response(JSON.stringify({ ok: true }), { status })
	}) as typeof fetch
	return { chamadas, restaurar: () => (globalThis.fetch = original) }
}

test('consultas levam o Bearer e, num 401, renovam uma vez e repetem', async (t) => {
	const { chamadas, restaurar } = simularFetch([401, 200])
	t.after(() => {
		restaurar()
		definirCredencial(null)
	})
	definirCredencial({
		token: async () => 'antigo',
		renovar: async () => 'novo'
	})
	const signal = new AbortController().signal
	assert.deepEqual(await consultar('/api/v1/filtros', signal), { ok: true })
	assert.deepEqual(chamadas, ['Bearer antigo', 'Bearer novo'])
})

test('sem sessão, a consulta sai sem Bearer e o 401 chega à tela', async (t) => {
	const { chamadas, restaurar } = simularFetch([401])
	t.after(() => {
		restaurar()
		definirCredencial(null)
	})
	definirCredencial({ token: async () => null, renovar: async () => null })
	await assert.rejects(
		consultar('/api/v1/filtros', new AbortController().signal),
		(erro: unknown) => erro instanceof ErroHttp && erro.status === 401
	)
	assert.deepEqual(chamadas, [undefined])
})
