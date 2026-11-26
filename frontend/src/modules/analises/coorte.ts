import type { SelecaoFiltros } from '../indicadores'
import type { Coorte, PontoCoorte } from './api'

export type TaxaTurma = 'evadiu' | 'evadiu_ies'

export const taxasTurma: { valor: TaxaTurma; rotulo: string }[] = [
	{ valor: 'evadiu', rotulo: 'Já evadiu do curso' },
	{ valor: 'evadiu_ies', rotulo: 'Já saiu da instituição' }
]

// A turma usa os filtros do painel, menos o ano do resumo: o ano aqui é o de
// ingresso, e a série cobre os censos seguintes.
export function serializarCoorte(selecao: SelecaoFiltros, anoIngresso: string) {
	const query = new URLSearchParams(
		Object.entries(selecao).filter(
			([chave, valor]) => valor !== '' && chave !== 'ano'
		)
	)
	query.set('ano_ingresso', anoIngresso)
	return query.toString()
}

// Turma da URL, se for um ano do catálogo; senão, a mais antiga, que tem o
// acompanhamento mais longo.
export function lerTurma(parametros: URLSearchParams, anos: number[]) {
	const turma = Number(parametros.get('turma'))
	if (anos.includes(turma)) return String(turma)
	return anos.length ? String(Math.min(...anos)) : ''
}

export function lerTaxaTurma(parametros: URLSearchParams): TaxaTurma {
	const taxa = parametros.get('taxa_turma')
	return (
		taxasTurma.find((opcao) => opcao.valor === taxa)?.valor ??
		taxasTurma[0]!.valor
	)
}

// Último ano com as três proporções, para a frase de resumo da turma.
export function ultimoAnoCompleto(coorte: Coorte, taxa: TaxaTurma) {
	return (
		[...coorte.serie]
			.reverse()
			.find(
				(p) =>
					p.taxas[taxa] !== null &&
					p.taxas.concluiu !== null &&
					p.taxas.continua !== null
			) ?? null
	)
}

export function avisosTurma(ponto: PontoCoorte, plural: Plural): string[] {
	const q = ponto.qualidade
	const avisos: string[] = []
	if (q.sem_dados) avisos.push('Sem linhas da turma neste ano')
	else if (q.cursos_iniciais_ausentes > 0)
		avisos.push(
			`${plural(q.cursos_iniciais_ausentes, 'curso da turma sem linha', 'cursos da turma sem linha')} no ano`
		)
	if (q.registros_fora_da_turma > 0)
		avisos.push(
			`${plural(q.registros_fora_da_turma, 'registro', 'registros')} de cursos sem linha inicial fora da turma`
		)
	if (q.dados_incompletos) avisos.push('Dados incompletos')
	if (q.flag_valor_negativo) avisos.push('Valores negativos na origem')
	if (q.flag_grupo_pequeno) avisos.push('Turma inicial inferior a 30')
	return avisos
}

type Plural = (
	quantidade: number,
	singular: string,
	formaPlural: string
) => string
