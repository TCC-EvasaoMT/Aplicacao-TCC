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
