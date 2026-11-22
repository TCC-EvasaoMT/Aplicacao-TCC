import { consultar } from '../../lib/http'
import type { Resumo } from '../indicadores'

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
