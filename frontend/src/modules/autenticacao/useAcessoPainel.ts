import { useEffect, useState } from 'react'
import { consultarConfiguracao, type Configuracao } from './api'
import { estadoAcesso } from './regras'
import { motivoUltimaSaida } from './sessao'
import { useSessao } from './useSessao'

// Pergunta à API se o painel é restrito e combina com a sessão atual.
export function useAcessoPainel() {
	const { usuario, verificando } = useSessao()
	const [configuracao, setConfiguracao] = useState<
		Configuracao | null | 'erro'
	>(null)
	const [tentativa, setTentativa] = useState(0)
	useEffect(() => {
		const controller = new AbortController()
		setConfiguracao(null)
		consultarConfiguracao(controller.signal)
			.then(setConfiguracao)
			.catch(() => {
				if (!controller.signal.aborted) setConfiguracao('erro')
			})
		return () => controller.abort()
	}, [tentativa])
	const estado = estadoAcesso(configuracao, usuario, verificando)
	return {
		estado,
		usuario,
		sessaoExpirou: estado === 'login' && motivoUltimaSaida() === 'expirada',
		tentarNovamente: () => setTentativa((valor) => valor + 1)
	}
}
