import type { FastifyInstance } from 'fastify';
import type { ConsultasCatalogos } from './consultas.js';
import { catalogoSchema } from './schemas.js';
import { erroSchema } from '../../plugins/erros.js';
import { consultarGold } from '../../plugins/gold.js';

export function registrarRotas(app: FastifyInstance, consultas: ConsultasCatalogos) {
  const erros = { 400: erroSchema, 500: erroSchema, 503: erroSchema };
  app.get(
    '/api/v1/filtros',
    {
      schema: {
        tags: ['Catálogos'],
        summary: 'Lista os filtros existentes na fato de cursos.',
        description:
          'Catálogo independente dos filtros ativos, sem IDs sequenciais. Anos de ingresso presentes apenas nas coortes não entram. Municípios sem código não são opções; seus registros continuam nos totais sem filtro municipal.',
        querystring: { type: 'object', additionalProperties: false, properties: {} },
        response: { 200: catalogoSchema, ...erros },
      },
    },
    async (request) => consultarGold(request, () => consultas.filtros()),
  );
}
