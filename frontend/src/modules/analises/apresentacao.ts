import type { Resumo } from '../indicadores'

const percentual = new Intl.NumberFormat('pt-BR', {
	style: 'percent',
	maximumFractionDigits: 2
})

export function formatarTaxa(valor: number | null): string {
	return valor === null ? 'Não disponível' : percentual.format(valor)
}

export function avisosDoRecorte(
	ponto: Pick<Resumo, 'base_risco' | 'qualidade'>
): string[] {
	const avisos: string[] = []
	const qualidade = ponto.qualidade
	if (qualidade.sem_dados) avisos.push('Sem dados de alunos')
	if (qualidade.registros_sem_alunos > 0)
		avisos.push(
			`${qualidade.registros_sem_alunos} registro(s) sem contagens de alunos`
		)
	if (qualidade.dados_incompletos) avisos.push('Dados incompletos')
	if (qualidade.flag_valor_negativo) avisos.push('Valores negativos na origem')
	if (qualidade.flag_grupo_pequeno) avisos.push('Base inferior a 30')
	if (ponto.base_risco !== null && ponto.base_risco <= 0)
		avisos.push('Base não positiva; taxas indisponíveis')
	return avisos
}
