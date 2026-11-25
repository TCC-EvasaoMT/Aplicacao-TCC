// Abas do painel, no cabeçalho da página. A aba ativa fica na URL (?aba=)
// para recarregar e compartilhar a mesma visão; a primeira é o padrão.
// Rótulos curtos cabem em uma linha no celular; os títulos completos ficam
// nas seções.
export const abasPainel = [
	{ id: 'resumo', label: 'Resumo' },
	{ id: 'evolucao', label: 'Evolução' },
	{ id: 'comparacao', label: 'Comparação' }
] as const

export type AbaPainel = (typeof abasPainel)[number]['id']

export function lerAba(parametros: URLSearchParams): AbaPainel {
	const aba = parametros.get('aba')
	return abasPainel.find((item) => item.id === aba)?.id ?? abasPainel[0].id
}
