import type { FastifyPluginAsync } from 'fastify';
import type { ConsultasIndicadores } from './consultas.js';
import { registrarRotas } from './rotas.js';

export { criarConsultasIndicadores, type ConsultasIndicadores } from './consultas.js';

export const indicadores: FastifyPluginAsync<{ consultas: ConsultasIndicadores }> = async (app, { consultas }) => {
  registrarRotas(app, consultas);
};
