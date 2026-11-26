import type { SelecaoFiltros } from '../indicadores'
import type { CategoriaPerfil, Perfil, TaxaDispersao } from './api'

// Os 12 fatores de prioridade 1, com os códigos da API. Dois têm relação
// circular com a evasão e recebem uma ressalva na tela.
export const fatoresPerfil: {
	codigo: string
	rotulo: string
	ressalva?: string
}[] = [
	{ codigo: 'sexo', rotulo: 'Sexo' },
	{ codigo: 'cor_raca', rotulo: 'Cor/raça' },
	{ codigo: 'faixa_etaria', rotulo: 'Faixa etária' },
	{
		codigo: 'deficiencia',
		rotulo: 'Deficiência, TGD ou altas habilidades'
	},
	{ codigo: 'naturalidade', rotulo: 'Naturalidade' },
	{ codigo: 'escola_ensino_medio', rotulo: 'Escola do ensino médio' },
	{ codigo: 'cotas', rotulo: 'Entrou por cotas' },
	{ codigo: 'enem', rotulo: 'Entrou pelo Enem' },
	{ codigo: 'vestibular', rotulo: 'Entrou por vestibular' },
	{
		codigo: 'apoio_social',
		rotulo: 'Recebe apoio social',
		ressalva:
			'Só quem está vinculado ao curso recebe apoio social, e quem sai cedo tem menos tempo para recebê-lo. A diferença pode refletir essa condição, e não um efeito do apoio.'
	},
	{
		codigo: 'atividade_extracurricular',
		rotulo: 'Participa de atividade extracurricular',
		ressalva:
			'Só quem está vinculado ao curso participa de atividades extracurriculares, e quem sai cedo tem menos tempo para participar. A diferença pode refletir essa condição, e não um efeito da atividade.'
	},
	{ codigo: 'turno', rotulo: 'Turno do aluno' }
]

export const taxasPerfil: { valor: TaxaDispersao; rotulo: string }[] = [
	{ valor: 'evasao_curso', rotulo: 'Evasão do curso' },
	{ valor: 'evasao_ies', rotulo: 'Evasão da instituição' }
]

// O perfil usa todos os filtros do painel: não há dimensão própria a omitir.
export function serializarPerfil(selecao: SelecaoFiltros, fator: string) {
	const query = new URLSearchParams(
		Object.entries(selecao).filter(([, valor]) => valor !== '')
	)
	query.set('fator', fator)
	return query.toString()
}

export function lerFatorPerfil(parametros: URLSearchParams) {
	const fator = parametros.get('fator_perfil')
	return (
		fatoresPerfil.find((opcao) => opcao.codigo === fator)?.codigo ??
		fatoresPerfil[0]!.codigo
	)
}

export function lerTaxaPerfil(parametros: URLSearchParams): TaxaDispersao {
	const taxa = parametros.get('taxa_perfil')
	return (
		taxasPerfil.find((opcao) => opcao.valor === taxa)?.valor ??
		taxasPerfil[0]!.valor
	)
}

// Categorias comparáveis: taxa calculável e base de pelo menos base_minima.
// Devolve a de maior e a de menor taxa para o texto de associação, ou null
// quando não há duas para comparar.
export function extremosPerfil(perfil: Perfil, taxa: TaxaDispersao) {
	const comparaveis = perfil.categorias.filter(
		(c): c is CategoriaPerfil & { base_risco: number } =>
			c.taxas[taxa] !== null &&
			c.base_risco !== null &&
			c.base_risco >= perfil.base_minima
	)
	if (comparaveis.length < 2) return null
	const ordenadas = [...comparaveis].sort(
		(a, b) => b.taxas[taxa]! - a.taxas[taxa]!
	)
	return {
		maior: ordenadas[0]!,
		menor: ordenadas.at(-1)!,
		comparaveis: comparaveis.length
	}
}

// Largura da barra em % da maior taxa entre as categorias; negativos e
// ausentes não têm barra.
export function larguraPerfil(valor: number | null, maior: number) {
	if (valor === null || valor <= 0 || maior <= 0) return 0
	return Math.min(100, (valor / maior) * 100)
}
