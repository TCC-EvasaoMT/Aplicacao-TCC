import { medidas, type FiltrosRecorte } from '../indicadores/index.js'
import { BASE_MINIMA } from './dispersao.js'

export interface FiltrosCoorte extends FiltrosRecorte {
	ano_ingresso: number
}

type Medida = (typeof medidas)[number]

// Somas de um ano do censo para a turma, só nos cursos que têm a linha do ano
// de ingresso. Os registros de outros cursos com o mesmo ano de ingresso são
// contados à parte.
export type AnoCoorte = Record<Medida, string | null> & {
	ano: number
	cursos_iniciais: number
	cursos_iniciais_ausentes: number
	registros: number
	registros_fora_da_turma: number
	vinculos_fora_da_turma: string | null
	flag_valor_negativo: boolean
	dados_incompletos: boolean
}

function numero(valor: string | null | undefined) {
	if (valor === null || valor === undefined) return null
	const n = Number(valor)
	if (!Number.isFinite(n)) throw new Error('Medida não finita na Gold')
	return n
}

// Acumula; um ano sem a medida interrompe o acumulado dali em diante, porque
// não se sabe quanto faltou.
function acumular(atual: number | null, ...parcelas: (number | null)[]) {
	if (atual === null || parcelas.some((p) => p === null)) return null
	return parcelas.reduce<number>((soma, p) => soma + p!, atual)
}

export function montarCoorte(anos: AnoCoorte[], anoIngresso: number) {
	const primeiro = anos.find((a) => a.ano === anoIngresso)
	// Tamanho inicial: vínculos da turma no censo do próprio ano de ingresso.
	const inicial = primeiro?.registros ? numero(primeiro.vinculos_total) : null
	if (inicial === null || inicial <= 0)
		return {
			tamanho_inicial: inicial,
			base_minima: BASE_MINIMA,
			cursos_iniciais: primeiro?.cursos_iniciais ?? 0,
			serie: []
		}
	let evadidos: number | null = 0
	let desvinculados: number | null = 0
	let concluintes: number | null = 0
	const proporcao = (valor: number | null) =>
		valor === null ? null : valor / inicial
	return {
		tamanho_inicial: inicial,
		base_minima: BASE_MINIMA,
		cursos_iniciais: primeiro!.cursos_iniciais,
		serie: anos
			.filter((a) => a.ano >= anoIngresso)
			.map((a) => {
				const m = Object.fromEntries(
					medidas.map((medida) => [medida, numero(a[medida])])
				) as Record<Medida, number | null>
				evadidos = acumular(
					evadidos,
					m.alunos_desvinculados,
					m.alunos_transferidos
				)
				desvinculados = acumular(desvinculados, m.alunos_desvinculados)
				concluintes = acumular(concluintes, m.concluintes_total)
				const continua =
					m.alunos_cursando === null || m.alunos_matricula_trancada === null
						? null
						: m.alunos_cursando + m.alunos_matricula_trancada
				// Resíduo: o que não fecha os 100% (falecidos, ruído, cursos
				// omitidos no ano e vínculos que mudam de curso).
				const residuo =
					evadidos === null || concluintes === null || continua === null
						? null
						: inicial - evadidos - concluintes - continua
				return {
					ano: a.ano,
					anos_desde_ingresso: a.ano - anoIngresso,
					totais: m,
					acumulados: { evadidos, desvinculados, concluintes },
					continua,
					taxas: {
						evadiu: proporcao(evadidos),
						evadiu_ies: proporcao(desvinculados),
						concluiu: proporcao(concluintes),
						continua: proporcao(continua),
						residuo: proporcao(residuo)
					},
					qualidade: {
						sem_dados: a.registros === 0,
						registros: a.registros,
						cursos_iniciais_ausentes: a.cursos_iniciais_ausentes,
						registros_fora_da_turma: a.registros_fora_da_turma,
						vinculos_fora_da_turma: numero(a.vinculos_fora_da_turma),
						dados_incompletos: a.dados_incompletos,
						flag_valor_negativo: a.flag_valor_negativo,
						flag_grupo_pequeno: inicial < BASE_MINIMA
					}
				}
			})
	}
}
