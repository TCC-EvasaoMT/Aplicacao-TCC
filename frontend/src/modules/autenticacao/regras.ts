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

export function mensagemTrocaSenha(status: number | null): string {
	switch (status) {
		case 400:
			return 'A nova senha deve ter entre 8 e 64 caracteres.'
		case 401:
			return 'Sua sessão terminou. Entre novamente para alterar a senha.'
		case 422:
			return 'A senha atual não confere.'
		case null:
		case 403:
		case 429:
			return mensagemLogin(status)
		default:
			return 'Não foi possível alterar a senha agora. Tente novamente em instantes.'
	}
}

export const LIMITES_SENHA = { minimo: 8, maximo: 64 }

// Como o servidor: um emoji é 1 caractere, não 2 unidades UTF-16 de `length`.
export const contarCaracteres = (texto: string) => [...texto].length

// O login e a confirmação da senha atual aceitam credenciais anteriores de até
// 128 pontos de código. O atributo maxLength do HTML conta unidades UTF-16.
export const MAX_UTF16_SENHA_ATUAL = 128 * 2

export interface ErroNovaSenha {
	campo: 'nova' | 'confirmacao'
	mensagem: string
}

export function validarNovaSenha(
	atual: string,
	nova: string,
	confirmacao: string
): ErroNovaSenha | null {
	const tamanho = contarCaracteres(nova)
	if (tamanho < LIMITES_SENHA.minimo)
		return {
			campo: 'nova',
			mensagem: `A senha deve ter no mínimo ${LIMITES_SENHA.minimo} caracteres.`
		}
	if (tamanho > LIMITES_SENHA.maximo)
		return {
			campo: 'nova',
			mensagem: `A senha deve ter no máximo ${LIMITES_SENHA.maximo} caracteres.`
		}
	if (nova === atual)
		return {
			campo: 'nova',
			mensagem: 'A nova senha não pode ser igual à atual.'
		}
	if (nova !== confirmacao)
		return {
			campo: 'confirmacao',
			mensagem: 'A confirmação deve ser igual à nova senha.'
		}
	return null
}

export const PERMISSAO_PAINEL = 'painel:consultar'

export type EstadoAcesso =
	'carregando' | 'erro' | 'liberado' | 'login' | 'sem_permissao'

// O que mostrar antes das abas. Painel público: sempre liberado. Restrito:
// login sem sessão e aviso de permissão quando a conta não tem painel:consultar
// (o servidor também nega com 403).
export function estadoAcesso(
	configuracao: { painel_restrito: boolean } | null | 'erro',
	usuario: { permissoes: string[] } | null,
	verificandoSessao: boolean
): EstadoAcesso {
	if (configuracao === 'erro') return 'erro'
	if (configuracao === null) return 'carregando'
	if (!configuracao.painel_restrito) return 'liberado'
	if (verificandoSessao) return 'carregando'
	if (!usuario) return 'login'
	return usuario.permissoes.includes(PERMISSAO_PAINEL)
		? 'liberado'
		: 'sem_permissao'
}
