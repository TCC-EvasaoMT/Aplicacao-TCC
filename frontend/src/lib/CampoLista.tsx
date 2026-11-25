import { useEffect, useRef, useState } from 'react'
import { Dropdown, type DropdownProps } from 'primereact/dropdown'

export interface OpcaoLista {
	value: string
	label: string
}

interface Props extends Omit<
	DropdownProps,
	'options' | 'value' | 'onChange' | 'optionLabel' | 'optionValue'
> {
	inputId: string
	value: string
	options: OpcaoLista[]
	onChange: (valor: string) => void
}

// Lista de seleção do PrimeReact com ajustes de acessibilidade. No Dropdown
// do PrimeReact 10, o campo que recebe o foco não é anunciado como combobox
// e a opção ativa fica marcada num elemento sem foco. Aqui o campo recebe
// role="combobox", aria-expanded, aria-controls e aria-activedescendant; o select oculto e
// o botão da seta, que só servem ao mouse, ficam fora da árvore de
// acessibilidade (tema em primereact.ts).
export function CampoLista({ value, options, onChange, ...props }: Props) {
	const lista = useRef<Dropdown>(null)
	const [aberta, setAberta] = useState(false)
	const campo = () => lista.current?.getFocusInput() ?? null

	useEffect(() => {
		const elemento = lista.current?.getElement()
		const entrada = campo()
		if (!elemento || !entrada) return
		entrada.setAttribute('role', 'combobox')
		// O Dropdown marca a opção ativa no elemento externo, que não recebe o
		// foco, e nem sempre atualiza essa marca. A opção ativa da lista aberta
		// (data-p-focused) passa a ser indicada no campo com foco.
		// Só altera o que mudou: cada alteração notifica o observador de novo.
		const espelhar = () => {
			if (elemento.hasAttribute('aria-activedescendant'))
				elemento.removeAttribute('aria-activedescendant')
			const ativa = elemento.querySelector(
				'[role=option][data-p-focused="true"]'
			)?.id
			if (ativa) {
				if (entrada.getAttribute('aria-activedescendant') !== ativa)
					entrada.setAttribute('aria-activedescendant', ativa)
			} else if (entrada.hasAttribute('aria-activedescendant'))
				entrada.removeAttribute('aria-activedescendant')
		}
		espelhar()
		const observador = new MutationObserver(espelhar)
		observador.observe(elemento, {
			attributes: true,
			attributeFilter: ['aria-activedescendant', 'data-p-focused'],
			childList: true,
			subtree: true
		})
		return () => observador.disconnect()
	}, [])

	function aoAbrir() {
		setAberta(true)
		const opcoes = lista.current?.getOverlay()?.querySelector('[role=listbox]')
		if (!opcoes) return
		opcoes.id = `${props.inputId}-opcoes`
		campo()?.setAttribute('aria-controls', opcoes.id)
	}
	function aoFechar() {
		setAberta(false)
		campo()?.removeAttribute('aria-controls')
	}

	return (
		<Dropdown
			{...props}
			ref={lista}
			value={value}
			options={options}
			optionLabel="label"
			optionValue="value"
			// A lista aberta fica dentro da página (e de seus landmarks), não no
			// fim do body.
			appendTo="self"
			aria-expanded={aberta}
			onShow={aoAbrir}
			onHide={aoFechar}
			onChange={(event) => onChange(String(event.value ?? ''))}
		/>
	)
}
