import type { ReactNode } from 'react'
import { Button } from 'primereact/button'
import { Ajuda, cx } from '../../lib/ui'
import { formatarTaxa } from './apresentacao'

const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })

// Classes das tabelas da evolução e da comparação.
const base =
	'border-b border-panel-border p-2 sm:p-3 motion-safe:transition-colors motion-safe:duration-150'
const largura = 'min-w-20 sm:min-w-[105px]'
const fundoCabecalho =
	'border-panel-green bg-panel-green align-bottom font-semibold text-white'
const fundoCorpo = 'bg-panel-surface align-top'
const cabecalho = cx(base, largura, fundoCabecalho)
const corpo = cx(base, largura, fundoCorpo)
export const classesTabela = {
	cabecalho: cx(cabecalho, 'text-left'),
	cabecalhoNumero: cx(cabecalho, 'text-right'),
	linhaCabecalho: cx(corpo, 'text-left font-semibold'),
	texto: corpo,
	numero: cx(corpo, 'text-right whitespace-nowrap')
}

// Mesmas células sem largura mínima, para colunas que definem a própria largura
// (combinar duas larguras mínimas deixaria a ordem do CSS decidir).
export const classesTabelaCompacta = {
	cabecalho: cx(base, fundoCabecalho, 'text-left'),
	cabecalhoNumero: cx(base, fundoCabecalho, 'text-right'),
	linhaCabecalho: cx(base, fundoCorpo, 'text-left font-semibold'),
	texto: cx(base, fundoCorpo),
	numero: cx(base, fundoCorpo, 'text-right whitespace-nowrap')
}

// Filtragem cruzada: linha da tabela ligada ao gráfico. A linha selecionada
// ganha fundo e barra lateral, sem depender só da cor.
export function classesLinha(selecionada: boolean, ativa: boolean) {
	return cx(
		selecionada
			? '*:bg-panel-chip [&>th]:shadow-[inset_3px_0_0_var(--color-panel-green)]'
			: ativa && '*:bg-panel-hover'
	)
}

// Botão de ano ou grupo na primeira coluna: aplica a mesma ação do gráfico
// pelo teclado e por leitores de tela.
export const classesLinkFiltro = cx(
	'-mx-1 -my-0.5 rounded px-1 py-0.5 text-left font-semibold text-panel-green underline decoration-1 underline-offset-[3px]',
	'hover:bg-panel-chip hover:decoration-2 aria-pressed:no-underline aria-pressed:after:content-["_✓"]',
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-ink',
	'motion-safe:transition-colors motion-safe:duration-150'
)

export function ListaAvisos({ avisos }: { avisos: string[] }) {
	if (!avisos.length) return <>Sem sinalizações</>
	return (
		<ul className="m-0 min-w-[170px] list-disc pl-4 [&>li+li]:mt-1">
			{avisos.map((aviso) => (
				<li key={aviso}>{aviso}</li>
			))}
		</ul>
	)
}

// Tabela com rolagem horizontal própria: a página não ganha rolagem lateral.
export function Tabela({
	rotulo,
	legenda,
	children
}: {
	rotulo: string
	legenda: string
	children: ReactNode
}) {
	return (
		<div
			// relative contém os textos sr-only (absolutos) dentro da rolagem.
			className="relative mt-6 overflow-x-auto"
			role="region"
			aria-label={rotulo}
			tabIndex={0}
		>
			<table className="mb-4 w-full border-collapse text-sm text-panel-ink tabular-nums">
				<caption className="mb-2 caption-top py-2 text-left font-semibold">
					{legenda}
				</caption>
				{children}
			</table>
		</div>
	)
}

// Ausência nas tabelas segue a convenção do IBGE ("..." para dado numérico
// não disponível). O leitor de tela ouve "Não disponível".
function Ausente() {
	return (
		<>
			<span aria-hidden="true">...</span>
			<span className="sr-only">Não disponível</span>
		</>
	)
}

export function CelulaNumero({
	valor,
	minimo = false,
	compacta = false
}: {
	valor: number | null
	minimo?: boolean
	compacta?: boolean
}) {
	return (
		<td className={(compacta ? classesTabelaCompacta : classesTabela).numero}>
			{valor === null ? (
				<Ausente />
			) : (
				<>
					{minimo && (
						<>
							<span aria-hidden="true">≥ </span>
							<span className="sr-only">ao menos </span>
						</>
					)}
					{numero.format(valor)}
				</>
			)}
		</td>
	)
}

export function CelulaTaxa({ valor }: { valor: number | null }) {
	return (
		<td className={classesTabela.numero}>
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
		<div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
			<Ajuda className="my-0">
				<span aria-hidden="true">...</span> dado não disponível; não equivale a
				zero.{' '}
				<span className="sm:hidden">
					Deslize a tabela para ver todas as colunas.
				</span>
			</Ajuda>
			{exportar && (
				<Button
					label="Baixar CSV"
					outlined
					size="small"
					aria-label={exportar.rotulo}
					onClick={() => baixarCsv(exportar.arquivo, exportar.gerar())}
				/>
			)}
		</div>
	)
}
