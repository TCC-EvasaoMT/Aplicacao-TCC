import type { Catalogo } from '../catalogos'
import type { SelecaoFiltros } from '../indicadores'

export const limiteGrupos = 20

export const dimensoesComparacao = {
	curso: { rotulo: 'Curso', catalogo: 'cursos', filtro: 'codigo_curso' },
	area_geral: {
		rotulo: 'Área geral CINE',
		catalogo: 'areas_gerais',
		filtro: 'codigo_area_geral'
	},
	municipio_oferta: {
		rotulo: 'Município de oferta',
		catalogo: 'municipios_oferta',
		filtro: 'codigo_municipio_oferta'
	},
	municipio_sede: {
		rotulo: 'Município da sede',
		catalogo: 'municipios_sede',
		filtro: 'codigo_municipio_sede'
	},
	modalidade: {
		rotulo: 'Modalidade',
		catalogo: 'modalidades',
		filtro: 'modalidade'
	},
	categoria_administrativa: {
		rotulo: 'Categoria administrativa',
		catalogo: 'categorias_administrativas',
		filtro: 'categoria_administrativa'
	},
	organizacao_academica: {
		rotulo: 'Organização acadêmica',
		catalogo: 'organizacoes_academicas',
		filtro: 'organizacao_academica'
	}
} as const

export type DimensaoComparacao = keyof typeof dimensoesComparacao
export interface SelecaoComparacao {
	agrupar_por: DimensaoComparacao
	grupos: string[]
}

export function rotuloGrupo(grupo: {
	valor: string | null
	nome: string | null
}) {
	if (grupo.valor === null) return 'Não informado (sem identificador)'
	return grupo.nome && grupo.nome !== grupo.valor
		? `${grupo.valor} — ${grupo.nome}`
		: grupo.valor
}

export function opcoesComparacao(
	catalogo: Catalogo | null,
	dimensao: DimensaoComparacao
) {
	return (catalogo?.[dimensoesComparacao[dimensao].catalogo] ?? []).map(
		(opcao) => {
			const grupo =
				typeof opcao === 'string'
					? { valor: opcao, nome: opcao }
					: { valor: opcao.codigo, nome: opcao.nome }
			return { valor: grupo.valor, rotulo: rotuloGrupo(grupo) }
		}
	)
}

export function alternarGrupo(grupos: string[], valor: string): string[] {
	if (grupos.includes(valor)) return grupos.filter((grupo) => grupo !== valor)
	return grupos.length < limiteGrupos ? [...grupos, valor] : grupos
}

export function serializarComparacao(
	comparacao: SelecaoComparacao,
	selecao: SelecaoFiltros
) {
	const query = new URLSearchParams(
		Object.entries(selecao).filter(([, valor]) => valor !== '')
	)
	query.set('agrupar_por', comparacao.agrupar_por)
	query.set('limite', String(limiteGrupos))
	for (const grupo of comparacao.grupos) query.append('grupos', grupo)
	return query.toString()
}

export function gruposAusentes(
	selecionados: string[],
	retornados: { grupo: { valor: string | null } }[]
) {
	const valores = new Set(retornados.map(({ grupo }) => grupo.valor))
	return selecionados.filter((valor) => !valores.has(valor))
}
