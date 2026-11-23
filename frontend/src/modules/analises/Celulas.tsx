import { formatarTaxa } from './apresentacao'

const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })

// Ausência nas tabelas segue a convenção do IBGE ("..." para dado numérico
// não disponível). O leitor de tela ouve "Não disponível".
function Ausente() {
	return (
		<>
			<span aria-hidden="true">...</span>
			<span className="visually-hidden">Não disponível</span>
		</>
	)
}

export function CelulaNumero({ valor }: { valor: number | null }) {
	return (
		<td className="text-end">
			{valor === null ? <Ausente /> : numero.format(valor)}
		</td>
	)
}

export function CelulaTaxa({ valor }: { valor: number | null }) {
	return (
		<td className="text-end">
			{valor === null ? <Ausente /> : formatarTaxa(valor)}
		</td>
	)
}

export function NotaTabela() {
	return (
		<p className="filter-help table-note">
			<span aria-hidden="true">...</span> dado não disponível; não equivale a
			zero.{' '}
			<span className="table-scroll-help">
				Deslize a tabela para ver todas as colunas.
			</span>
		</p>
	)
}
