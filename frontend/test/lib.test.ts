import assert from 'node:assert/strict'
import { test } from 'node:test'
import { empilhar, exibicao } from '../src/lib/exibicao.ts'
import { ErroHttp, mensagemErro } from '../src/lib/http.ts'

test('exibição usa a resposta atual ou, durante a recarga, a última válida', () => {
	assert.deepEqual(exibicao('novo', 'velho', false), {
		dado: 'novo',
		atualizando: false
	})
	assert.deepEqual(exibicao(undefined, 'velho', true), {
		dado: 'velho',
		atualizando: true
	})
	// Sem recarga em curso, a última não fica presa na tela.
	assert.deepEqual(exibicao(undefined, 'velho', false), {
		dado: null,
		atualizando: false
	})
	assert.deepEqual(exibicao(undefined, null, true), {
		dado: null,
		atualizando: false
	})
	// Última sem dados não é reaproveitada (não deixa área em branco).
	const semDados = (dado: { vazio: boolean }) => !dado.vazio
	assert.deepEqual(exibicao(undefined, { vazio: true }, true, semDados), {
		dado: null,
		atualizando: false
	})
})

test('histórico para desfazer guarda os últimos estados até o limite', () => {
	assert.deepEqual(empilhar([], 'a'), ['a'])
	assert.deepEqual(empilhar(['a', 'b'], 'c', 2), ['b', 'c'])
	const cheio = Array.from({ length: 20 }, (_, i) => i)
	assert.equal(empilhar(cheio, 20).length, 20)
	assert.equal(empilhar(cheio, 20).at(-1), 20)
})

test('erro 429 orienta aguardar; outros erros usam a mensagem do painel', () => {
	assert.match(
		mensagemErro(new ErroHttp(429), 'Falhou.'),
		/Aguarde alguns segundos/
	)
	assert.equal(mensagemErro(new ErroHttp(503), 'Falhou.'), 'Falhou.')
	assert.equal(mensagemErro(new Error('rede'), 'Falhou.'), 'Falhou.')
})
