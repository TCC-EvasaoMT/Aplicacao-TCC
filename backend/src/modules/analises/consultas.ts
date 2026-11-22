import type { Pool } from 'pg';
import { agregacaoSQL, parametrizarFiltros, type Agregado, type FiltrosRecorte } from '../indicadores/index.js';
import { origem } from '../../plugins/gold.js';

export interface FiltrosEvolucao extends FiltrosRecorte {
  ano_inicial: number;
  ano_final: number;
}

export type AgregadoAnual = Agregado & { ano: number };

export function consultaEvolucao({ ano_inicial, ano_final, ...recorte }: FiltrosEvolucao) {
  const { values, conditions } = parametrizarFiltros(recorte, 3);
  return {
    text: `SELECT t.ano_censo AS ano, ${agregacaoSQL}
      ${origem}
      WHERE ${['t.ano_censo BETWEEN $1 AND $2', ...conditions].join(' AND ')}
      GROUP BY t.ano_censo
      ORDER BY t.ano_censo ASC`,
    values: [ano_inicial, ano_final, ...values],
  };
}

export function criarConsultasAnalises(pool: Pool) {
  return {
    async evolucao(filtros: FiltrosEvolucao): Promise<AgregadoAnual[]> {
      const result = await pool.query<AgregadoAnual>(consultaEvolucao(filtros));
      return result.rows;
    },
  };
}

export type ConsultasAnalises = ReturnType<typeof criarConsultasAnalises>;
