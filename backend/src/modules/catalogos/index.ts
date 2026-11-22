import type { FastifyPluginAsync } from 'fastify';
import type { ConsultasCatalogos } from './consultas.js';
import { registrarRotas } from './rotas.js';

export { criarConsultasCatalogos, type ConsultasCatalogos } from './consultas.js';

export const catalogos: FastifyPluginAsync<{ consultas: ConsultasCatalogos }> = async (
  app,
  { consultas },
) => {
  registrarRotas(app, consultas);
};
