import type {
	CategoriaPerfil,
	PontoCoorte,
	CursoDispersao,
	GrupoComparacao,
	GrupoRanking,
	PontoTemporal
} from './api'

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
	'Ingressantes é mínimo',
	'Concluintes',
	'Base de risco',
	'Evasão do curso (proporção)',
	'Evasão da instituição (proporção)',
	'Sem dados de alunos',
	'Registros com alunos',
	'Registros sem alunos',
	'Registros sem ingressantes',
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
		ponto.qualidade.ingressantes_minimo,
		ponto.totais.concluintes_total,
		ponto.base_risco,
		ponto.taxas.evasao_curso,
		ponto.taxas.evasao_ies,
		ponto.qualidade.sem_dados,
		ponto.qualidade.registros_com_alunos,
		ponto.qualidade.registros_sem_alunos,
		ponto.qualidade.registros_sem_ingressantes,
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

export function csvDispersao(cursos: CursoDispersao[], recorte: string) {
	return gerarCsv(
		[
			'Código do curso',
			'Nome do curso',
			...colunasMedidas.slice(0, -1),
			'Zona crítica (evasão do curso)',
			'Zona crítica (evasão da instituição)',
			'Recorte'
		],
		cursos.map((curso) => [
			curso.curso.codigo,
			curso.curso.nome,
			...medidas(curso, recorte).slice(0, -1),
			curso.zona_critica.evasao_curso,
			curso.zona_critica.evasao_ies,
			recorte
		])
	)
}

const situacoesCsv: Record<GrupoRanking['situacao'], string> = {
	classificado: 'classificado',
	base_pequena: 'base pequena',
	sem_taxa: 'sem taxa',
	sem_identificador: 'sem identificador'
}

export function csvRanking(grupos: GrupoRanking[], recorte: string) {
	return gerarCsv(
		['Posição', 'Empate', 'Situação', 'Código', 'Nome', ...colunasMedidas],
		grupos.map((grupo) => [
			grupo.posicao,
			grupo.empate,
			situacoesCsv[grupo.situacao],
			grupo.grupo.valor,
			grupo.grupo.nome,
			...medidas(grupo, recorte)
		])
	)
}

// Perfil: sem ingressantes, que a fato de perfil não tem. A última linha é o
// conjunto do fator.
export function csvPerfil(
	fator: string,
	categorias: CategoriaPerfil[],
	recorte: string
) {
	return gerarCsv(
		[
			'Fator',
			'Código da categoria',
			'Categoria',
			'Vínculos',
			'Matrículas',
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
		],
		categorias.map((c) => [
			fator,
			c.categoria.codigo,
			c.categoria.nome,
			c.totais.vinculos_total,
			c.totais.matriculas_total,
			c.totais.concluintes_total,
			c.base_risco,
			c.taxas.evasao_curso,
			c.taxas.evasao_ies,
			c.qualidade.sem_dados,
			c.qualidade.registros_com_alunos,
			c.qualidade.registros_sem_alunos,
			c.qualidade.dados_incompletos,
			c.qualidade.flag_valor_negativo,
			c.qualidade.flag_grupo_pequeno,
			recorte
		])
	)
}

// Turma de ingresso: proporções sobre o tamanho inicial, sem arredondamento.
export function csvCoorte(
	anoIngresso: number,
	tamanhoInicial: number,
	serie: PontoCoorte[],
	recorte: string
) {
	return gerarCsv(
		[
			'Ano de ingresso',
			'Tamanho inicial',
			'Ano do censo',
			'Anos desde o ingresso',
			'Vínculos no ano',
			'Já evadiu do curso (proporção)',
			'Já saiu da instituição (proporção)',
			'Já concluiu (proporção)',
			'Continua no curso (proporção)',
			'Resíduo (proporção)',
			'Sem dados da turma',
			'Cursos da turma ausentes no ano',
			'Registros fora da turma',
			'Vínculos fora da turma',
			'Dados incompletos',
			'Valores negativos na origem',
			'Turma inferior a 30',
			'Recorte'
		],
		serie.map((p) => [
			anoIngresso,
			tamanhoInicial,
			p.ano,
			p.anos_desde_ingresso,
			p.totais.vinculos_total,
			p.taxas.evadiu,
			p.taxas.evadiu_ies,
			p.taxas.concluiu,
			p.taxas.continua,
			p.taxas.residuo,
			p.qualidade.sem_dados,
			p.qualidade.cursos_iniciais_ausentes,
			p.qualidade.registros_fora_da_turma,
			p.qualidade.vinculos_fora_da_turma,
			p.qualidade.dados_incompletos,
			p.qualidade.flag_valor_negativo,
			p.qualidade.flag_grupo_pequeno,
			recorte
		])
	)
}
