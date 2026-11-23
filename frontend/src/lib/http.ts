export class ErroHttp extends Error {
	status: number
	constructor(status: number) {
		super('Não foi possível carregar os dados. Tente novamente.')
		this.status = status
	}
}

export async function consultar<T>(
	path: string,
	signal: AbortSignal
): Promise<T> {
	const response = await fetch(path, {
		signal,
		headers: { Accept: 'application/json' }
	})
	if (!response.ok) throw new ErroHttp(response.status)
	return response.json() as Promise<T>
}

// Mensagem de falha para a tela: o limite de consultas da API (429) tem
// orientação própria; os demais erros usam a mensagem do painel.
export function mensagemErro(erro: unknown, padrao: string): string {
	return erro instanceof ErroHttp && erro.status === 429
		? 'Muitas consultas em pouco tempo. Aguarde alguns segundos.'
		: padrao
}
