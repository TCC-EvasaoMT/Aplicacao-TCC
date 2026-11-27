import { erroSchema } from '../../plugins/erros.js'
import { permissoes } from './repositorio.js'

export const identidadeSchema = {
	type: 'object',
	additionalProperties: false,
	required: ['id', 'email', 'permissoes'],
	properties: {
		id: { type: 'string', format: 'uuid' },
		email: { type: 'string' },
		permissoes: {
			type: 'array',
			items: { type: 'string', enum: [...permissoes] }
		}
	}
} as const
export const tokenSchema = {
	type: 'object',
	additionalProperties: false,
	required: ['access_token', 'token_type', 'expires_in', 'usuario'],
	properties: {
		access_token: { type: 'string' },
		token_type: { type: 'string', const: 'Bearer' },
		expires_in: { type: 'integer', const: 600 },
		usuario: identidadeSchema
	}
} as const
export const loginSchema = {
	type: 'object',
	additionalProperties: false,
	required: ['email', 'senha'],
	properties: {
		email: { type: 'string', format: 'email', maxLength: 254 },
		senha: { type: 'string', minLength: 1, maxLength: 128 }
	}
} as const
export const trocaSenhaSchema = {
	type: 'object',
	additionalProperties: false,
	required: ['senha_atual', 'nova_senha'],
	properties: {
		senha_atual: { type: 'string', minLength: 1, maxLength: 128 },
		nova_senha: { type: 'string', minLength: 8, maxLength: 64 }
	}
} as const
export const csrfSchema = {
	type: 'object',
	required: ['origin', 'x-csrf-protection'],
	properties: {
		origin: {
			type: 'string',
			description:
				'Origem exata configurada em AUTH_ORIGIN. Navegadores a enviam automaticamente.'
		},
		'x-csrf-protection': {
			type: 'string',
			const: '1',
			default: '1',
			description: 'Obrigatório nos POSTs de autenticação.'
		}
	}
} as const
export const errosAuth = {
	400: erroSchema,
	401: erroSchema,
	403: erroSchema,
	429: erroSchema,
	500: erroSchema
}
