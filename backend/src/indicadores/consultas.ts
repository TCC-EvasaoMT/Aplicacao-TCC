import type { Pool } from 'pg';
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

const origem = `
  FROM gold.fato_evasao_curso f
  JOIN gold.dim_tempo t USING (id_tempo)
  JOIN gold.dim_curso c USING (id_curso)
  JOIN gold.dim_area_conhecimento a USING (id_area_conhecimento)
  JOIN gold.dim_localidade l USING (id_localidade)
  JOIN gold.dim_oferta o USING (id_oferta)
  JOIN gold.dim_instituicao i USING (id_instituicao)`;

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

const catalogoSQL = `
  WITH dados AS MATERIALIZED (
    SELECT t.ano_censo, c.codigo_curso, c.nome_curso,
      a.codigo_area_geral, a.area_geral,
      l.codigo_municipio AS codigo_municipio_oferta, l.municipio AS municipio_oferta,
      o.modalidade_ensino AS modalidade, i.categoria_administrativa, i.organizacao_academica,
      i.codigo_municipio_sede, i.municipio_sede
    ${origem}
  )
  SELECT jsonb_build_object(
    'anos', (SELECT coalesce(jsonb_agg(ano_censo ORDER BY ano_censo DESC), '[]'::jsonb)
      FROM (SELECT DISTINCT ano_censo FROM dados WHERE ano_censo IS NOT NULL) x),
    ${[
      ['cursos', 'codigo_curso', 'nome_curso'],
      ['areas_gerais', 'codigo_area_geral', 'area_geral'],
      ['municipios_oferta', 'codigo_municipio_oferta', 'municipio_oferta'],
      ['municipios_sede', 'codigo_municipio_sede', 'municipio_sede'],
    ].map(([campo, codigo, nome]) => `'${campo}', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('codigo', codigo, 'nome', nome) ORDER BY nome, codigo), '[]'::jsonb)
      FROM (SELECT ${codigo} AS codigo, min(${nome}) AS nome FROM dados
            WHERE ${codigo} IS NOT NULL GROUP BY ${codigo}) x
    )`).join(',')},
    ${[
      ['modalidades', 'modalidade'],
      ['categorias_administrativas', 'categoria_administrativa'],
      ['organizacoes_academicas', 'organizacao_academica'],
    ].map(([campo, coluna]) => `'${campo}', (
      SELECT coalesce(jsonb_agg(valor ORDER BY valor), '[]'::jsonb)
      FROM (SELECT DISTINCT ${coluna} AS valor FROM dados WHERE ${coluna} IS NOT NULL) x
    )`).join(',')}
  ) AS filtros`;

export function criarConsultas(pool: Pool) {
  return {
    async health() {
      // Valida acesso também às dimensões usadas pelas duas rotas, mesmo sem registros.
      await pool.query(`SELECT 1 ${origem} LIMIT 1`);
    },
    async filtros() {
      const result = await pool.query(catalogoSQL);
      return result.rows[0].filtros;
    },
    async resumo(filtros: Filtros): Promise<Agregado> {
      const result = await pool.query<Agregado>(consultaResumo(filtros));
      return result.rows[0]!;
    },
  };
}

export type Consultas = ReturnType<typeof criarConsultas>;
