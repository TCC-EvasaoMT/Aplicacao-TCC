import { Pool } from 'pg';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app.js';
import { readConfig } from './config/index.js';
import { criarConsultasIndicadores } from './modules/indicadores/index.js';
import { criarConsultasCatalogos } from './modules/catalogos/index.js';
import { criarHealth } from './plugins/health.js';
import { criarConsultasAnalises } from './modules/analises/index.js';

const config = readConfig();
const pool = new Pool({
  ...config.database,
  max: 5,
  connectionTimeoutMillis: 2000,
  idleTimeoutMillis: 30000,
  statement_timeout: 2500,
  application_name: 'tcc-evasao-api',
});
const app = await buildApp(
  {
    indicadores: criarConsultasIndicadores(pool),
    catalogos: criarConsultasCatalogos(pool),
    analises: criarConsultasAnalises(pool),
    health: criarHealth(pool),
  },
  {
    docs: config.docs,
    logger: true,
    frontendDir: process.argv.includes('--serve-frontend')
      ? fileURLToPath(new URL('../../frontend/dist/', import.meta.url))
      : undefined,
  },
);
pool.on('error', () => app.log.error('Conexão ociosa com o PostgreSQL foi interrompida'));
app.addHook('onClose', async () => {
  await pool.end();
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close().catch(() => {
      process.exitCode = 1;
    });
  });
}
try {
  await app.listen({ host: '127.0.0.1', port: config.port });
} catch {
  app.log.error('Não foi possível iniciar o servidor HTTP');
  await app.close();
  process.exitCode = 1;
}
