import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'

const root = fileURLToPath(new URL('../', import.meta.url))
const action = process.argv[2]
if (!['up', 'down', 'dev', 'up-auth', 'dev-auth'].includes(action)) {
	throw new Error('Use: node scripts/demo.mjs up|down|dev|up-auth|dev-auth')
}
const autenticar = action.endsWith('-auth')
const iniciar = action === 'dev' || action === 'dev-auth'

// O destino é fixo para nunca carregar fixtures no banco configurado no .env.
const env = { ...process.env, TEST_POSTGRES_PORT: '55433' }
const compose = ['compose', '-p', 'tcc-demo', '-f', 'backend/test/compose.yml']
const databaseEnv = {
	...env,
	NODE_ENV: 'development',
	PORT: '3000',
	POSTGRES_HOST: '127.0.0.1',
	POSTGRES_PORT: '55433',
	POSTGRES_DB: 'postgres',
	POSTGRES_USER: 'tcc_demo',
	POSTGRES_PASSWORD: 'tcc_demo_local'
}

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

function pnpm(args, childEnv) {
	if (!process.env.npm_execpath)
		throw new Error('Inicie pelos comandos pnpm da demonstração.')
	run(process.execPath, [process.env.npm_execpath, ...args], { env: childEnv })
}

function psql(sql) {
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
			'api_role=tcc_demo',
			'-v',
			'auth_role=tcc_demo_auth'
		],
		sql
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
		psql(sql)
		if (autenticar) {
			psql(`
BEGIN;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'tcc_demo_owner') THEN
    CREATE ROLE tcc_demo_owner LOGIN PASSWORD 'tcc_demo_owner_local' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'tcc_demo_auth') THEN
    CREATE ROLE tcc_demo_auth LOGIN PASSWORD 'tcc_demo_auth_local' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS app AUTHORIZATION tcc_demo_owner;
REVOKE ALL ON SCHEMA app FROM PUBLIC;
COMMIT;
`)
			const maintenanceEnv = {
				...databaseEnv,
				APP_MIGRATION_USER: 'tcc_demo_owner',
				APP_MIGRATION_PASSWORD: 'tcc_demo_owner_local'
			}
			pnpm(['--filter', 'tcc-evasao-backend', 'db:migrate'], maintenanceEnv)
			psql(read('backend/sql/permissoes-app.sql'))
			console.log('Administrador da demonstração: admin@demo.local')
			pnpm(
				[
					'--filter',
					'tcc-evasao-backend',
					'auth:criar-admin',
					'admin@demo.local',
					'--se-ausente'
				],
				maintenanceEnv
			)
		}
		console.log(
			`Base sintética pronta em 127.0.0.1:55433. Use pnpm dev:demo${autenticar ? ':auth' : ''} para abrir a aplicação.`
		)

		if (iniciar) {
			if (autenticar)
				console.log(
					'Teste login, renovação e logout em http://127.0.0.1:5173/docs/ (X-CSRF-Protection: 1).'
				)
			pnpm(['dev'], {
				...databaseEnv,
				AUTH_ENABLED: String(autenticar),
				AUTH_JWT_SECRET: autenticar ? randomBytes(32).toString('hex') : '',
				AUTH_ORIGIN: 'http://127.0.0.1:5173',
				APP_POSTGRES_USER: 'tcc_demo_auth',
				APP_POSTGRES_PASSWORD: 'tcc_demo_auth_local',
				// Valores vazios impedem herança das credenciais de manutenção do .env.
				APP_MIGRATION_USER: '',
				APP_MIGRATION_PASSWORD: ''
			})
		}
	}
} catch (error) {
	console.error(`Não foi possível executar a demonstração: ${error.message}`)
	process.exitCode = 1
}
