// Estado da tela na URL (?ano=2023&codigo_curso=001...), para recarregar e
// compartilhar a mesma visão. Cada painel grava só as próprias chaves e usa
// replaceState, sem criar entradas no histórico.
export function lerUrl(): URLSearchParams {
	return new URLSearchParams(window.location.search)
}

export function gravarUrl(
	chaves: readonly string[],
	valores: readonly (readonly [string, string])[]
) {
	const parametros = lerUrl()
	for (const chave of chaves) parametros.delete(chave)
	for (const [chave, valor] of valores)
		if (valor !== '') parametros.append(chave, valor)
	const busca = parametros.toString()
	const { pathname, search, hash } = window.location
	const destino = `${pathname}${busca ? `?${busca}` : ''}${hash}`
	if (destino !== `${pathname}${search}${hash}`)
		window.history.replaceState(window.history.state, '', destino)
}
