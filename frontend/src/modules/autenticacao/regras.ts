export const MARGEM_RENOVACAO_MS = 60_000

export function precisaRenovar(expiraEm: number, agora: number) {
	return expiraEm - agora <= MARGEM_RENOVACAO_MS
}

export function mensagemLogin(status: number | null): string {
	switch (status) {
		case null:
			return 'Sem conexão com o servidor. Verifique sua internet e tente novamente.'
		case 400:
			return 'Informe um e-mail válido e a senha.'
		case 401:
			return 'E-mail ou senha incorretos.'
		case 403:
			return 'O login não está disponível neste endereço. Acesse o painel pelo endereço oficial.'
		case 404:
			return 'O login administrativo não está habilitado neste servidor.'
		case 429:
			return 'Muitas tentativas. Aguarde um minuto e tente novamente.'
		// 500, 503 (proxy à frente da API) e demais falhas do servidor.
		default:
			return 'Não foi possível entrar agora. Tente novamente em instantes.'
	}
}
