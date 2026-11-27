import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
	criarHash,
	verificarSenha
} from '../src/modules/autenticacao/senhas.js'
import { configurarAutenticacao } from '../src/config/autenticacao.js'

test('Argon2id preserva a senha, usa salt e rejeita senhas fora dos limites', async () => {
	const senha = 'uma senha longa para teste'
	const a = await criarHash(senha)
	const b = await criarHash(senha)
	assert.match(a, /^\$argon2id\$/)
	assert.notEqual(a, b)
	assert.equal(await verificarSenha(a, senha), true)
	assert.equal(await verificarSenha(a, senha + ' '), false)
	for (const tamanho of [7, 65]) {
		await assert.rejects(criarHash('😀'.repeat(tamanho)), /8 e 64/)
	}
	for (const tamanho of [8, 64]) {
		const limite = '😀'.repeat(tamanho)
		assert.equal(await verificarSenha(await criarHash(limite), limite), true)
	}
})

test('autenticação não aceita configuração parcial ou origem insegura em produção', () => {
	assert.equal(configurarAutenticacao({}), undefined)
	assert.throws(() => configurarAutenticacao({ AUTH_ENABLED: 'yes' }))
	const env = {
		AUTH_ENABLED: 'true',
		AUTH_JWT_SECRET: 'ab'.repeat(32),
		AUTH_ORIGIN: 'http://127.0.0.1:3000',
		POSTGRES_DB: 'teste',
		APP_POSTGRES_USER: 'auth',
		APP_POSTGRES_PASSWORD: 'teste'
	}
	assert.equal(configurarAutenticacao(env)?.secure, false)
	assert.throws(() =>
		configurarAutenticacao({ ...env, AUTH_JWT_SECRET: 'curto' })
	)
	assert.throws(() => configurarAutenticacao({ ...env, APP_POSTGRES_USER: '' }))
	assert.throws(() =>
		configurarAutenticacao({ ...env, AUTH_ORIGIN: 'http://example.com' })
	)
	assert.throws(() =>
		configurarAutenticacao({ ...env, NODE_ENV: 'production' })
	)
	assert.equal(
		configurarAutenticacao({
			...env,
			NODE_ENV: 'production',
			AUTH_ORIGIN: 'https://painel.example.com'
		})?.secure,
		true
	)
})
