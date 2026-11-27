import type { FastifyPluginAsync } from 'fastify'
import type { ConsultasIndicadores } from './consultas.js'
import { registrarRotas } from './rotas.js'

export {
	criarConsultasIndicadores,
	type ConsultasIndicadores
} from './consultas.js'
export {
	agregacaoSQL,
	expressaoCapital,
	parametrizarFiltros,
	type FiltrosRecorte
} from './consultas.js'
export { calcularResumo, medidas, type Agregado } from './calculos.js'
export {
	anoSchema,
	filtrosRecorteProperties,
	resultadoResumoProperties
} from './schemas.js'

export const indicadores: FastifyPluginAsync<{
	consultas: ConsultasIndicadores
}> = async (app, { consultas }) => {
	registrarRotas(app, consultas)
}
