import type { Catalogo } from '../catalogos'
import type { SelecaoFiltros } from '../indicadores'
import type {
	DimensaoRanking,
	GrupoRanking,
	SituacaoRanking,
	TaxaDispersao
} from './api'

export const rankings: {
	dimensao: DimensaoRanking
	titulo: string
	filtro: keyof SelecaoFiltros
}[] = [
	{
		dimensao: 'area_geral',
		titulo: 'Áreas gerais CINE',
		filtro: 'codigo_area_geral'
	},
	{ dimensao: 'modalidade', titulo: 'Modalidades', filtro: 'modalidade' }
]

export const taxasRanking: { valor: TaxaDispersao; rotulo: string }[] = [
	{ valor: 'evasao_curso', rotulo: 'Evasão do curso' },
	{ valor: 'evasao_ies', rotulo: 'Evasão da instituição' }
]

// Como na comparação, cada ranking omite o filtro da própria dimensão: as
// demais categorias continuam visíveis, e a filtrada fica destacada.
export function serializarRanking(
	selecao: SelecaoFiltros,
	dimensao: DimensaoRanking,
	taxa: TaxaDispersao
) {
	const propria = rankings.find((r) => r.dimensao === dimensao)!.filtro
	const query = new URLSearchParams(
		Object.entries(selecao).filter(
			([chave, valor]) => valor !== '' && chave !== propria
		)
	)
	query.set('dimensao', dimensao)
	query.set('taxa', taxa)
	return query.toString()
}

export function lerTaxaRanking(parametros: URLSearchParams): TaxaDispersao {
	const taxa = parametros.get('taxa_ranking')
	return (
		taxasRanking.find((opcao) => opcao.valor === taxa)?.valor ??
		taxasRanking[0]!.valor
	)
}

export function rotuloCategoria(grupo: GrupoRanking['grupo']) {
	if (grupo.valor === null) return 'Não informado (sem identificador)'
	return grupo.nome && grupo.nome !== grupo.valor
		? `${grupo.nome} (${grupo.valor})`
		: grupo.valor
}

// Motivo de um grupo ficar sem posição, mostrado como primeiro aviso.
export const motivosSemPosicao: Record<SituacaoRanking, string> = {
	classificado: '',
	base_pequena: 'Sem posição: base de risco abaixo do mínimo',
	sem_taxa: 'Sem posição: taxa indisponível',
	sem_identificador: 'Sem posição: categoria sem identificador'
}

// "—" fora da classificação; o motivo fica nos avisos.
export function rotuloPosicao(grupo: GrupoRanking) {
	if (grupo.posicao === null) return '—'
	return `${grupo.posicao}º${grupo.empate ? ' (empate)' : ''}`
}

// Categorias do catálogo sem registros no recorte: aparecem como tal, sem
// valores zero, para o ranking cobrir todas as categorias.
export function categoriasSemRegistro(
	catalogo: Catalogo | null,
	dimensao: DimensaoRanking,
	grupos: GrupoRanking[]
) {
	const presentes = new Set(grupos.map(({ grupo }) => grupo.valor))
	const opcoes =
		dimensao === 'area_geral'
			? (catalogo?.areas_gerais ?? []).map(({ codigo, nome }) => ({
					valor: codigo,
					nome
				}))
			: (catalogo?.modalidades ?? []).map((valor) => ({ valor, nome: valor }))
	return opcoes
		.filter(({ valor }) => !presentes.has(valor))
		.map((grupo) => rotuloCategoria(grupo))
}

// Largura da barra em % da maior taxa classificada; negativos e grupos sem
// posição não têm barra.
export function larguraBarra(
	grupo: GrupoRanking,
	taxa: TaxaDispersao,
	maior: number
) {
	const valor = grupo.taxas[taxa]
	if (grupo.posicao === null || valor === null || valor <= 0 || maior <= 0)
		return 0
	return Math.min(100, (valor / maior) * 100)
}
