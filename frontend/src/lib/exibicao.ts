// O que mostrar num painel: a resposta atual ou, enquanto o novo recorte
// carrega, a última exibida (esmaecida). Uma última resposta que não serve
// para exibição (por exemplo, sem dados) não é reaproveitada.
export function exibicao<T>(
	atual: T | undefined,
	ultima: T | null,
	carregando: boolean,
	exibivel: (dado: T) => boolean = () => true
): { dado: T | null; atualizando: boolean } {
	if (atual !== undefined) return { dado: atual, atualizando: false }
	if (carregando && ultima !== null && exibivel(ultima))
		return { dado: ultima, atualizando: true }
	return { dado: null, atualizando: false }
}

// Histórico curto para desfazer: guarda o estado anterior, até o limite.
export function empilhar<T>(lista: T[], item: T, limite = 20): T[] {
	return [...lista, item].slice(-limite)
}
