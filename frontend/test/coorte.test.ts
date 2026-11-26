import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Coorte, PontoCoorte } from '../src/modules/analises/api.ts'
import { plural } from '../src/modules/analises/apresentacao.ts'
import {
	avisosTurma,
	lerTaxaTurma,
	lerTurma,
	serializarCoorte,
	ultimoAnoCompleto
} from '../src/modules/analises/coorte.ts'
import { csvCoorte } from '../src/modules/analises/exportacao.ts'
import { limparFiltros } from '../src/modules/indicadores/filtros.ts'

function ponto(
	ano: number,
	evadiu: number | null,
	qualidade: Partial<PontoCoorte['qualidade']> = {}
): PontoCoorte {
	return {
		ano,
		anos_desde_ingresso: ano - 2022,
		totais: {
			vinculos_total: 100,
			concluintes_total: 0,
			alunos_cursando: 90,
			alunos_desvinculados: 6,
			alunos_transferidos: 2,
			alunos_matricula_trancada: 2,
			alunos_falecidos: 0
		},
		acumulados: { evadidos: 8, desvinculados: 6, concluintes: 0 },
		continua: 92,
		taxas: {
			evadiu,
			evadiu_ies: evadiu,
			concluiu: evadiu === null ? null : 0,
			continua: evadiu === null ? null : 0.92,
			residuo: evadiu === null ? null : 0
		},
		qualidade: {
			sem_dados: false,
			registros: 1,
			cursos_iniciais_ausentes: 0,
			registros_fora_da_turma: 0,
			vinculos_fora_da_turma: null,
			dados_incompletos: false,
			flag_valor_negativo: false,
			flag_grupo_pequeno: false,
			...qualidade
		}
	}
}

test('consulta da turma usa os filtros do painel, sem o ano do resumo', () => {
	const selecao = { ...limparFiltros('2023'), codigo_area_geral: '01' }
	assert.equal(
		serializarCoorte(selecao, '2019'),
		'codigo_area_geral=01&ano_ingresso=2019'
	)
})

test('turma vem da URL se estiver no catálogo; senão, a mais antiga', () => {
	const anos = [2023, 2022, 2021]
	assert.equal(lerTurma(new URLSearchParams('turma=2022'), anos), '2022')
	assert.equal(lerTurma(new URLSearchParams('turma=1999'), anos), '2021')
	assert.equal(lerTurma(new URLSearchParams(''), anos), '2021')
	assert.equal(lerTurma(new URLSearchParams(''), []), '')
	assert.equal(lerTaxaTurma(new URLSearchParams('')), 'evadiu')
	assert.equal(
		lerTaxaTurma(new URLSearchParams('taxa_turma=evadiu_ies')),
		'evadiu_ies'
	)
})

test('frase usa o último ano com as três proporções', () => {
	const coorte: Coorte = {
		tamanho_inicial: 100,
		base_minima: 30,
		cursos_iniciais: 1,
		serie: [ponto(2022, 0.08), ponto(2023, 0.15), ponto(2024, null)]
	}
	assert.equal(ultimoAnoCompleto(coorte, 'evadiu')?.ano, 2023)
	assert.equal(
		ultimoAnoCompleto({ ...coorte, serie: [ponto(2024, null)] }, 'evadiu'),
		null
	)
})

test('avisos da turma explicam ausências, cursos fora e turma pequena', () => {
	assert.deepEqual(
		avisosTurma(ponto(2024, null, { sem_dados: true, registros: 0 }), plural),
		['Sem linhas da turma neste ano']
	)
	assert.deepEqual(
		avisosTurma(
			ponto(2023, 0.15, {
				cursos_iniciais_ausentes: 2,
				registros_fora_da_turma: 1,
				flag_valor_negativo: true,
				flag_grupo_pequeno: true
			}),
			plural
		),
		[
			'2 cursos da turma sem linha no ano',
			'1 registro de cursos sem linha inicial fora da turma',
			'Valores negativos na origem',
			'Turma inicial inferior a 30'
		]
	)
})

test('CSV da turma traz ingresso, tamanho inicial e proporções sem arredondar', () => {
	const [cabecalho, primeira] = csvCoorte(
		2022,
		100,
		[ponto(2022, 0.08)],
		'ano_ingresso=2022'
	).split('\r\n')
	assert.ok(
		cabecalho?.startsWith('Ano de ingresso;Tamanho inicial;Ano do censo')
	)
	assert.ok(
		primeira?.startsWith('2022;100;2022;0;100;0,08;0,08;0;0,92;0;não;0;0;;')
	)
	assert.ok(primeira?.endsWith(';ano_ingresso=2022'))
})
