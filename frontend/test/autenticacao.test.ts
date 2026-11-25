import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
	MARGEM_RENOVACAO_MS,
	mensagemLogin,
	precisaRenovar
} from '../src/modules/autenticacao/regras.ts'

test('renova o JWT dentro da margem antes da expiração, não antes', () => {
	const agora = 1_000_000
	assert.equal(precisaRenovar(agora + 10 * 60_000, agora), false)
	assert.equal(precisaRenovar(agora + MARGEM_RENOVACAO_MS + 1, agora), false)
	assert.equal(precisaRenovar(agora + MARGEM_RENOVACAO_MS, agora), true)
	assert.equal(precisaRenovar(agora - 1, agora), true)
})

test('credencial recusada não indica se o e-mail ou a senha falhou', () => {
	assert.match(mensagemLogin(401), /e-mail ou senha/i)
})

test('cada falha de login orienta a ação certa', () => {
	assert.match(mensagemLogin(null), /conexão/i)
	assert.match(mensagemLogin(400), /e-mail válido/i)
	assert.match(mensagemLogin(429), /aguarde/i)
	assert.match(mensagemLogin(403), /endereço/i)
	assert.match(mensagemLogin(404), /não está habilitado/i)
	assert.doesNotMatch(mensagemLogin(403), /tente novamente/i)
})

test('falhas do servidor e status inesperados usam a mesma mensagem', () => {
	const padrao = mensagemLogin(500)
	for (const status of [503, 408, 413, 418])
		assert.equal(mensagemLogin(status), padrao, `status: ${status}`)
	for (const status of [null, 400, 401, 403, 404, 429])
		assert.notEqual(mensagemLogin(status), padrao, `status: ${status}`)
})
