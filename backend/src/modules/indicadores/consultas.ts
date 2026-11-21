import type { Pool } from 'pg';
import { origem } from '../../plugins/gold.js';
import { medidas, type Agregado } from './calculos.js';

export interface Filtros {
  ano: number;
  codigo_curso?: string;
  codigo_area_geral?: string;
  codigo_municipio_oferta?: string;
  modalidade?: string;
  categoria_administrativa?: string;
  organizacao_academica?: string;
  codigo_municipio_sede?: string;
}

const colunasFiltro: Record<keyof Filtros, string> = {
  ano: 't.ano_censo',
  codigo_curso: 'c.codigo_curso',
  codigo_area_geral: 'a.codigo_area_geral',
  codigo_municipio_oferta: 'l.codigo_municipio',
  modalidade: 'o.modalidade_ensino',
  categoria_administrativa: 'i.categoria_administrativa',
  organizacao_academica: 'i.organizacao_academica',
  codigo_municipio_sede: 'i.codigo_municipio_sede',
};

export function consultaResumo(filtros: Filtros) {
  const values: (number | string)[] = [];
  const conditions: string[] = [];
  for (const chave of Object.keys(colunasFiltro) as (keyof Filtros)[]) {
    const value = filtros[chave];
    if (value !== undefined) {
      values.push(value);
      conditions.push(`${colunasFiltro[chave]} = $${values.length}`);
    }
  }
  // Ausência parcial não pode produzir uma soma aparentemente completa.
  const somas = medidas.map((medida) => `
    CASE WHEN count(f.${medida}) FILTER (WHERE f.vinculos_total IS NOT NULL) = count(f.vinculos_total)
      THEN (sum(f.${medida}) FILTER (WHERE f.vinculos_total IS NOT NULL))::text
    END AS ${medida}`);
  return {
    text: `SELECT ${somas.join(',')},
      count(f.vinculos_total)::integer AS registros_com_alunos,
      count(*) FILTER (WHERE f.vinculos_total IS NULL)::integer AS registros_sem_alunos,
      bool_or(f.flag_valor_negativo) AS flag_valor_negativo,
      bool_or(f.vinculos_total IS NOT NULL AND num_nonnulls(${medidas.map(m => `f.${m}`).join(',')}) < ${medidas.length}) AS dados_incompletos
      ${origem}
      WHERE ${conditions.join(' AND ')}`,
    values,
  };
}

export function criarConsultasIndicadores(pool: Pool) {
  return {
    async resumo(filtros: Filtros): Promise<Agregado> {
      const result = await pool.query<Agregado>(consultaResumo(filtros));
      return result.rows[0]!;
    },
  };
}

export type ConsultasIndicadores = ReturnType<typeof criarConsultasIndicadores>;
