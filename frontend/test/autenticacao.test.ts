import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
	contarCaracteres,
	MARGEM_RENOVACAO_MS,
	mensagemLogin,
	mensagemTrocaSenha,
	precisaRenovar,
	validarNovaSenha
} from '../src/modules/autenticacao/regras.ts'

test('nova senha aceita os limites da API e rejeita tamanhos fora deles', () => {
	for (const tamanho of [0, 7, 65]) {
		const nova = 'a'.repeat(tamanho)
		assert.equal(validarNovaSenha('senha atual', nova, nova)?.campo, 'nova')
	}
	for (const tamanho of [8, 32, 64]) {
		const nova = 'a'.repeat(tamanho)
		assert.equal(validarNovaSenha('senha atual', nova, nova), null)
	}
})

test('nova senha conta caracteres como o servidor, não unidades UTF-16', () => {
	// Cada emoji ocupa 2 unidades UTF-16, mas é 1 caractere para a API.
	const emojis = (n: number) => '😀'.repeat(n)
	for (const n of [7, 65])
		assert.equal(
			validarNovaSenha('senha atual', emojis(n), emojis(n))?.campo,
			'nova',
			`${n} emojis`
		)
	for (const n of [8, 64])
		assert.equal(
			validarNovaSenha('senha atual', emojis(n), emojis(n)),
			null,
			`${n} emojis`
		)
	assert.equal(contarCaracteres('ação 😀'), 6)
})

test('nova senha precisa ser diferente da atual e ter confirmação idêntica', () => {
	const nova = 'Uma nova senha longa'
	assert.equal(validarNovaSenha(nova, nova, nova)?.campo, 'nova')
	for (const confirmacao of [
		'',
		'Outra senha longa',
		nova.toLowerCase(),
		`${nova} `
	]) {
		assert.equal(
			validarNovaSenha('senha atual', nova, confirmacao)?.campo,
			'confirmacao'
		)
	}
	assert.equal(validarNovaSenha('senha atual', nova, nova), null)
})

test('troca de senha distingue senha atual errada de sessão encerrada', () => {
	assert.match(mensagemTrocaSenha(422), /senha atual/i)
	assert.match(mensagemTrocaSenha(401), /entre novamente/i)
	assert.match(mensagemTrocaSenha(400), /8 e 64/)
	for (const status of [null, 403, 429])
		assert.equal(mensagemTrocaSenha(status), mensagemLogin(status))
})

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
