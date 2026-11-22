import type { FastifyPluginAsync } from 'fastify';
import type { ConsultasAnalises } from './consultas.js';
import { registrarRotas } from './rotas.js';

export { criarConsultasAnalises, type ConsultasAnalises } from './consultas.js';

export const analises: FastifyPluginAsync<{ consultas: ConsultasAnalises }> = async (app, { consultas }) => {
  registrarRotas(app, consultas);
};
