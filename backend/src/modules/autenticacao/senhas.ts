import { argon2id, hash, verify } from 'argon2'

export function validarSenha(senha: string) {
	if ([...senha].length < 15 || [...senha].length > 128) {
		throw new Error('A senha deve ter entre 15 e 128 caracteres.')
	}
}

export async function criarHash(senha: string) {
	validarSenha(senha)
	return hash(senha, {
		type: argon2id,
		memoryCost: 19456,
		timeCost: 2,
		parallelism: 1
	})
}

export const verificarSenha = verify
