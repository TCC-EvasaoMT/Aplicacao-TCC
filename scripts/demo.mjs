import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const action = process.argv[2]
if (!['up', 'down', 'dev'].includes(action)) {
	throw new Error('Use: node scripts/demo.mjs up|down|dev')
}

// O destino é fixo para nunca carregar fixtures no banco configurado no .env.
const env = { ...process.env, TEST_POSTGRES_PORT: '55433' }
const compose = ['compose', '-p', 'tcc-demo', '-f', 'backend/test/compose.yml']

function run(command, args, options = {}) {
	const result = spawnSync(command, args, {
		cwd: root,
		env,
		stdio: 'inherit',
		...options
	})
	if (result.error) throw result.error
	if (result.status !== 0) {
		throw new Error(`${command} falhou (${result.status ?? result.signal}).`)
	}
}

function docker(args, input) {
	run(
		'docker',
		[...compose, ...args],
		input === undefined
			? {}
			: {
					input,
					stdio: ['pipe', 'inherit', 'inherit']
				}
	)
}

try {
	if (action === 'down') {
		docker(['down'])
	} else {
		docker(['up', '-d', '--wait'])
		const read = (path) =>
			readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
		const sql = `
BEGIN;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'tcc_demo') THEN
    CREATE ROLE tcc_demo LOGIN PASSWORD 'tcc_demo_local';
  END IF;
END $$;
DROP SCHEMA IF EXISTS gold CASCADE;
${read('backend/test/fixtures/gold-schema.sql')}
${read('backend/test/fixtures/dados.sql')}
COMMIT;
${read('backend/sql/permissoes.sql')}
`
		docker(
			[
				'exec',
				'-T',
				'postgres',
				'psql',
				'-U',
				'postgres',
				'-d',
				'postgres',
				'-v',
				'ON_ERROR_STOP=1',
				'-v',
				'api_role=tcc_demo'
			],
			sql
		)
		console.log(
			'Base sintética pronta em 127.0.0.1:55433. Use pnpm dev:demo para abrir a aplicação.'
		)

		if (action === 'dev') {
			const pnpmPath = process.env.npm_execpath
			if (!pnpmPath) throw new Error('Inicie com pnpm dev:demo.')
			// O pnpm pode ser um script JavaScript ou um executável nativo.
			const isJavaScript = /\.(?:cjs|mjs|js)$/i.test(pnpmPath)
			run(
				isJavaScript ? process.execPath : pnpmPath,
				isJavaScript ? [pnpmPath, 'dev'] : ['dev'],
				{
					env: {
						...env,
						NODE_ENV: 'development',
						PORT: '3000',
						POSTGRES_HOST: '127.0.0.1',
						POSTGRES_PORT: '55433',
						POSTGRES_DB: 'postgres',
						POSTGRES_USER: 'tcc_demo',
						POSTGRES_PASSWORD: 'tcc_demo_local'
					}
				}
			)
		}
	}
} catch (error) {
	console.error(`Não foi possível executar a demonstração: ${error.message}`)
	process.exitCode = 1
}
