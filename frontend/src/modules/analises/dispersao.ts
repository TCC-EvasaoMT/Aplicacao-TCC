import type { SelecaoFiltros } from '../indicadores'
import type { CursoDispersao, Dispersao, TaxaDispersao } from './api'

export const taxasDispersao: { valor: TaxaDispersao; rotulo: string }[] = [
	{ valor: 'evasao_curso', rotulo: 'Evasão do curso' },
	{ valor: 'evasao_ies', rotulo: 'Evasão da instituição' }
]

// Série de cada ponto. A forma também muda, para não depender só da cor.
export type SerieDispersao = 'critica' | 'significativa' | 'pequena'

export interface PontoDispersao {
	codigo: string | null
	rotulo: string
	matriculas: number
	taxa: number
	base: number | null
	serie: SerieDispersao
}

export function rotuloCurso(curso: CursoDispersao['curso']) {
	if (curso.codigo === null) return 'Não informado (sem identificador)'
	return curso.nome && curso.nome !== curso.codigo
		? `${curso.nome} (${curso.codigo})`
		: curso.codigo
}

// Só cursos com matrículas e com a taxa escolhida têm ponto no gráfico.
export function pontosDispersao(
	dados: Dispersao,
	taxa: TaxaDispersao
): Record<SerieDispersao, PontoDispersao[]> {
	const series: Record<SerieDispersao, PontoDispersao[]> = {
		critica: [],
		significativa: [],
		pequena: []
	}
	for (const curso of dados.cursos) {
		const matriculas = curso.totais.matriculas_total
		const valor = curso.taxas[taxa]
		if (matriculas === null || valor === null) continue
		const serie: SerieDispersao = curso.zona_critica[taxa]
			? 'critica'
			: curso.base_risco !== null &&
				  curso.base_risco >= dados.referencias.base_minima
				? 'significativa'
				: 'pequena'
		series[serie].push({
			codigo: curso.curso.codigo,
			rotulo: rotuloCurso(curso.curso),
			matriculas,
			taxa: valor,
			base: curso.base_risco,
			serie
		})
	}
	return series
}

export function contagensDispersao(dados: Dispersao, taxa: TaxaDispersao) {
	const series = pontosDispersao(dados, taxa)
	const noGrafico =
		series.critica.length + series.significativa.length + series.pequena.length
	return {
		cursos: dados.cursos.length,
		noGrafico,
		semPonto: dados.cursos.length - noGrafico,
		criticos: series.critica.length,
		pequenos: series.pequena.length
	}
}

// Como na comparação, o filtro de curso não restringe a dispersão: ele
// destaca o curso e filtra resumo e evolução.
export function serializarDispersao(selecao: SelecaoFiltros) {
	return new URLSearchParams(
		Object.entries(selecao).filter(
			([chave, valor]) => valor !== '' && chave !== 'codigo_curso'
		)
	).toString()
}

// Teto do eixo de matrículas: 8% acima do maior valor, arredondado para um
// número redondo (648 → 700; 1.391 → 1.500).
export function tetoMatriculas(maior: number) {
	const alvo = maior * 1.08
	if (!(alvo > 0)) return 1
	const potencia = 10 ** Math.floor(Math.log10(alvo))
	const fator = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 10].find(
		(f) => f * potencia >= alvo - 1e-9
	)!
	return Number((fator * potencia).toPrecision(12))
}

export function lerTaxaDispersao(parametros: URLSearchParams): TaxaDispersao {
	const taxa = parametros.get('taxa_dispersao')
	return (
		taxasDispersao.find((opcao) => opcao.valor === taxa)?.valor ??
		taxasDispersao[0]!.valor
	)
}
