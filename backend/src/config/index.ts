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
	if (!['development', 'test', 'production'].includes(environment)) {
		throw new Error('NODE_ENV deve ser development, test ou production')
	}
	return {
		port: port('PORT', 3000),
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
