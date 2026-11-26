import {
	calcularResumo,
	type Agregado,
	type FiltrosRecorte
} from '../indicadores/index.js'

// Base de risco mínima para a zona crítica: o mesmo limite de
// flag_grupo_pequeno (base < 30).
export const BASE_MINIMA = 30

export const taxasDispersao = ['evasao_curso', 'evasao_ies'] as const
type Taxa = (typeof taxasDispersao)[number]

export interface FiltrosDispersao extends FiltrosRecorte {
	ano: number
}
export type AgregadoCurso = Agregado & {
	curso_codigo: string | null
	curso_nome: string | null
}
type Curso = ReturnType<typeof calcularResumo>

// Numerador de cada taxa, a partir dos totais do curso.
const numeradores: Record<Taxa, (curso: Curso) => number> = {
	evasao_curso: ({ totais }) =>
		totais.alunos_desvinculados! + totais.alunos_transferidos!,
	evasao_ies: ({ totais }) => totais.alunos_desvinculados!
}

// Linha de alta evasão: soma dos numeradores / soma das bases, só dos cursos
// com a taxa calculável. null quando nenhum curso tem a taxa.
function referencia(cursos: Curso[], taxa: Taxa) {
	const incluidos = cursos.filter((curso) => curso.taxas[taxa] !== null)
	const base = incluidos.reduce((soma, curso) => soma + curso.base_risco!, 0)
	const numerador = incluidos.reduce(
		(soma, curso) => soma + numeradores[taxa](curso),
		0
	)
	return {
		valor: incluidos.length ? numerador / base : null,
		incluidos: incluidos.length
	}
}

const porTaxa = <T>(valor: (taxa: Taxa) => T) =>
	Object.fromEntries(
		taxasDispersao.map((taxa) => [taxa, valor(taxa)])
	) as Record<Taxa, T>

export function montarDispersao(agregados: AgregadoCurso[]) {
	const resumos = agregados.map(
		({ curso_codigo, curso_nome, ...agregado }) => ({
			curso: { codigo: curso_codigo, nome: curso_nome },
			resumo: calcularResumo(agregado)
		})
	)
	const refs = porTaxa((taxa) =>
		referencia(
			resumos.map(({ resumo }) => resumo),
			taxa
		)
	)
	// Zona crítica: taxa maior que a referência e base de pelo menos 30.
	const critica = (resumo: Curso, taxa: Taxa) => {
		const valor = resumo.taxas[taxa]
		const ref = refs[taxa].valor
		return (
			valor !== null &&
			ref !== null &&
			valor > ref &&
			resumo.base_risco !== null &&
			resumo.base_risco >= BASE_MINIMA
		)
	}
	return {
		referencias: {
			base_minima: BASE_MINIMA,
			alta_evasao: porTaxa((taxa) => refs[taxa].valor),
			cursos_na_referencia: porTaxa((taxa) => refs[taxa].incluidos),
			cursos_fora_da_referencia: porTaxa(
				(taxa) => resumos.length - refs[taxa].incluidos
			)
		},
		cursos: resumos.map(({ curso, resumo }) => ({
			curso,
			...resumo,
			zona_critica: porTaxa((taxa) => critica(resumo, taxa))
		}))
	}
}
