import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { CursoDispersao, Dispersao } from '../src/modules/analises/api.ts'
import {
	contagensDispersao,
	lerTaxaDispersao,
	pontosDispersao,
	rotuloCurso,
	serializarDispersao,
	tetoMatriculas
} from '../src/modules/analises/dispersao.ts'
import { csvDispersao } from '../src/modules/analises/exportacao.ts'
import { limparFiltros } from '../src/modules/indicadores/filtros.ts'

function curso(
	codigo: string | null,
	matriculas: number | null,
	base: number | null,
	taxa: number | null,
	critica = false
): CursoDispersao {
	return {
		curso: { codigo, nome: codigo && `Curso ${codigo}` },
		totais: {
			vinculos_total: base,
			matriculas_total: matriculas,
			ingressantes_total: null,
			concluintes_total: null
		},
		base_risco: base,
		taxas: { evasao_curso: taxa, evasao_ies: taxa === null ? null : taxa / 2 },
		qualidade: {
			sem_dados: base === null,
			registros_com_alunos: base === null ? 0 : 1,
			registros_sem_alunos: 0,
			registros_sem_ingressantes: 0,
			ingressantes_minimo: false,
			dados_incompletos: false,
			flag_valor_negativo: false,
			flag_grupo_pequeno: base === null ? null : base < 30
		},
		zona_critica: { evasao_curso: critica, evasao_ies: false }
	}
}

const dados: Dispersao = {
	referencias: {
		base_minima: 30,
		alta_evasao: { evasao_curso: 0.2, evasao_ies: 0.1 },
		cursos_na_referencia: { evasao_curso: 3, evasao_ies: 3 },
		cursos_fora_da_referencia: { evasao_curso: 2, evasao_ies: 2 }
	},
	cursos: [
		curso('001', 70, 100, 0.15),
		curso('002', 600, 900, 0.25, true),
		curso('003', null, null, null), // só docentes
		curso('007', 12, 20, 0.25), // alta, mas base pequena
		curso('006', 20, 30, null) // medida ausente
	]
}

test('pontos separam zona crítica, base suficiente e base pequena', () => {
	const series = pontosDispersao(dados, 'evasao_curso')
	assert.deepEqual(
		series.critica.map((p) => p.codigo),
		['002']
	)
	assert.deepEqual(
		series.significativa.map((p) => p.codigo),
		['001']
	)
	assert.deepEqual(
		series.pequena.map((p) => p.codigo),
		['007']
	)
	assert.deepEqual(series.critica[0], {
		codigo: '002',
		rotulo: 'Curso 002 (002)',
		matriculas: 600,
		taxa: 0.25,
		base: 900,
		serie: 'critica'
	})
	// A zona crítica é a da taxa escolhida.
	assert.deepEqual(pontosDispersao(dados, 'evasao_ies').critica, [])
})

test('contagens distinguem cursos com e sem ponto no gráfico', () => {
	assert.deepEqual(contagensDispersao(dados, 'evasao_curso'), {
		cursos: 5,
		noGrafico: 3,
		semPonto: 2,
		criticos: 1,
		pequenos: 1
	})
})

test('dispersão ignora o filtro de curso, que só destaca', () => {
	const selecao = {
		...limparFiltros('2023'),
		codigo_curso: '001',
		modalidade: 'Presencial'
	}
	assert.equal(serializarDispersao(selecao), 'ano=2023&modalidade=Presencial')
})

test('taxa do eixo vem da URL e aceita só as duas taxas', () => {
	assert.equal(lerTaxaDispersao(new URLSearchParams('')), 'evasao_curso')
	assert.equal(
		lerTaxaDispersao(new URLSearchParams('taxa_dispersao=evasao_ies')),
		'evasao_ies'
	)
	assert.equal(
		lerTaxaDispersao(new URLSearchParams('taxa_dispersao=outra')),
		'evasao_curso'
	)
})

test('rótulo do curso usa nome e código, sem inventar nome', () => {
	assert.equal(
		rotuloCurso({ codigo: '001', nome: 'Pedagogia' }),
		'Pedagogia (001)'
	)
	assert.equal(rotuloCurso({ codigo: '001', nome: null }), '001')
	assert.equal(
		rotuloCurso({ codigo: null, nome: null }),
		'Não informado (sem identificador)'
	)
})

test('CSV da dispersão traz código como texto e a zona crítica de cada taxa', () => {
	const [cabecalho, primeira, segunda] = csvDispersao(
		dados.cursos.slice(0, 2),
		'ano=2023'
	).split('\r\n')
	assert.ok(cabecalho?.startsWith('Código do curso;Nome do curso;Vínculos'))
	assert.ok(
		cabecalho?.endsWith(
			'Zona crítica (evasão do curso);Zona crítica (evasão da instituição);Recorte'
		)
	)
	assert.ok(primeira?.startsWith('001;Curso 001;100;70;'))
	assert.ok(primeira?.endsWith(';não;não;ano=2023'))
	assert.ok(segunda?.endsWith(';sim;não;ano=2023'))
})

test('teto do eixo de matrículas é redondo e deixa folga sobre o maior valor', () => {
	assert.equal(tetoMatriculas(600), 700)
	assert.equal(tetoMatriculas(1288), 1500)
	assert.equal(tetoMatriculas(14.75), 20)
	assert.equal(tetoMatriculas(0), 1)
	for (const maior of [3, 47, 600, 1288, 9999])
		assert.ok(tetoMatriculas(maior) >= maior * 1.08, String(maior))
})
