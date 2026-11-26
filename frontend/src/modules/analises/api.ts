import { consultar } from '../../lib/http'
import type { Resumo } from '../indicadores'

export interface GrupoComparacao extends Resumo {
	grupo: { valor: string | null; nome: string | null }
}

export interface Comparacao {
	total_grupos: number
	truncado: boolean
	grupos: GrupoComparacao[]
}

export function consultarComparacao(query: string, signal: AbortSignal) {
	return consultar<Comparacao>(`/api/v1/analises/comparacoes?${query}`, signal)
}

export type TaxaDispersao = keyof Resumo['taxas']
type PorTaxa<T> = Record<TaxaDispersao, T>

export interface CursoDispersao extends Resumo {
	curso: { codigo: string | null; nome: string | null }
	zona_critica: PorTaxa<boolean>
}

export interface Dispersao {
	referencias: {
		base_minima: number
		alta_evasao: PorTaxa<number | null>
		cursos_na_referencia: PorTaxa<number>
		cursos_fora_da_referencia: PorTaxa<number>
	}
	cursos: CursoDispersao[]
}

export function consultarDispersao(query: string, signal: AbortSignal) {
	return consultar<Dispersao>(`/api/v1/analises/dispersao?${query}`, signal)
}

export type DimensaoRanking = 'area_geral' | 'modalidade'
export type SituacaoRanking =
	'classificado' | 'base_pequena' | 'sem_taxa' | 'sem_identificador'

export interface GrupoRanking extends Resumo {
	grupo: { valor: string | null; nome: string | null }
	situacao: SituacaoRanking
	posicao: number | null
	empate: boolean
}

export interface Ranking {
	base_minima: number
	classificados: number
	grupos: GrupoRanking[]
}

export function consultarRanking(query: string, signal: AbortSignal) {
	return consultar<Ranking>(`/api/v1/analises/ranking?${query}`, signal)
}

// Resumo de uma categoria de perfil: a fato de perfil não tem ingressantes.
export interface ResumoPerfil {
	base_risco: number | null
	totais: Omit<Resumo['totais'], 'ingressantes_total'>
	taxas: Resumo['taxas']
	qualidade: Omit<
		Resumo['qualidade'],
		'ingressantes_minimo' | 'registros_sem_ingressantes'
	>
}

export interface CategoriaPerfil extends ResumoPerfil {
	categoria: { codigo: string | null; nome: string; ordem: number | null }
}

export interface Perfil {
	fator: { codigo: string; nome: string; grupo: string }
	base_minima: number
	conjunto: ResumoPerfil | null
	categorias: CategoriaPerfil[]
}

export function consultarPerfil(query: string, signal: AbortSignal) {
	return consultar<Perfil>(`/api/v1/analises/perfil?${query}`, signal)
}

export interface PontoCoorte {
	ano: number
	anos_desde_ingresso: number
	totais: {
		vinculos_total: number | null
		concluintes_total: number | null
		alunos_cursando: number | null
		alunos_desvinculados: number | null
		alunos_transferidos: number | null
		alunos_matricula_trancada: number | null
		alunos_falecidos: number | null
	}
	acumulados: {
		evadidos: number | null
		desvinculados: number | null
		concluintes: number | null
	}
	continua: number | null
	taxas: {
		evadiu: number | null
		evadiu_ies: number | null
		concluiu: number | null
		continua: number | null
		residuo: number | null
	}
	qualidade: {
		sem_dados: boolean
		registros: number
		cursos_iniciais_ausentes: number
		registros_fora_da_turma: number
		vinculos_fora_da_turma: number | null
		dados_incompletos: boolean
		flag_valor_negativo: boolean
		flag_grupo_pequeno: boolean
	}
}

export interface Coorte {
	tamanho_inicial: number | null
	base_minima: number
	cursos_iniciais: number
	serie: PontoCoorte[]
}

export function consultarCoorte(query: string, signal: AbortSignal) {
	return consultar<Coorte>(`/api/v1/analises/coorte?${query}`, signal)
}

export interface PontoTemporal extends Resumo {
	ano: number
}

export interface EvolucaoTemporal {
	serie: PontoTemporal[]
}

export function consultarEvolucao(query: string, signal: AbortSignal) {
	return consultar<EvolucaoTemporal>(
		`/api/v1/analises/evolucao-temporal?${query}`,
		signal
	)
}
