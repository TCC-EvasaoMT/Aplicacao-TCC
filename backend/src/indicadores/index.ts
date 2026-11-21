import type { FastifyPluginAsync } from 'fastify';
import type { Consultas } from './consultas.js';
import { registrarRotas } from './rotas.js';

export { criarConsultas, type Consultas } from './consultas.js';

export const indicadores: FastifyPluginAsync<{ consultas: Consultas }> = async (app, { consultas }) => {
  registrarRotas(app, consultas);
};
