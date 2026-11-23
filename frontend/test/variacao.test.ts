import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
	variacaoTaxa,
	variacaoTotal
} from '../src/modules/indicadores/variacao.ts'

test('variação de taxa em pontos percentuais, sem confundir ausência com zero', () => {
	assert.deepEqual(variacaoTaxa(0.15, 0.1), {
		direcao: 'alta',
		texto: '5 p.p.'
	})
	assert.deepEqual(variacaoTaxa(0.1, 0.112), {
		direcao: 'queda',
		texto: '1,2 p.p.'
	})
	assert.deepEqual(variacaoTaxa(0.1, 0.1004), {
		direcao: 'estavel',
		texto: '0 p.p.'
	})
	assert.deepEqual(variacaoTaxa(-0.122, 0.09), {
		direcao: 'queda',
		texto: '21,2 p.p.'
	})
	assert.equal(variacaoTaxa(null, 0.1), null)
	assert.equal(variacaoTaxa(0.1, null), null)
	assert.deepEqual(variacaoTaxa(0, 0), { direcao: 'estavel', texto: '0 p.p.' })
})

test('variação de total é relativa e exige base anterior positiva', () => {
	assert.deepEqual(variacaoTotal(100, 1000), {
		direcao: 'queda',
		texto: '90%'
	})
	assert.deepEqual(variacaoTotal(1090.5, 1000), {
		direcao: 'alta',
		texto: '9,1%'
	})
	assert.deepEqual(variacaoTotal(5, 5), { direcao: 'estavel', texto: '0%' })
	assert.equal(variacaoTotal(10, 0), null)
	assert.equal(variacaoTotal(null, 10), null)
	assert.equal(variacaoTotal(10, null), null)
})
