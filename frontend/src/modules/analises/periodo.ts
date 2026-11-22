import type { SelecaoFiltros } from '../indicadores'

export interface Periodo {
	ano_inicial: string
	ano_final: string
}

export function periodoInicial(anos: number[]): Periodo {
	if (!anos.length) return { ano_inicial: '', ano_final: '' }
	const fim = Math.max(...anos)
	return {
		ano_inicial: String(Math.max(Math.min(...anos), fim - 29)),
		ano_final: String(fim)
	}
}

export function validarPeriodo(periodo: Periodo): string {
	const valores = [periodo.ano_inicial, periodo.ano_final]
	if (valores.some((valor) => !/^\d{4}$/.test(valor) || Number(valor) < 1900))
		return 'Informe anos inteiros entre 1900 e 9999.'
	const inicio = Number(periodo.ano_inicial)
	const fim = Number(periodo.ano_final)
	if (inicio > fim) return 'O ano final deve ser maior ou igual ao inicial.'
	if (fim - inicio >= 30)
		return 'Selecione no máximo 30 anos, incluindo os extremos.'
	return ''
}

export function serializarEvolucao(periodo: Periodo, selecao: SelecaoFiltros) {
	const { ano: _anoResumo, ...recorte } = selecao
	return new URLSearchParams(
		Object.entries({ ...periodo, ...recorte }).filter(
			([, valor]) => valor !== ''
		)
	).toString()
}
