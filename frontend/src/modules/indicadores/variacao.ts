// Variação contra o ano anterior, calculada na interface a partir de dois
// resumos da API. Não altera as fórmulas: compara valores já calculados.
export interface Variacao {
	direcao: 'alta' | 'queda' | 'estavel'
	// Valor absoluto já formatado, sem sinal: "5 p.p." ou "12,5%".
	texto: string
}

const pontos = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })
const relativa = new Intl.NumberFormat('pt-BR', {
	style: 'percent',
	maximumFractionDigits: 1
})

function direcao(valor: number): Variacao['direcao'] {
	return valor > 0 ? 'alta' : valor < 0 ? 'queda' : 'estavel'
}

// Taxas: diferença em pontos percentuais, com uma casa decimal.
export function variacaoTaxa(
	atual: number | null,
	anterior: number | null
): Variacao | null {
	if (atual === null || anterior === null) return null
	const diferenca = Math.round((atual - anterior) * 1000) / 10
	return {
		direcao: direcao(diferenca),
		texto: `${pontos.format(Math.abs(diferenca))} p.p.`
	}
}

// Totais: variação relativa; exige base anterior positiva.
export function variacaoTotal(
	atual: number | null,
	anterior: number | null
): Variacao | null {
	if (atual === null || anterior === null || anterior <= 0) return null
	const proporcao = Math.round(((atual - anterior) / anterior) * 1000) / 1000
	return {
		direcao: direcao(proporcao),
		texto: relativa.format(Math.abs(proporcao))
	}
}
