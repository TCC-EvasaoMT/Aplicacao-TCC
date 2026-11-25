import {
	addLocale,
	localeOptions,
	type APIOptions,
	type PrimeReactPTOptions
} from 'primereact/api'
import { classNames } from 'primereact/utils'

// Textos dos componentes em português. O restante herda do locale padrão.
addLocale('pt-BR', {
	clear: 'Limpar',
	emptyMessage: 'Nenhuma opção disponível',
	emptyFilterMessage: 'Nenhum resultado encontrado',
	aria: {
		...(localeOptions('en') as { aria?: object }).aria,
		close: 'Fechar',
		listLabel: 'Opções',
		selectAll: 'Selecionar todos',
		unselectAll: 'Desmarcar todos'
	}
})

// Campo de formulário: mesma borda, altura e anel de foco em texto e listas.
const campo = (focado: boolean, invalido: boolean, desabilitado: boolean) =>
	classNames(
		'w-full min-h-10 rounded border bg-panel-surface text-base text-panel-ink transition-[border-color,box-shadow] duration-150 motion-reduce:transition-none',
		invalido
			? 'border-panel-invalid'
			: 'border-panel-border hover:border-panel-green',
		focado &&
			(invalido
				? 'ring-[0.2rem] ring-panel-invalid/20'
				: 'border-panel-green ring-[0.2rem] ring-panel-green/15'),
		desabilitado &&
			'pointer-events-none cursor-default bg-panel-background text-panel-muted'
	)

// Animação curta das listas; some para quem prefere menos movimento.
const transicaoSobreposta = {
	timeout: 120,
	classNames: {
		enter: 'opacity-0 -translate-y-1',
		enterActive:
			'opacity-100 translate-y-0 transition duration-100 ease-out motion-reduce:transition-none',
		exit: 'opacity-100',
		exitActive:
			'opacity-0 transition-opacity duration-75 motion-reduce:transition-none'
	}
}

// Componentes do PrimeReact em modo sem estilo: cada parte recebe classes
// Tailwind com os tokens do tema (styles.css). Só os componentes usados no
// painel estão configurados.
export const tema: PrimeReactPTOptions = {
	button: {
		root: (opcoes) => ({
			className: classNames(
				'inline-flex min-h-10 cursor-pointer select-none items-center justify-center gap-2 rounded border px-4 py-2 font-semibold leading-normal transition-colors duration-150 motion-reduce:transition-none',
				'disabled:cursor-default',
				opcoes?.props.size === 'small' ? 'text-sm' : 'text-base',
				opcoes?.props.outlined
					? 'border-panel-border bg-transparent text-panel-green hover:border-panel-green hover:bg-panel-chip active:bg-panel-green active:text-white disabled:border-panel-border disabled:bg-transparent disabled:text-panel-muted'
					: 'border-panel-green bg-panel-green text-white hover:border-panel-green-dark hover:bg-panel-green-dark active:bg-panel-green-darker disabled:border-panel-muted disabled:bg-panel-muted'
			)
		}),
		label: { className: 'flex-auto' }
	},
	inputtext: {
		root: (opcoes) => ({
			className: classNames(
				campo(false, !!opcoes?.props.invalid, !!opcoes?.props.disabled),
				'px-3 py-1.5 placeholder:text-panel-muted focus:outline-none',
				opcoes?.props.invalid
					? 'focus:ring-[0.2rem] focus:ring-panel-invalid/20'
					: 'focus:border-panel-green focus:ring-[0.2rem] focus:ring-panel-green/15'
			)
		})
	},
	dropdown: {
		root: (opcoes) => ({
			className: classNames(
				'relative inline-flex cursor-pointer select-none',
				campo(
					!!opcoes?.state.focused,
					!!opcoes?.props.invalid,
					!!opcoes?.props.disabled
				)
			)
		}),
		input: {
			className:
				'block min-w-0 flex-1 truncate px-3 py-1.5 text-left leading-normal'
		},
		// A seta e o select oculto só servem ao mouse e ao preenchimento
		// automático; o teclado e o leitor de tela usam o campo com foco.
		trigger: {
			className:
				'flex w-9 shrink-0 items-center justify-center text-panel-muted [&>svg]:size-3.5',
			'aria-hidden': true
		},
		select: { 'aria-hidden': true },
		panel: {
			className:
				'mt-1 max-w-[calc(100vw-1rem)] min-w-full rounded border border-panel-line bg-panel-surface text-panel-ink shadow-lg'
		},
		header: { className: 'border-b border-panel-line p-2' },
		filterContainer: { className: 'relative' },
		filterInput: {
			className:
				'w-full min-h-10 rounded border border-panel-border bg-panel-surface py-1.5 pr-9 pl-3 text-base text-panel-ink focus:border-panel-green focus:outline-none focus:ring-[0.2rem] focus:ring-panel-green/15'
		},
		filterIcon: {
			className:
				'pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-panel-muted'
		},
		wrapper: { className: 'max-h-64 overflow-auto overscroll-contain' },
		list: { className: 'm-0 list-none py-1' },
		item: (opcoes) => ({
			className: classNames(
				'cursor-pointer px-3 py-2 leading-snug',
				opcoes?.context.selected
					? 'bg-panel-chip font-semibold text-panel-green'
					: opcoes?.context.focused
						? 'bg-panel-hover'
						: 'hover:bg-panel-hover',
				opcoes?.context.disabled && 'cursor-default opacity-60'
			)
		}),
		emptyMessage: { className: 'px-3 py-2 text-panel-muted' },
		transition: transicaoSobreposta
	},
	checkbox: {
		root: (opcoes) => ({
			className: classNames(
				'relative inline-flex size-4 shrink-0 select-none self-start',
				'mt-1',
				opcoes?.props.disabled ? 'cursor-default opacity-50' : 'cursor-pointer'
			)
		}),
		input: {
			className:
				'peer absolute inset-0 z-10 m-0 size-full cursor-pointer appearance-none opacity-0 disabled:cursor-default'
		},
		box: (opcoes) => ({
			className: classNames(
				'flex size-4 items-center justify-center rounded border transition-colors duration-150 motion-reduce:transition-none',
				'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-panel-green',
				opcoes?.context.checked
					? 'border-panel-green bg-panel-green'
					: 'border-panel-border bg-panel-surface'
			)
		}),
		icon: { className: 'size-3 text-white' }
	},
	message: {
		root: (opcoes) => ({
			className: classNames(
				'rounded border px-4 py-3',
				// Com conteúdo próprio (texto e botão), o bloco empilha os itens.
				opcoes?.props.content ? 'block' : 'flex items-start gap-2',
				opcoes?.props.severity === 'error'
					? 'border-panel-danger-border bg-panel-danger-bg text-panel-danger'
					: 'border-panel-line bg-panel-surface text-panel-ink'
			)
		}),
		icon: { className: 'mt-1 size-4 shrink-0' },
		text: { className: 'block' }
	},
	progressspinner: {
		root: { className: 'relative inline-block size-4 shrink-0' },
		spinner: {
			className:
				'absolute inset-0 size-full origin-center animate-spin motion-reduce:animate-none'
		},
		circle: {
			className:
				'stroke-current [stroke-dasharray:90_150] [stroke-linecap:round]'
		}
	},
	// Gaveta dos filtros. O Sidebar do PrimeReact 10 se declara "complementary";
	// como cobre a página com máscara, é anunciado como diálogo modal.
	sidebar: {
		mask: { className: 'bg-panel-ink/45' },
		root: {
			className:
				'flex h-full w-full flex-col bg-panel-surface text-panel-ink shadow-xl sm:w-[26rem]',
			role: 'dialog',
			'aria-modal': true
		},
		header: {
			className:
				'flex items-center justify-between gap-4 bg-panel-green px-5 py-4 text-white'
		},
		closeButton: {
			className:
				'inline-flex size-10 items-center justify-center rounded text-white hover:bg-white/15 focus-visible:outline-white'
		},
		closeIcon: { className: 'size-4' },
		content: { className: 'flex-1 overflow-y-auto overscroll-contain p-5' },
		transition: {
			timeout: 200,
			classNames: {
				enter: 'translate-x-full',
				enterActive:
					'translate-x-0 transition-transform duration-200 ease-out motion-reduce:transition-none',
				exit: 'translate-x-0',
				exitActive:
					'translate-x-full transition-transform duration-150 ease-in motion-reduce:transition-none'
			}
		}
	},
	// Abas dos gráficos sobre a faixa verde do cabeçalho: a ativa assume a cor
	// do fundo da página, como uma pasta aberta sobre o conteúdo.
	tabmenu: {
		menu: { className: 'm-0 flex list-none gap-1 p-0' },
		menuitem: { className: 'flex flex-1 sm:flex-none' },
		inkbar: { className: 'hidden' },
		action: (opcoes) => ({
			className: classNames(
				'flex flex-1 items-center justify-center rounded-t-lg px-3 py-3 text-center text-sm leading-tight font-semibold no-underline transition-colors duration-150 focus-visible:-outline-offset-4 motion-reduce:transition-none sm:px-5 sm:text-base',
				opcoes?.props.activeIndex === opcoes?.context.index
					? 'bg-panel-background text-panel-green focus-visible:outline-panel-green'
					: 'text-white/85 hover:bg-white/10 hover:text-white focus-visible:outline-white'
			)
		})
	},
	accordion: {
		root: { className: 'm-0' },
		accordiontab: {
			headerAction: {
				className:
					'inline-flex cursor-pointer select-none items-center gap-2 rounded py-1 font-semibold text-panel-ink no-underline hover:text-panel-green'
			},
			headerIcon: { className: 'size-3.5 shrink-0' },
			content: { className: 'pt-1' },
			transition: {
				timeout: 150,
				classNames: {
					enter: 'max-h-0 overflow-hidden',
					enterActive:
						'max-h-[1000px] overflow-hidden transition-[max-height] duration-150 ease-out motion-reduce:transition-none',
					exit: 'max-h-[1000px] overflow-hidden',
					exitActive:
						'max-h-0 overflow-hidden transition-[max-height] duration-150 ease-in motion-reduce:transition-none'
				}
			}
		}
	}
}

export const configuracaoPrime: Partial<APIOptions> = {
	unstyled: true,
	pt: tema,
	// Classes passadas em `pt` de uma instância somam-se às do tema.
	ptOptions: { mergeSections: true, mergeProps: true },
	locale: 'pt-BR',
	ripple: false
}
