import type { ComponentProps } from 'react'
import { classNames } from 'primereact/utils'

// Peças de apresentação compartilhadas pelos módulos. Os controles vêm do
// PrimeReact (tema em lib/primereact.ts); aqui ficam textos, blocos e estados
// que se repetem entre os painéis.
export { classNames as cx }

export const classes = {
	// Bloco de seção: evolução, comparação e filtros.
	secao:
		'min-w-0 rounded-lg border border-panel-line bg-panel-surface p-4 sm:px-6 sm:pt-6 sm:pb-8',
	cabecalhoSecao: 'mb-4 flex flex-wrap items-center justify-between gap-4',
	rotulo: 'mb-1 block text-sm font-semibold',
	// Ano no cabeçalho do resumo e da comparação.
	campoAno: 'min-w-36',
	// Dados anteriores visíveis enquanto o novo recorte carrega.
	atualizando:
		'cursor-progress opacity-60 motion-safe:transition-opacity motion-safe:duration-150',
	contagem: 'text-sm font-semibold',
	estado: 'rounded-lg border border-panel-line bg-panel-surface p-6',
	estadoVazio:
		'rounded-lg border border-dashed border-panel-border bg-panel-surface p-6',
	estadoErro:
		'rounded-lg border border-panel-danger-border bg-panel-surface p-6 text-panel-danger'
}

// Texto auxiliar em cinza, abaixo de títulos e campos.
// A margem padrão sai quando a chamada define a sua (ex.: mt-6, my-0).
export function Ajuda({ className, ...props }: ComponentProps<'p'>) {
	const margemPropria = /(^|\s)m[tby]?-/.test(className ?? '')
	return (
		<p
			{...props}
			className={classNames(
				'max-w-[78ch] text-sm text-panel-muted',
				!margemPropria && 'my-2',
				className
			)}
		/>
	)
}

// Cuidados na leitura: valores negativos, truncamento, grupos ausentes.
export function Aviso({ className, ...props }: ComponentProps<'div'>) {
	return (
		<div
			{...props}
			className={classNames(
				'mt-4 border-l-[3px] border-panel-warning bg-panel-warning-bg px-4 py-3',
				className
			)}
		/>
	)
}
