export function bancoApp(
	env: NodeJS.ProcessEnv = process.env,
	migracao = false
) {
	const prefixo = migracao ? 'APP_MIGRATION' : 'APP_POSTGRES'
	for (const nome of [
		'POSTGRES_DB',
		`${prefixo}_USER`,
		`${prefixo}_PASSWORD`
	]) {
		if (!env[nome]?.trim())
			throw new Error(`Variável obrigatória ausente: ${nome}`)
	}
	const port = env.POSTGRES_PORT ?? '5432'
	if (!/^\d+$/.test(port) || +port < 1 || +port > 65535)
		throw new Error('POSTGRES_PORT inválida')
	return {
		host: env.POSTGRES_HOST ?? '127.0.0.1',
		port: +port,
		database: env.POSTGRES_DB,
		user: env[`${prefixo}_USER`],
		password: env[`${prefixo}_PASSWORD`],
		max: 3,
		connectionTimeoutMillis: 2000,
		statement_timeout: 2500,
		idleTimeoutMillis: 30000
	}
}

export function configurarAutenticacao(env: NodeJS.ProcessEnv = process.env) {
	if (!['true', 'false'].includes(env.AUTH_ENABLED ?? 'false'))
		throw new Error('AUTH_ENABLED deve ser true ou false')
	if (env.AUTH_ENABLED !== 'true') return undefined
	if (!/^[a-fA-F0-9]{64,}$/.test(env.AUTH_JWT_SECRET ?? ''))
		throw new Error(
			'AUTH_JWT_SECRET deve conter pelo menos 64 caracteres hexadecimais aleatórios'
		)
	const origin = new URL(env.AUTH_ORIGIN ?? '')
	const secure = env.NODE_ENV === 'production'
	if (
		origin.origin !== env.AUTH_ORIGIN ||
		(origin.protocol !== 'https:' &&
			(secure ||
				origin.protocol !== 'http:' ||
				!['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)))
	) {
		throw new Error(
			'AUTH_ORIGIN deve ser uma origem HTTPS exata; HTTP só é permitido em loopback fora de produção'
		)
	}
	return {
		secret: env.AUTH_JWT_SECRET!,
		origin: origin.origin,
		secure,
		database: bancoApp(env)
	}
}

export type ConfigAutenticacao = Pick<
	NonNullable<ReturnType<typeof configurarAutenticacao>>,
	'secret' | 'origin' | 'secure'
>
