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

function baixarCsv(arquivo: string, conteudo: string) {
	// O BOM faz o Excel reconhecer UTF-8 (acentos).
	const blob = new Blob(['﻿', conteudo], {
		type: 'text/csv;charset=utf-8'
	})
	const url = URL.createObjectURL(blob)
	const link = document.createElement('a')
	link.href = url
	link.download = arquivo
	document.body.append(link)
	link.click()
	link.remove()
	setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function NotaTabela({
	exportar
}: {
	exportar?: { arquivo: string; rotulo: string; gerar: () => string }
}) {
	return (
		<div className="table-footer">
			<p className="filter-help table-note">
				<span aria-hidden="true">...</span> dado não disponível; não equivale a
				zero.{' '}
				<span className="table-scroll-help">
					Deslize a tabela para ver todas as colunas.
				</span>
			</p>
			{exportar && (
				<button
					className="btn btn-outline-success btn-sm"
					type="button"
					aria-label={exportar.rotulo}
					onClick={() => baixarCsv(exportar.arquivo, exportar.gerar())}
				>
					Baixar CSV
				</button>
			)}
		</div>
	)
}
