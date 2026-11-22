import { Pool } from 'pg'
import { createInterface } from 'node:readline/promises'
import { Writable } from 'node:stream'
import { bancoApp } from '../config/autenticacao.js'
import { migrarApp } from './migracoes.js'
import { criarAdministrador } from './administradores.js'

async function senhaOculta(prompt: string) {
	if (!process.stdin.isTTY)
		throw new Error('A criação de administrador exige terminal interativo')
	const output = new Writable({
		write(_chunk, _encoding, callback) {
			callback()
		}
	})
	const rl = createInterface({ input: process.stdin, output, terminal: true })
	process.stdout.write(prompt)
	try {
		return await rl.question('')
	} finally {
		rl.close()
		process.stdout.write('\n')
	}
}

let pool: Pool | undefined
try {
	pool = new Pool(bancoApp(process.env, true))
	if (process.argv[2] === 'migrar') {
		await migrarApp(pool)
		console.log('Migrações do schema app aplicadas.')
	} else if (process.argv[2] === 'criar-admin' && process.argv[3]) {
		const senha = await senhaOculta(
			'Senha (15 a 128 caracteres, entrada oculta): '
		)
		if (senha !== (await senhaOculta('Confirme a senha: ')))
			throw new Error('As senhas não conferem')
		await criarAdministrador(pool, process.argv[3], senha)
		console.log('Administrador criado. Nenhuma conta existente foi alterada.')
	} else {
		throw new Error('Use migrar ou criar-admin <email>')
	}
} catch {
	console.error(
		'Operação não concluída. Confira comando, configuração, permissões, migrações, e-mail único e senha de 15 a 128 caracteres.'
	)
	process.exitCode = 1
} finally {
	await pool?.end()
}
