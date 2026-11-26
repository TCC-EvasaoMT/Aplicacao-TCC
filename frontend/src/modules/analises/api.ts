import { consultar } from '../../lib/http'
import type { Resumo } from '../indicadores'

export interface GrupoComparacao extends Resumo {
	grupo: { valor: string | null; nome: string | null }
}

export interface Comparacao {
	total_grupos: number
	truncado: boolean
	grupos: GrupoComparacao[]
}

export function consultarComparacao(query: string, signal: AbortSignal) {
	return consultar<Comparacao>(`/api/v1/analises/comparacoes?${query}`, signal)
}

export type TaxaDispersao = keyof Resumo['taxas']
type PorTaxa<T> = Record<TaxaDispersao, T>

export interface CursoDispersao extends Resumo {
	curso: { codigo: string | null; nome: string | null }
	zona_critica: PorTaxa<boolean>
}

export interface Dispersao {
	referencias: {
		base_minima: number
		alta_evasao: PorTaxa<number | null>
		cursos_na_referencia: PorTaxa<number>
		cursos_fora_da_referencia: PorTaxa<number>
	}
	cursos: CursoDispersao[]
}

export function consultarDispersao(query: string, signal: AbortSignal) {
	return consultar<Dispersao>(`/api/v1/analises/dispersao?${query}`, signal)
}

export type DimensaoRanking = 'area_geral' | 'modalidade'
export type SituacaoRanking =
	'classificado' | 'base_pequena' | 'sem_taxa' | 'sem_identificador'

export interface GrupoRanking extends Resumo {
	grupo: { valor: string | null; nome: string | null }
	situacao: SituacaoRanking
	posicao: number | null
	empate: boolean
}

export interface Ranking {
	base_minima: number
	classificados: number
	grupos: GrupoRanking[]
}

export function consultarRanking(query: string, signal: AbortSignal) {
	return consultar<Ranking>(`/api/v1/analises/ranking?${query}`, signal)
}

export interface PontoTemporal extends Resumo {
	ano: number
}

export interface EvolucaoTemporal {
	serie: PontoTemporal[]
}

export function consultarEvolucao(query: string, signal: AbortSignal) {
	return consultar<EvolucaoTemporal>(
		`/api/v1/analises/evolucao-temporal?${query}`,
		signal
	)
}
