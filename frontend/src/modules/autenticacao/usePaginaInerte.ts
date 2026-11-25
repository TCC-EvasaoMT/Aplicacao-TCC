import { useEffect } from 'react'

// O Sidebar não prende nem devolve o foco; mesmo padrão da gaveta de filtros.
export function usePaginaInerte(aberto: boolean) {
	useEffect(() => {
		if (!aberto) return
		const pagina = document.getElementById('root')
		const anterior = document.activeElement as HTMLElement | null
		pagina?.setAttribute('inert', '')
		return () => {
			pagina?.removeAttribute('inert')
			anterior?.focus()
		}
	}, [aberto])
}
