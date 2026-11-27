import {
	calcularResumo,
	expressaoCapital,
	type Agregado,
	type FiltrosRecorte
} from '../indicadores/index.js'

export const MAX_GRUPOS = 20

// Somente esta lista interna pode fornecer identificadores SQL.
export const agrupamentos = {
	curso: {
		valor: 'c.codigo_curso',
		nome: 'c.nome_curso',
		filtro: 'codigo_curso'
	},
	area_geral: {
		valor: 'a.codigo_area_geral',
		nome: 'a.area_geral',
		filtro: 'codigo_area_geral'
	},
	municipio_oferta: {
		valor: 'l.codigo_municipio',
		nome: 'l.municipio',
		filtro: 'codigo_municipio_oferta'
	},
	municipio_sede: {
		valor: 'i.codigo_municipio_sede',
		nome: 'i.municipio_sede',
		filtro: 'codigo_municipio_sede'
	},
	modalidade: {
		valor: 'o.modalidade_ensino',
		nome: 'o.modalidade_ensino',
		filtro: 'modalidade'
	},
	categoria_administrativa: {
		valor: 'i.categoria_administrativa',
		nome: 'i.categoria_administrativa',
		filtro: 'categoria_administrativa'
	},
	organizacao_academica: {
		valor: 'i.organizacao_academica',
		nome: 'i.organizacao_academica',
		filtro: 'organizacao_academica'
	},
	grau_academico: {
		valor: 'c.grau_academico',
		nome: 'c.grau_academico',
		filtro: 'grau_academico'
	},
	capital: {
		valor: expressaoCapital,
		nome: expressaoCapital,
		filtro: 'capital'
	},
	turno: {
		valor: 'o.turno',
		nome: 'o.turno',
		filtro: 'turno'
	}
} as const satisfies Record<
	string,
	{ valor: string; nome: string; filtro: keyof FiltrosRecorte }
>

export type Agrupamento = keyof typeof agrupamentos
export interface FiltrosComparacao extends FiltrosRecorte {
	ano: number
	agrupar_por: Agrupamento
	limite: number
	grupos?: string[]
}
export type AgregadoGrupo = Agregado & {
	grupo_valor: string | null
	grupo_nome: string | null
	total_grupos: number
}

export function montarComparacao(agregados: AgregadoGrupo[]) {
	const total_grupos = agregados[0]?.total_grupos ?? 0
	return {
		total_grupos,
		truncado: total_grupos > agregados.length,
		grupos: agregados.map(({ grupo_valor, grupo_nome, ...agregado }) => ({
			grupo: { valor: grupo_valor, nome: grupo_nome },
			...calcularResumo(agregado)
		}))
	}
}
