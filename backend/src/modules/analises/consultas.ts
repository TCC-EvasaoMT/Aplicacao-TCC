import type { Pool } from 'pg'
import {
	agregacaoSQL,
	medidas,
	parametrizarFiltros,
	type Agregado,
	type FiltrosRecorte
} from '../indicadores/index.js'
import { origem, origemPerfil } from '../../plugins/gold.js'
import {
	fatoresPerfil,
	type AgregadoPerfil,
	type FiltrosPerfil
} from './perfil.js'
import {
	agrupamentos,
	type AgregadoGrupo,
	type FiltrosComparacao
} from './comparacoes.js'
import type { AgregadoCurso, FiltrosDispersao } from './dispersao.js'
import {
	dimensoesRanking,
	type AgregadoCategoria,
	type FiltrosRanking
} from './ranking.js'

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

// Um item por código de curso, sem limite: a dispersão mostra todos.
export function consultaDispersao(filtros: FiltrosDispersao) {
	const { values, conditions } = parametrizarFiltros(filtros)
	return {
		text: `SELECT c.codigo_curso AS curso_codigo,
        CASE WHEN c.codigo_curso IS NOT NULL THEN min(c.nome_curso COLLATE "C") END AS curso_nome,
        ${agregacaoSQL}
      ${origem}
      WHERE ${conditions.join(' AND ')}
      GROUP BY c.codigo_curso
      ORDER BY c.codigo_curso COLLATE "C" ASC NULLS LAST`,
		values
	}
}

// Todas as categorias da dimensão, sem limite; a ordem final é do ranking.
export function consultaRanking({
	dimensao,
	taxa: _taxa,
	...filtros
}: FiltrosRanking) {
	// Só área e modalidade: agrupamentos também tem as outras dimensões da
	// comparação.
	if (!dimensoesRanking.includes(dimensao)) throw new Error('Dimensão inválida')
	const { valor, nome } = agrupamentos[dimensao]
	const { values, conditions } = parametrizarFiltros(filtros)
	return {
		text: `SELECT ${valor} AS grupo_valor,
        CASE WHEN ${valor} IS NOT NULL THEN min(${nome} COLLATE "C") END AS grupo_nome,
        ${agregacaoSQL}
      ${origem}
      WHERE ${conditions.join(' AND ')}
      GROUP BY ${valor}`,
		values
	}
}

// Mesma regra de agregacaoSQL sobre a fato de perfil: ausência parcial não
// vira soma completa, e só as medidas exibidas contam como ruído negativo.
const somasPerfil = medidas.map(
	(medida) => `
  CASE WHEN count(r.${medida}) FILTER (WHERE r.vinculos_total IS NOT NULL) = count(r.vinculos_total)
    THEN (sum(r.${medida}) FILTER (WHERE r.vinculos_total IS NOT NULL))::text
  END AS ${medida}`
)
const listaPerfil = medidas.map((m) => `r.${m}`).join(', ')

// Todas as categorias do fator no catálogo, inclusive as sem registros no
// recorte (LEFT JOIN), e o conjunto do fator na mesma consulta (GROUPING SETS).
// Um fator por consulta: o mesmo vínculo aparece uma vez em cada fator.
export function consultaPerfil({ fator, ...filtros }: FiltrosPerfil) {
	const nome = fatoresPerfil[fator]?.nome
	if (!nome) throw new Error('Fator inválido')
	const { values, conditions } = parametrizarFiltros(filtros)
	return {
		text: `WITH recorte AS (
        SELECT f.* ${origemPerfil}
        WHERE ${conditions.join(' AND ')}
      )
      SELECT grouping(p.id_perfil) = 1 AS conjunto,
        p.codigo_categoria, p.categoria, p.ordem_categoria,
        ${somasPerfil.join(',')},
        NULL::text AS ingressantes_total,
        0 AS registros_sem_ingressantes,
        count(r.vinculos_total)::integer AS registros_com_alunos,
        count(r.id_perfil) FILTER (WHERE r.vinculos_total IS NULL)::integer AS registros_sem_alunos,
        coalesce(bool_or(r.vinculos_total IS NOT NULL AND least(${listaPerfil}) < 0), false) AS flag_valor_negativo,
        coalesce(bool_or(r.vinculos_total IS NOT NULL AND num_nonnulls(${listaPerfil}) < ${medidas.length}), false) AS dados_incompletos
      FROM gold.dim_perfil p
      LEFT JOIN recorte r USING (id_perfil)
      WHERE p.fator = $${values.length + 1}
      GROUP BY GROUPING SETS ((p.id_perfil, p.codigo_categoria, p.categoria, p.ordem_categoria), ())
      ORDER BY conjunto, p.ordem_categoria, p.codigo_categoria COLLATE "C"`,
		values: [...values, nome]
	}
}

export function criarConsultasAnalises(pool: Pool) {
	return {
		async perfil(filtros: FiltrosPerfil): Promise<AgregadoPerfil[]> {
			return (await pool.query<AgregadoPerfil>(consultaPerfil(filtros))).rows
		},
		async ranking(filtros: FiltrosRanking): Promise<AgregadoCategoria[]> {
			return (await pool.query<AgregadoCategoria>(consultaRanking(filtros)))
				.rows
		},
		async dispersao(filtros: FiltrosDispersao): Promise<AgregadoCurso[]> {
			return (await pool.query<AgregadoCurso>(consultaDispersao(filtros))).rows
		},
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
