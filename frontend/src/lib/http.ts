export class ErroHttp extends Error {
	status: number
	constructor(status: number) {
		super('Não foi possível carregar os dados. Tente novamente.')
		this.status = status
	}
}

// Credencial da sessão, registrada pelo módulo de autenticação. Com o painel
// restrito, as consultas levam o Bearer; num 401, renovam uma vez e repetem.
interface Credencial {
	token: () => Promise<string | null>
	renovar: () => Promise<string | null>
}
let credencial: Credencial | null = null

export function definirCredencial(nova: Credencial | null) {
	credencial = nova
}

async function buscar(path: string, signal: AbortSignal, token: string | null) {
	return fetch(path, {
		signal,
		headers: {
			Accept: 'application/json',
			...(token ? { Authorization: `Bearer ${token}` } : {})
		}
	})
}

export async function consultar<T>(
	path: string,
	signal: AbortSignal
): Promise<T> {
	const token = (await credencial?.token()) ?? null
	let response = await buscar(path, signal, token)
	if (response.status === 401 && credencial) {
		const novo = await credencial.renovar()
		if (novo) response = await buscar(path, signal, novo)
	}
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
