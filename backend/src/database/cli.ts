import { Pool } from 'pg'
import { createInterface } from 'node:readline/promises'
import { Writable } from 'node:stream'
import { bancoApp } from '../config/autenticacao.js'
import { migrarApp } from './migracoes.js'
import {
	criarAdministrador,
	criarLeitor,
	desativarConta,
	normalizarEmail
} from './administradores.js'

async function senhaOculta(prompt: string) {
	if (!process.stdin.isTTY)
		throw new Error('A criação de conta exige terminal interativo')
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
	} else if (
		['criar-admin', 'criar-leitor'].includes(process.argv[2] ?? '') &&
		process.argv[3]
	) {
		const leitor = process.argv[2] === 'criar-leitor'
		const email = normalizarEmail(process.argv[3])
		const existente =
			process.argv.includes('--se-ausente') &&
			(await pool.query('SELECT 1 FROM app.usuarios WHERE email = $1', [email]))
				.rowCount
		if (existente) {
			console.log('Conta já existe. Senha, estado e permissões preservados.')
		} else {
			const senha = await senhaOculta(
				'Senha (8 a 64 caracteres, entrada oculta): '
			)
			if (senha !== (await senhaOculta('Confirme a senha: ')))
				throw new Error('As senhas não conferem')
			await (leitor ? criarLeitor : criarAdministrador)(pool, email, senha)
			console.log(
				`${leitor ? 'Leitor' : 'Administrador'} criado. Nenhuma conta existente foi alterada.`
			)
		}
	} else if (process.argv[2] === 'desativar' && process.argv[3]) {
		const desativada = await desativarConta(pool, process.argv[3])
		console.log(
			desativada
				? 'Conta desativada e sessões revogadas. Os dados da conta foram mantidos.'
				: 'Nenhuma conta com esse e-mail.'
		)
		if (!desativada) process.exitCode = 1
	} else {
		throw new Error(
			'Use migrar, criar-admin <email>, criar-leitor <email> ou desativar <email>'
		)
	}
} catch {
	console.error(
		'Operação não concluída. Confira comando, configuração, permissões, migrações, e-mail único e senha de 8 a 64 caracteres.'
	)
	process.exitCode = 1
} finally {
	await pool?.end()
}
