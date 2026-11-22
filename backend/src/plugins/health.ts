import type { FastifyPluginAsync } from 'fastify';
import type { Pool } from 'pg';
import { erroSchema } from './erros.js';
import { consultarGold, origem } from './gold.js';

export function criarHealth(pool: Pool) {
  return async () => {
    // Verifica a fato e todas as dimensões, mesmo quando não há registros.
    await pool.query(`SELECT 1 ${origem} LIMIT 1`);
  };
}

export const health: FastifyPluginAsync<{ consultar: () => Promise<void> }> = async (
  app,
  { consultar },
) => {
  app.get(
    '/health',
    {
      schema: {
        tags: ['Operação'],
        summary: 'Verifica o acesso à Gold e às dimensões utilizadas.',
        response: {
          200: {
            type: 'object',
            required: ['status'],
            properties: { status: { type: 'string', const: 'ok' } },
          },
          503: erroSchema,
        },
      },
    },
    async (request) => {
      await consultarGold(request, consultar);
      return { status: 'ok' };
    },
  );
};
