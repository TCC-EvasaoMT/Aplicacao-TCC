import type { Resumo } from '../indicadores'

const percentual = new Intl.NumberFormat('pt-BR', {
	style: 'percent',
	maximumFractionDigits: 2
})

// Concordância simples de número: plural(2, 'grupo', 'grupos') → '2 grupos'.
export function plural(
	quantidade: number,
	singular: string,
	formaPlural: string
) {
	const numero = new Intl.NumberFormat('pt-BR').format(quantidade)
	return `${numero} ${quantidade === 1 ? singular : formaPlural}`
}

export function formatarTaxa(valor: number | null): string {
	return valor === null ? 'Não disponível' : percentual.format(valor)
}

// Escala dos gráficos de taxas: sempre inclui o zero e usa passos
// arredondados (1, 2, 2,5 ou 5 vezes uma potência de 10), com até seis
// intervalos. Não altera os valores; só define eixo e marcas.
export function escalaTaxas(valores: (number | null)[]): {
	dominio: [number, number]
	marcas: number[]
} {
	const numeros = valores.filter(
		(valor): valor is number => valor !== null && Number.isFinite(valor)
	)
	const minimo = Math.min(0, ...numeros)
	const maximo = Math.max(0, ...numeros)
	const bruto = (maximo - minimo) / 5 || 0.01
	const potencia = 10 ** Math.floor(Math.log10(bruto))
	const passo =
		[1, 2, 2.5, 5, 10]
			.map((fator) => fator * potencia)
			.find((candidato) => candidato >= bruto - 1e-12) ?? 10 * potencia
	const inicio = Math.floor(minimo / passo + 1e-9)
	const fim = Math.max(inicio + 1, Math.ceil(maximo / passo - 1e-9))
	const marcas: number[] = []
	for (let indice = inicio; indice <= fim; indice++)
		marcas.push(Number((indice * passo).toPrecision(12)))
	return { dominio: [marcas[0] ?? 0, marcas.at(-1) ?? passo], marcas }
}

export function avisosDoRecorte(
	ponto: Pick<Resumo, 'base_risco' | 'qualidade'>
): string[] {
	const avisos: string[] = []
	const qualidade = ponto.qualidade
	if (qualidade.sem_dados) avisos.push('Sem dados de alunos')
	if (qualidade.registros_sem_alunos > 0)
		avisos.push(
			`${plural(qualidade.registros_sem_alunos, 'registro', 'registros')} sem contagens de alunos`
		)
	if (qualidade.dados_incompletos) avisos.push('Dados incompletos')
	if (qualidade.flag_valor_negativo) avisos.push('Valores negativos na origem')
	if (qualidade.flag_grupo_pequeno) avisos.push('Base inferior a 30')
	if (ponto.base_risco !== null && ponto.base_risco <= 0)
		avisos.push('Base não positiva; taxas indisponíveis')
	return avisos
}
