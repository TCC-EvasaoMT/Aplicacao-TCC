import type { Catalogo } from '../catalogos'
import type { SelecaoFiltros } from '../indicadores'

export const limiteGrupos = 20

export const dimensoesComparacao = {
	curso: { rotulo: 'Curso', catalogo: 'cursos', filtro: 'codigo_curso' },
	area_geral: {
		rotulo: 'Área geral CINE',
		catalogo: 'areas_gerais',
		filtro: 'codigo_area_geral'
	},
	municipio_oferta: {
		rotulo: 'Município de oferta',
		catalogo: 'municipios_oferta',
		filtro: 'codigo_municipio_oferta'
	},
	municipio_sede: {
		rotulo: 'Município da sede',
		catalogo: 'municipios_sede',
		filtro: 'codigo_municipio_sede'
	},
	modalidade: {
		rotulo: 'Modalidade',
		catalogo: 'modalidades',
		filtro: 'modalidade'
	},
	categoria_administrativa: {
		rotulo: 'Categoria administrativa',
		catalogo: 'categorias_administrativas',
		filtro: 'categoria_administrativa'
	},
	organizacao_academica: {
		rotulo: 'Organização acadêmica',
		catalogo: 'organizacoes_academicas',
		filtro: 'organizacao_academica'
	},
	grau_academico: {
		rotulo: 'Grau acadêmico',
		catalogo: 'graus_academicos',
		filtro: 'grau_academico'
	},
	capital: {
		rotulo: 'Capital ou interior',
		catalogo: 'capitais',
		filtro: 'capital'
	},
	turno: { rotulo: 'Turno do curso', catalogo: 'turnos', filtro: 'turno' }
} as const

export type DimensaoComparacao = keyof typeof dimensoesComparacao

// Ressalvas mostradas na comparação quando a dimensão é escolhida.
export const avisosDimensao: Partial<Record<DimensaoComparacao, string>> = {
	grau_academico:
		'O grau é o do último ano observado de cada curso, aplicado a todos os anos.',
	capital:
		'Cursos sem município de oferta, como os de EaD, ficam no grupo sem município, que não é filtrável.',
	turno:
		'Turno de oferta do curso. Não é o turno do aluno, que aparece no perfil de quem evade.'
}

// Rótulo do grupo sem identificador quando a dimensão tem um significado
// próprio para ele.
const semIdentificador: Partial<Record<DimensaoComparacao, string>> = {
	capital: 'Sem município de oferta (EaD ou não informado)'
}
export interface SelecaoComparacao {
	agrupar_por: DimensaoComparacao
	grupos: string[]
}

export const comparacaoPadrao: SelecaoComparacao = {
	agrupar_por: 'categoria_administrativa',
	grupos: []
}

// Comparação inicial a partir da URL; dimensão desconhecida volta ao padrão.
export function lerComparacao(parametros: URLSearchParams): SelecaoComparacao {
	const dimensao = parametros.get('agrupar_por') ?? ''
	if (!Object.hasOwn(dimensoesComparacao, dimensao)) return comparacaoPadrao
	const grupos = [
		...new Set(parametros.getAll('grupos').map((grupo) => grupo.trim()))
	]
		.filter(Boolean)
		.slice(0, limiteGrupos)
	return { agrupar_por: dimensao as DimensaoComparacao, grupos }
}

export function rotuloGrupo(
	grupo: { valor: string | null; nome: string | null },
	dimensao?: DimensaoComparacao
) {
	if (grupo.valor === null)
		return (
			(dimensao && semIdentificador[dimensao]) ??
			'Não informado (sem identificador)'
		)
	return grupo.nome && grupo.nome !== grupo.valor
		? `${grupo.nome} (${grupo.valor})`
		: grupo.valor
}

export function opcoesComparacao(
	catalogo: Catalogo | null,
	dimensao: DimensaoComparacao
) {
	return (catalogo?.[dimensoesComparacao[dimensao].catalogo] ?? []).map(
		(opcao) => {
			const grupo =
				typeof opcao === 'string'
					? { valor: opcao, nome: opcao }
					: { valor: opcao.codigo, nome: opcao.nome }
			return { valor: grupo.valor, rotulo: rotuloGrupo(grupo, dimensao) }
		}
	)
}

export function alternarGrupo(grupos: string[], valor: string): string[] {
	if (grupos.includes(valor)) return grupos.filter((grupo) => grupo !== valor)
	return grupos.length < limiteGrupos ? [...grupos, valor] : grupos
}

// Filtragem cruzada: o filtro da dimensão agrupada não restringe a própria
// comparação. Ele destaca o grupo, e os demais seguem visíveis para comparar;
// resumo e evolução recebem o filtro normalmente.
export function filtroDaDimensao(dimensao: DimensaoComparacao) {
	return dimensoesComparacao[dimensao].filtro
}

export function grupoEmDestaque(
	dimensao: DimensaoComparacao,
	selecao: SelecaoFiltros
): string {
	return selecao[filtroDaDimensao(dimensao)]
}

// Clique numa barra ou no botão da tabela: aplica o grupo como filtro e, se
// ele já estava aplicado, remove. Grupo sem identificador não é filtrável.
export function alternarFiltroGrupo(
	selecao: SelecaoFiltros,
	dimensao: DimensaoComparacao,
	valor: string | null
): SelecaoFiltros {
	if (valor === null) return selecao
	const filtro = filtroDaDimensao(dimensao)
	return { ...selecao, [filtro]: selecao[filtro] === valor ? '' : valor }
}

export function serializarComparacao(
	comparacao: SelecaoComparacao,
	selecao: SelecaoFiltros
) {
	const propria = filtroDaDimensao(comparacao.agrupar_por)
	const query = new URLSearchParams(
		Object.entries(selecao).filter(
			([chave, valor]) => valor !== '' && chave !== propria
		)
	)
	query.set('agrupar_por', comparacao.agrupar_por)
	query.set('limite', String(limiteGrupos))
	for (const grupo of comparacao.grupos) query.append('grupos', grupo)
	return query.toString()
}

export function gruposAusentes(
	selecionados: string[],
	retornados: { grupo: { valor: string | null } }[]
) {
	const valores = new Set(retornados.map(({ grupo }) => grupo.valor))
	return selecionados.filter((valor) => !valores.has(valor))
}
