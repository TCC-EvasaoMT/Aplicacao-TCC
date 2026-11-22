import type { Pool } from 'pg'
import {
	agregacaoSQL,
	parametrizarFiltros,
	type Agregado,
	type FiltrosRecorte
} from '../indicadores/index.js'
import { origem } from '../../plugins/gold.js'
import {
	agrupamentos,
	type AgregadoGrupo,
	type FiltrosComparacao
} from './comparacoes.js'

export interface FiltrosEvolucao extends FiltrosRecorte {
	ano_inicial: number
	ano_final: number
}

export type AgregadoAnual = Agregado & { ano: number }

export function consultaEvolucao({
	ano_inicial,
	ano_final,
	...recorte
}: FiltrosEvolucao) {
	const { values, conditions } = parametrizarFiltros(recorte, 3)
	return {
		text: `SELECT t.ano_censo AS ano, ${agregacaoSQL}
      ${origem}
      WHERE ${['t.ano_censo BETWEEN $1 AND $2', ...conditions].join(' AND ')}
      GROUP BY t.ano_censo
      ORDER BY t.ano_censo ASC`,
		values: [ano_inicial, ano_final, ...values]
	}
}

export function consultaComparacao({
	agrupar_por,
	limite,
	grupos,
	...recorte
}: FiltrosComparacao) {
	if (!Object.hasOwn(agrupamentos, agrupar_por))
		throw new Error('Agrupamento inválido')
	const { valor, nome } = agrupamentos[agrupar_por]
	const { values: filtrosValues, conditions } = parametrizarFiltros(recorte)
	const values: (string | number | string[])[] = [...filtrosValues]
	if (grupos) {
		values.push(grupos)
		conditions.push(`${valor} = ANY($${values.length}::text[])`)
	}
	values.push(limite)
	return {
		text: `WITH grupos AS (
      SELECT ${valor} AS grupo_valor,
        CASE WHEN ${valor} IS NOT NULL THEN min(${nome} COLLATE "C") END AS grupo_nome,
        ${agregacaoSQL}
      ${origem}
      WHERE ${conditions.join(' AND ')}
      GROUP BY ${valor}
    )
    SELECT grupos.*, (count(*) OVER ())::integer AS total_grupos
    FROM grupos
    ORDER BY grupo_valor COLLATE "C" ASC NULLS LAST
    LIMIT $${values.length}`,
		values
	}
}

export function criarConsultasAnalises(pool: Pool) {
	return {
		async comparacao(filtros: FiltrosComparacao): Promise<AgregadoGrupo[]> {
			return (await pool.query<AgregadoGrupo>(consultaComparacao(filtros))).rows
		},
		async evolucao(filtros: FiltrosEvolucao): Promise<AgregadoAnual[]> {
			const result = await pool.query<AgregadoAnual>(consultaEvolucao(filtros))
			return result.rows
		}
	}
}

export type ConsultasAnalises = ReturnType<typeof criarConsultasAnalises>
