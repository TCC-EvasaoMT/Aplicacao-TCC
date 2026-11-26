import {
	calcularResumo,
	type Agregado,
	type FiltrosRecorte
} from '../indicadores/index.js'
import { BASE_MINIMA } from './dispersao.js'

export const dimensoesRanking = ['area_geral', 'modalidade'] as const
export type DimensaoRanking = (typeof dimensoesRanking)[number]
export const taxasRanking = ['evasao_curso', 'evasao_ies'] as const
export type TaxaRanking = (typeof taxasRanking)[number]

export interface FiltrosRanking extends FiltrosRecorte {
	ano: number
	dimensao: DimensaoRanking
	taxa: TaxaRanking
}
export type AgregadoCategoria = Agregado & {
	grupo_valor: string | null
	grupo_nome: string | null
}

// Só grupos classificados têm posição; os demais aparecem depois, com o motivo.
export const situacoes = [
	'classificado',
	'base_pequena',
	'sem_taxa',
	'sem_identificador'
] as const
type Situacao = (typeof situacoes)[number]

const porCodigo = (a: string | null, b: string | null) =>
	a === b ? 0 : a === null ? 1 : b === null ? -1 : a < b ? -1 : 1

// Taxas iguais com até 12 algarismos significativos são empate: 30/100 e
// 3/10 dão o mesmo número, mas somas diferentes podem diferir no último bit.
const chave = (taxa: number) => Number(taxa.toPrecision(12))

export function montarRanking(
	agregados: AgregadoCategoria[],
	taxa: TaxaRanking
) {
	const grupos = agregados.map(({ grupo_valor, grupo_nome, ...agregado }) => {
		const resumo = calcularResumo(agregado)
		const valor = resumo.taxas[taxa]
		// Sem identificador primeiro: classificar uma categoria indefinida não
		// responde qual área ou modalidade evade mais.
		const situacao: Situacao =
			grupo_valor === null
				? 'sem_identificador'
				: valor === null
					? 'sem_taxa'
					: resumo.base_risco! < BASE_MINIMA
						? 'base_pequena'
						: 'classificado'
		return {
			grupo: { valor: grupo_valor, nome: grupo_nome },
			...resumo,
			situacao,
			posicao: null as number | null,
			empate: false
		}
	})
	const classificados = grupos
		.filter((g) => g.situacao === 'classificado')
		.sort(
			(a, b) =>
				chave(b.taxas[taxa]!) - chave(a.taxas[taxa]!) ||
				porCodigo(a.grupo.valor, b.grupo.valor)
		)
	// Classificação por competição: 1º, 2º, 2º, 4º.
	classificados.forEach((grupo, indice) => {
		const anterior = classificados[indice - 1]
		if (
			anterior &&
			chave(anterior.taxas[taxa]!) === chave(grupo.taxas[taxa]!)
		) {
			grupo.posicao = anterior.posicao
			grupo.empate = anterior.empate = true
		} else grupo.posicao = indice + 1
	})
	const demais = (situacao: Situacao) =>
		grupos
			.filter((g) => g.situacao === situacao)
			.sort((a, b) => porCodigo(a.grupo.valor, b.grupo.valor))
	return {
		base_minima: BASE_MINIMA,
		classificados: classificados.length,
		grupos: [
			...classificados,
			...demais('base_pequena'),
			...demais('sem_taxa'),
			...demais('sem_identificador')
		]
	}
}
