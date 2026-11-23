import type { GrupoComparacao, PontoTemporal } from './api'

// CSV para planilhas em português: separador ";", vírgula decimal e
// valores da API sem arredondamento. Taxas seguem como proporções (0,1 = 10%).
type Celula = string | number | boolean | null

function celula(valor: Celula): string {
	if (valor === null) return ''
	if (typeof valor === 'boolean') return valor ? 'sim' : 'não'
	if (typeof valor === 'number') return String(valor).replace('.', ',')
	// Evita que planilhas interpretem textos como fórmulas.
	const texto = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor
	return /[;"\r\n]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto
}

export function gerarCsv(cabecalho: string[], linhas: Celula[][]): string {
	return [cabecalho, ...linhas]
		.map((linha) => linha.map(celula).join(';'))
		.join('\r\n')
}

// Descreve o recorte com os nomes dos parâmetros da API, por exemplo
// "codigo_curso=001; modalidade=A distância".
export function descreverRecorte(parametros: Record<string, string>): string {
	const ativos = Object.entries(parametros).filter(([, valor]) => valor !== '')
	return ativos.length
		? ativos.map(([chave, valor]) => `${chave}=${valor}`).join('; ')
		: 'sem filtros'
}

const colunasMedidas = [
	'Vínculos',
	'Matrículas',
	'Ingressantes',
	'Concluintes',
	'Base de risco',
	'Evasão do curso (proporção)',
	'Evasão da instituição (proporção)',
	'Sem dados de alunos',
	'Registros com alunos',
	'Registros sem alunos',
	'Dados incompletos',
	'Valores negativos na origem',
	'Base inferior a 30',
	'Recorte'
]

function medidas(ponto: Omit<PontoTemporal, 'ano'>, recorte: string): Celula[] {
	return [
		ponto.totais.vinculos_total,
		ponto.totais.matriculas_total,
		ponto.totais.ingressantes_total,
		ponto.totais.concluintes_total,
		ponto.base_risco,
		ponto.taxas.evasao_curso,
		ponto.taxas.evasao_ies,
		ponto.qualidade.sem_dados,
		ponto.qualidade.registros_com_alunos,
		ponto.qualidade.registros_sem_alunos,
		ponto.qualidade.dados_incompletos,
		ponto.qualidade.flag_valor_negativo,
		ponto.qualidade.flag_grupo_pequeno,
		recorte
	]
}

export function csvEvolucao(serie: PontoTemporal[], recorte: string) {
	return gerarCsv(
		['Ano', ...colunasMedidas],
		serie.map((ponto) => [ponto.ano, ...medidas(ponto, recorte)])
	)
}

export function csvComparacao(grupos: GrupoComparacao[], recorte: string) {
	return gerarCsv(
		['Código do grupo', 'Nome do grupo', ...colunasMedidas],
		grupos.map((grupo) => [
			grupo.grupo.valor,
			grupo.grupo.nome,
			...medidas(grupo, recorte)
		])
	)
}
