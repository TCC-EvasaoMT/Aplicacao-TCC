import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
	csvComparacao,
	csvEvolucao,
	descreverRecorte,
	gerarCsv
} from '../src/modules/analises/exportacao.ts'
import type {
	GrupoComparacao,
	PontoTemporal
} from '../src/modules/analises/api.ts'

const ponto: PontoTemporal = {
	ano: 2023,
	base_risco: 20.5,
	totais: {
		vinculos_total: 20.5,
		matriculas_total: null,
		ingressantes_total: 2,
		concluintes_total: 0
	},
	taxas: { evasao_curso: 0.0366, evasao_ies: -0.122 },
	qualidade: {
		sem_dados: false,
		registros_com_alunos: 1,
		registros_sem_alunos: 0,
		registros_sem_ingressantes: 1,
		ingressantes_minimo: true,
		dados_incompletos: true,
		flag_valor_negativo: true,
		flag_grupo_pequeno: true
	}
}

test('CSV usa ponto e vírgula, vírgula decimal, aspas e protege fórmulas', () => {
	assert.equal(
		gerarCsv(
			['a', 'b'],
			[
				[1.5, 'x;y'],
				[null, 'diz "oi"'],
				[true, '=1+1']
			]
		),
		'a;b\r\n1,5;"x;y"\r\n;"diz ""oi"""\r\nsim;\'=1+1'
	)
	assert.equal(gerarCsv(['n'], [[-0.122], [false]]), 'n\r\n-0,122\r\nnão')
})

test('recorte lista parâmetros ativos e preserva zeros iniciais', () => {
	assert.equal(
		descreverRecorte({ ano: '2023', codigo_curso: '001', modalidade: '' }),
		'ano=2023; codigo_curso=001'
	)
	assert.equal(descreverRecorte({ modalidade: '' }), 'sem filtros')
})

test('CSV da evolução e da comparação preservam ausências, negativos e decimais', () => {
	const [cabecalho, linha] = csvEvolucao([ponto], 'codigo_curso=005').split(
		'\r\n'
	)
	assert.ok(cabecalho?.startsWith('Ano;Vínculos;Matrículas'))
	assert.equal(
		linha,
		'2023;20,5;;2;sim;0;20,5;0,0366;-0,122;não;1;0;1;sim;sim;sim;codigo_curso=005'
	)
	const grupo: GrupoComparacao = {
		...ponto,
		grupo: { valor: null, nome: null }
	}
	const [, primeira] = csvComparacao([grupo], 'sem filtros').split('\r\n')
	assert.ok(primeira?.startsWith(';;20,5;'))
})
