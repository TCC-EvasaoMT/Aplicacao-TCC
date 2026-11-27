import { argon2id, hash, verify } from 'argon2'

export function validarSenha(senha: string) {
	const tamanho = [...senha].length
	if (tamanho < 8 || tamanho > 64) {
		throw new Error('A senha deve ter entre 8 e 64 caracteres.')
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
