import { useEffect, useState } from 'react'
import { observarSessao, restaurarSessao, usuarioAtual } from './sessao'

export function useSessao() {
	const [usuario, setUsuario] = useState(usuarioAtual)
	const [verificando, setVerificando] = useState(true)
	useEffect(() => {
		let ativo = true
		const parar = observarSessao(setUsuario)
		void restaurarSessao().then(() => {
			if (ativo) setVerificando(false)
		})
		return () => {
			ativo = false
			parar()
		}
	}, [])
	return { usuario, verificando }
}
