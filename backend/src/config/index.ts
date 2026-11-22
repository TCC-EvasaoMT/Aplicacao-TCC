import { configurarAutenticacao } from './autenticacao.js'

export function readConfig(env: NodeJS.ProcessEnv = process.env) {
	function required(name: string): string {
		const value = env[name]
		if (!value?.trim()) throw new Error(`Variável obrigatória ausente: ${name}`)
		return value
	}
	function port(name: string, fallback: number): number {
		const value = env[name] ?? String(fallback)
		if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) {
			throw new Error(`Porta inválida: ${name}`)
		}
		return Number(value)
	}
	const environment = env.NODE_ENV ?? 'development'
	const maxRequisicoes = env.HTTP_RATE_LIMIT_MAX ?? '120'
	if (
		!/^\d+$/.test(maxRequisicoes) ||
		Number(maxRequisicoes) < 1 ||
		Number(maxRequisicoes) > 10000
	) {
		throw new Error('HTTP_RATE_LIMIT_MAX deve ser um inteiro entre 1 e 10000')
	}
	if (!['development', 'test', 'production'].includes(environment)) {
		throw new Error('NODE_ENV deve ser development, test ou production')
	}
	return {
		autenticacao: configurarAutenticacao(env),
		port: port('PORT', 3000),
		maxRequisicoes: Number(maxRequisicoes),
		docs: environment === 'development',
		database: {
			host: env.POSTGRES_HOST ?? '127.0.0.1',
			port: port('POSTGRES_PORT', 5432),
			database: required('POSTGRES_DB'),
			user: required('POSTGRES_USER'),
			password: required('POSTGRES_PASSWORD')
		}
	}
}
