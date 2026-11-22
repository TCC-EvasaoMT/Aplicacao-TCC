import { calcularResumo, medidas, type Agregado } from '../indicadores/index.js'
import type { AgregadoAnual, FiltrosEvolucao } from './consultas.js'

export const MAX_ANOS = 30

const semRegistros = {
	...Object.fromEntries(medidas.map((medida) => [medida, null])),
	registros_com_alunos: 0,
	registros_sem_alunos: 0,
	flag_valor_negativo: null,
	dados_incompletos: null
} as Agregado

export function montarSerie(
	filtros: FiltrosEvolucao,
	agregados: AgregadoAnual[]
) {
	const porAno = new Map(agregados.map((agregado) => [agregado.ano, agregado]))
	return Array.from(
		{ length: filtros.ano_final - filtros.ano_inicial + 1 },
		(_, indice) => {
			const ano = filtros.ano_inicial + indice
			return { ano, ...calcularResumo(porAno.get(ano) ?? semRegistros) }
		}
	)
}
