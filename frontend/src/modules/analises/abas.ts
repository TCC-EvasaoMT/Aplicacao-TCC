// Abas dos gráficos, no cabeçalho da página. A aba ativa fica na URL (?aba=)
// para recarregar e compartilhar a mesma visão; a primeira é o padrão.
export const abasAnalise = [
	{ id: 'evolucao', label: 'Evolução temporal' },
	{ id: 'comparacao', label: 'Comparação entre grupos' }
] as const

export type AbaAnalise = (typeof abasAnalise)[number]['id']

export function lerAba(parametros: URLSearchParams): AbaAnalise {
	const aba = parametros.get('aba')
	return abasAnalise.find((item) => item.id === aba)?.id ?? 'evolucao'
}
