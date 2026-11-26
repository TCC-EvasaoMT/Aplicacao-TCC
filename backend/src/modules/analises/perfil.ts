import {
	calcularResumo,
	type Agregado,
	type FiltrosRecorte
} from '../indicadores/index.js'
import { BASE_MINIMA } from './dispersao.js'

// Os 12 fatores de prioridade 1 do catálogo de perfil. O nome é o de
// gold.dim_perfil.fator, que junto do código da categoria identifica a linha.
export const fatoresPerfil = {
	sexo: { nome: 'Sexo', grupo: 'Demográfico' },
	cor_raca: { nome: 'Cor/raça', grupo: 'Demográfico' },
	faixa_etaria: { nome: 'Faixa etária', grupo: 'Demográfico' },
	deficiencia: {
		nome: 'Pessoa com deficiência, transtorno global do desenvolvimento ou altas habilidades',
		grupo: 'Demográfico'
	},
	naturalidade: { nome: 'Naturalidade', grupo: 'Demográfico' },
	escola_ensino_medio: {
		nome: 'Escola do ensino médio',
		grupo: 'Trajetória escolar'
	},
	cotas: { nome: 'Entrou por reserva de vagas (cotas)', grupo: 'Ingresso' },
	enem: { nome: 'Entrou pelo Enem', grupo: 'Ingresso' },
	vestibular: { nome: 'Entrou por vestibular', grupo: 'Ingresso' },
	apoio_social: { nome: 'Recebe apoio social', grupo: 'Permanência' },
	atividade_extracurricular: {
		nome: 'Participa de atividade extracurricular',
		grupo: 'Engajamento'
	},
	turno: { nome: 'Turno do aluno', grupo: 'Oferta' }
} as const

export type FatorPerfil = keyof typeof fatoresPerfil
export const codigosFatores = Object.keys(fatoresPerfil) as FatorPerfil[]

export interface FiltrosPerfil extends FiltrosRecorte {
	ano: number
	fator: FatorPerfil
}

export type AgregadoPerfil = Agregado & {
	conjunto: boolean
	codigo_categoria: string | null
	categoria: string | null
	ordem_categoria: number | null
}

// A fato de perfil não tem ingressantes: o resumo de cada categoria sai sem
// esse total e sem os avisos ligados a ele.
function resumoDaCategoria(agregado: Agregado) {
	const { totais, qualidade, ...resto } = calcularResumo(agregado)
	const { ingressantes_total: _i, ...semIngressantes } = totais
	const {
		registros_sem_ingressantes: _r,
		ingressantes_minimo: _m,
		...qualidadePerfil
	} = qualidade
	return { ...resto, totais: semIngressantes, qualidade: qualidadePerfil }
}

export function montarPerfil(agregados: AgregadoPerfil[], fator: FatorPerfil) {
	const conjunto = agregados.find((a) => a.conjunto)
	const categorias = agregados.filter((a) => !a.conjunto)
	return {
		fator: { codigo: fator, ...fatoresPerfil[fator] },
		base_minima: BASE_MINIMA,
		// Soma de todas as categorias do fator, antes de dividir. Pode diferir do
		// resumo: cada fator é uma consulta própria ao SEDAP+, com ruído e grupos
		// omitidos.
		conjunto:
			categorias.length && conjunto ? resumoDaCategoria(conjunto) : null,
		categorias: categorias.map(
			({ codigo_categoria, categoria, ordem_categoria, ...agregado }) => ({
				categoria: {
					codigo: codigo_categoria,
					nome: categoria ?? 'Sem rótulo no catálogo',
					ordem: ordem_categoria
				},
				...resumoDaCategoria(agregado)
			})
		)
	}
}
