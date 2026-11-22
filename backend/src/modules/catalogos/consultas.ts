import type { Pool } from 'pg'
import { origem } from '../../plugins/gold.js'

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
			['municipios_sede', 'codigo_municipio_sede', 'municipio_sede']
		]
			.map(
				([campo, codigo, nome]) => `'${campo}', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('codigo', codigo, 'nome', nome) ORDER BY nome, codigo), '[]'::jsonb)
      FROM (SELECT ${codigo} AS codigo, min(${nome}) AS nome FROM dados
            WHERE ${codigo} IS NOT NULL GROUP BY ${codigo}) x
    )`
			)
			.join(',')},
    ${[
			['modalidades', 'modalidade'],
			['categorias_administrativas', 'categoria_administrativa'],
			['organizacoes_academicas', 'organizacao_academica']
		]
			.map(
				([campo, coluna]) => `'${campo}', (
      SELECT coalesce(jsonb_agg(valor ORDER BY valor), '[]'::jsonb)
      FROM (SELECT DISTINCT ${coluna} AS valor FROM dados WHERE ${coluna} IS NOT NULL) x
    )`
			)
			.join(',')}
  ) AS filtros`

export function criarConsultasCatalogos(pool: Pool) {
	return {
		async filtros() {
			const result = await pool.query(catalogoSQL)
			return result.rows[0].filtros
		}
	}
}

export type ConsultasCatalogos = ReturnType<typeof criarConsultasCatalogos>
