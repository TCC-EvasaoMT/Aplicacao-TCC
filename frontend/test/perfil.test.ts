import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { CategoriaPerfil, Perfil } from '../src/modules/analises/api.ts'
import { avisosDoRecorte } from '../src/modules/analises/apresentacao.ts'
import { csvPerfil } from '../src/modules/analises/exportacao.ts'
import {
	extremosPerfil,
	fatoresPerfil,
	larguraPerfil,
	lerFatorPerfil,
	lerTaxaPerfil,
	serializarPerfil
} from '../src/modules/analises/perfil.ts'
import { limparFiltros } from '../src/modules/indicadores/filtros.ts'

function categoria(
	codigo: string | null,
	nome: string,
	base: number | null,
	taxa: number | null
): CategoriaPerfil {
	return {
		categoria: { codigo, nome, ordem: 1 },
		totais: {
			vinculos_total: base,
			matriculas_total: null,
			concluintes_total: null,
			alunos_cursando: null,
			alunos_desvinculados: null,
			alunos_transferidos: null,
			alunos_matricula_trancada: null,
			alunos_falecidos: null
		} as CategoriaPerfil['totais'],
		base_risco: base,
		taxas: { evasao_curso: taxa, evasao_ies: taxa },
		qualidade: {
			sem_dados: base === null,
			registros_com_alunos: base === null ? 0 : 1,
			registros_sem_alunos: 0,
			dados_incompletos: false,
			flag_valor_negativo: false,
			flag_grupo_pequeno: base === null ? null : base < 30
		}
	}
}

const perfil = (categorias: CategoriaPerfil[]): Perfil => ({
	fator: { codigo: 'apoio_social', nome: 'Recebe apoio social', grupo: 'x' },
	base_minima: 30,
	conjunto: null,
	categorias
})

test('consulta do perfil usa todos os filtros do painel e o fator', () => {
	const selecao = {
		...limparFiltros('2023'),
		codigo_area_geral: '01',
		modalidade: 'Presencial'
	}
	assert.equal(
		serializarPerfil(selecao, 'sexo'),
		'ano=2023&codigo_area_geral=01&modalidade=Presencial&fator=sexo'
	)
})

test('fator e taxa vêm da URL, com padrão quando ausentes ou inválidos', () => {
	assert.equal(lerFatorPerfil(new URLSearchParams('')), 'sexo')
	assert.equal(
		lerFatorPerfil(new URLSearchParams('fator_perfil=apoio_social')),
		'apoio_social'
	)
	assert.equal(lerFatorPerfil(new URLSearchParams('fator_perfil=x')), 'sexo')
	assert.equal(lerTaxaPerfil(new URLSearchParams('')), 'evasao_curso')
	assert.equal(
		lerTaxaPerfil(new URLSearchParams('taxa_perfil=evasao_ies')),
		'evasao_ies'
	)
})

test('são os 12 fatores, e só os circulares têm ressalva', () => {
	assert.equal(fatoresPerfil.length, 12)
	assert.deepEqual(
		fatoresPerfil.filter((f) => f.ressalva).map((f) => f.codigo),
		['apoio_social', 'atividade_extracurricular']
	)
})

test('associação compara só categorias com taxa e base suficiente', () => {
	const extremos = extremosPerfil(
		perfil([
			categoria('1', 'Sim', 112.5, 0.004),
			categoria('0', 'Não', 907.5, 0.27),
			categoria('9', 'Pequena', 20, 0.9),
			categoria('7', 'Sem dados', null, null)
		]),
		'evasao_curso'
	)
	assert.equal(extremos?.maior.categoria.nome, 'Não')
	assert.equal(extremos?.menor.categoria.nome, 'Sim')
	assert.equal(extremos?.comparaveis, 2)
	assert.equal(
		extremosPerfil(
			perfil([categoria('1', 'F', 572, 0.2), categoria('2', 'M', 478, null)]),
			'evasao_curso'
		),
		null
	)
})

test('barra proporcional à maior taxa, sem barra para negativo ou ausente', () => {
	assert.equal(larguraPerfil(0.1, 0.4), 25)
	assert.equal(larguraPerfil(-0.1, 0.4), 0)
	assert.equal(larguraPerfil(null, 0.4), 0)
	assert.equal(larguraPerfil(0.1, 0), 0)
})

test('avisos do perfil funcionam sem os campos de ingressantes', () => {
	assert.deepEqual(avisosDoRecorte(categoria('9', 'Pequena', 20, 0.9)), [
		'Base inferior a 30'
	])
	assert.deepEqual(avisosDoRecorte(categoria('7', 'Vazia', null, null)), [
		'Sem dados de alunos'
	])
})

test('CSV do perfil traz fator e categoria, sem colunas de ingressantes', () => {
	const [cabecalho, primeira] = csvPerfil(
		'Recebe apoio social',
		[categoria(null, 'Não informado', 40, 0.25)],
		'ano=2023'
	).split('\r\n')
	assert.ok(
		cabecalho?.startsWith('Fator;Código da categoria;Categoria;Vínculos')
	)
	assert.doesNotMatch(cabecalho ?? '', /Ingressantes/)
	assert.ok(primeira?.startsWith('Recebe apoio social;;Não informado;40;'))
	assert.match(primeira ?? '', /;0,25;0,25;não;1;0;não;não;não;ano=2023$/)
})
