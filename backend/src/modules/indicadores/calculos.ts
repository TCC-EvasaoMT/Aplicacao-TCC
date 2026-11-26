// Medidas somadas no SQL a partir da fato de cursos.
export const medidas = [
	'vinculos_total',
	'concluintes_total',
	'alunos_cursando',
	'alunos_desvinculados',
	'alunos_transferidos',
	'alunos_matricula_trancada',
	'alunos_falecidos'
] as const

export const totais = [
	'vinculos_total',
	'ingressantes_total',
	'matriculas_total',
	...medidas.slice(1)
] as const

export type Medida = (typeof medidas)[number]
export type Total = (typeof totais)[number]
export type Totais = Record<Total, number | null>
export type Agregado = Record<Medida, string | null> & {
	ingressantes_total: string | null
	registros_com_alunos: number
	registros_sem_alunos: number
	registros_sem_ingressantes: number
	flag_valor_negativo: boolean | null
	dados_incompletos: boolean | null
}

function numero(valor: string | null) {
	const value = valor === null ? null : Number(valor)
	if (value !== null && !Number.isFinite(value))
		throw new Error('Medida não finita na Gold')
	return value
}

// Ingressantes: soma dos vínculos da coorte cujo ano de ingresso é o ano do
// censo. Se algum curso não tem essa linha, o total é um mínimo; se nenhum
// tem, ou se não há alunos, o total é null.
export function ingressantesDoRecorte(
	soma: number | null,
	registrosSemIngressantes: number,
	registrosComAlunos: number
): { total: number | null; minimo: boolean } {
	if (soma === null || registrosComAlunos === 0)
		return { total: null, minimo: false }
	return { total: soma, minimo: registrosSemIngressantes > 0 }
}

export function calcularResumo(agregado: Agregado) {
	const somas = Object.fromEntries(
		medidas.map((medida) => [medida, numero(agregado[medida])])
	) as Record<Medida, number | null>
	const ingressantes = ingressantesDoRecorte(
		numero(agregado.ingressantes_total),
		agregado.registros_sem_ingressantes,
		agregado.registros_com_alunos
	)
	// Matrículas = cursando + concluintes; null se uma das parcelas faltar.
	const matriculas =
		somas.alunos_cursando === null || somas.concluintes_total === null
			? null
			: somas.alunos_cursando + somas.concluintes_total
	const totaisCalculados: Totais = {
		...somas,
		ingressantes_total: ingressantes.total,
		matriculas_total: matriculas
	}
	// Base de risco = vínculos − falecidos.
	const base =
		somas.vinculos_total === null || somas.alunos_falecidos === null
			? null
			: somas.vinculos_total - somas.alunos_falecidos
	const evadidosCurso =
		somas.alunos_desvinculados === null || somas.alunos_transferidos === null
			? null
			: somas.alunos_desvinculados + somas.alunos_transferidos
	// Taxa = numerador / base, sobre as somas do recorte; null com base
	// ausente ou não positiva. Evasão do curso usa desvinculados +
	// transferidos; evasão da IES, só desvinculados.
	const taxa = (numerador: number | null) =>
		base === null || base <= 0 || numerador === null ? null : numerador / base

	return {
		totais: Object.fromEntries(
			totais.map((total) => [total, totaisCalculados[total]])
		) as Totais,
		base_risco: base,
		taxas: {
			evasao_curso: taxa(evadidosCurso),
			evasao_ies: taxa(somas.alunos_desvinculados)
		},
		qualidade: {
			sem_dados: agregado.registros_com_alunos === 0,
			registros_com_alunos: agregado.registros_com_alunos,
			registros_sem_alunos: agregado.registros_sem_alunos,
			registros_sem_ingressantes: agregado.registros_sem_ingressantes,
			ingressantes_minimo: ingressantes.minimo,
			dados_incompletos: agregado.dados_incompletos ?? false,
			flag_valor_negativo: agregado.flag_valor_negativo ?? false,
			// Grupo pequeno: base agregada abaixo de 30.
			flag_grupo_pequeno: base === null ? null : base < 30
		}
	}
}
