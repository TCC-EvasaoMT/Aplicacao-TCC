import { useSyncExternalStore } from 'react'

// Acompanha uma media query, por exemplo '(max-width: 575px)'.
export function useMedia(consulta: string): boolean {
	return useSyncExternalStore(
		(avisar) => {
			const lista = window.matchMedia(consulta)
			lista.addEventListener('change', avisar)
			return () => lista.removeEventListener('change', avisar)
		},
		() => window.matchMedia(consulta).matches,
		() => false
	)
}
