import type { Catalogo, OpcaoCodigo } from '../catalogos'

export const camposFiltro = [
	{ chave: 'codigo_curso', catalogo: 'cursos', rotulo: 'Curso' },
	{
		chave: 'codigo_area_geral',
		catalogo: 'areas_gerais',
		rotulo: 'Área geral CINE'
	},
	{ chave: 'modalidade', catalogo: 'modalidades', rotulo: 'Modalidade' },
	{
		chave: 'categoria_administrativa',
		catalogo: 'categorias_administrativas',
		rotulo: 'Categoria administrativa'
	},
	{
		chave: 'organizacao_academica',
		catalogo: 'organizacoes_academicas',
		rotulo: 'Organização acadêmica'
	},
	{
		chave: 'codigo_municipio_oferta',
		catalogo: 'municipios_oferta',
		rotulo: 'Município de oferta'
	},
	{
		chave: 'codigo_municipio_sede',
		catalogo: 'municipios_sede',
		rotulo: 'Município da sede'
	}
] as const

export type SelecaoFiltros = Record<
	'ano' | (typeof camposFiltro)[number]['chave'],
	string
>

export function limparFiltros(ano = ''): SelecaoFiltros {
	return {
		ano,
		codigo_curso: '',
		codigo_area_geral: '',
		modalidade: '',
		categoria_administrativa: '',
		organizacao_academica: '',
		codigo_municipio_oferta: '',
		codigo_municipio_sede: ''
	}
}

export type CampoFiltro = (typeof camposFiltro)[number]['chave']

export function rotuloOpcao(opcao: string | OpcaoCodigo) {
	return typeof opcao === 'string'
		? opcao
		: `${opcao.nome ?? 'Nome não informado'} (${opcao.codigo})`
}

export interface FiltroAtivo {
	chave: CampoFiltro
	valor: string
	campo: string
	texto: string
}

// Filtros aplicados, na ordem dos campos, com o rótulo do catálogo
// ("Curso: Pedagogia (001)"). Valor fora do catálogo aparece como veio.
export function filtrosAtivos(
	selecao: SelecaoFiltros,
	catalogo: Catalogo | null
): FiltroAtivo[] {
	return camposFiltro.flatMap((campo) => {
		const valor = selecao[campo.chave]
		if (!valor) return []
		const opcao = (catalogo?.[campo.catalogo] ?? []).find(
			(item) => (typeof item === 'string' ? item : item.codigo) === valor
		)
		return [
			{
				chave: campo.chave,
				valor,
				campo: campo.rotulo,
				texto: opcao ? rotuloOpcao(opcao) : valor
			}
		]
	})
}

// Ano escolhido no gráfico: só anos do catálogo entram no resumo.
export function selecionarAno(
	selecao: SelecaoFiltros,
	ano: number,
	anos: number[]
): SelecaoFiltros {
	return anos.includes(ano) && selecao.ano !== String(ano)
		? { ...selecao, ano: String(ano) }
		: selecao
}

// Seleção inicial a partir da URL; valores fora do catálogo são removidos
// depois por atualizarSelecao.
export function lerSelecao(parametros: URLSearchParams): SelecaoFiltros {
	const selecao = limparFiltros()
	for (const chave of Object.keys(selecao) as (keyof SelecaoFiltros)[])
		selecao[chave] = parametros.get(chave)?.trim() ?? ''
	return selecao
}

export function serializarFiltros(filtros: SelecaoFiltros): string {
	return new URLSearchParams(
		Object.entries(filtros).filter(([, valor]) => valor !== '')
	).toString()
}

export function atualizarSelecao(
	atual: SelecaoFiltros,
	catalogo: Catalogo
): SelecaoFiltros {
	const anos = catalogo.anos.map(String)
	const proximo = {
		...atual,
		ano: anos.includes(atual.ano) ? atual.ano : (anos[0] ?? '')
	}
	for (const campo of camposFiltro) {
		const existe = catalogo[campo.catalogo].some(
			(opcao) =>
				(typeof opcao === 'string' ? opcao : opcao.codigo) ===
				atual[campo.chave]
		)
		if (!existe) proximo[campo.chave] = ''
	}
	return proximo
}
