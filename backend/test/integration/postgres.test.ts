import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { test } from 'node:test';
import { Pool } from 'pg';
import { buildApp } from '../../src/app.js';
import { criarConsultasIndicadores } from '../../src/modules/indicadores/index.js';
import { criarConsultasCatalogos } from '../../src/modules/catalogos/index.js';
import { criarHealth } from '../../src/plugins/health.js';

test('API integrada ao PostgreSQL e a um usuário exclusivo de leitura', {
  skip: !process.env.TEST_DATABASE_URL && 'Defina TEST_DATABASE_URL para executar em PostgreSQL 17.',
}, async t => {
  const adminUrl = new URL(process.env.TEST_DATABASE_URL!);
  const name = `backend_test_${randomUUID().replaceAll('-', '')}`;
  const password = randomUUID();
  const admin = new Pool({ connectionString: adminUrl.toString(), max: 1 });
  let createdDb = false;
  let createdRole = false;
  let owner: Pool | undefined;
  let reader: Pool | undefined;
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;
  t.after(async () => {
    await app?.close();
    await reader?.end();
    await owner?.end();
    // Só os objetos aleatórios criados por esta execução são removidos.
    try {
      if (createdDb) await admin.query(`DROP DATABASE "${name}"`);
      if (createdRole) await admin.query(`DROP ROLE "${name}"`);
    } finally {
      await admin.end();
    }
  });
  await admin.query(`CREATE DATABASE "${name}"`);
  createdDb = true;
  await admin.query(`CREATE ROLE "${name}" LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT`);
  createdRole = true;
  const dbUrl = new URL(adminUrl);
  dbUrl.pathname = `/${name}`;
  owner = new Pool({ connectionString: dbUrl.toString(), max: 1 });
  const schema = await readFile(new URL('../fixtures/gold-schema.sql', import.meta.url), 'utf8');
  const dados = await readFile(new URL('../fixtures/dados.sql', import.meta.url), 'utf8');
  const permissions = (await readFile(new URL('../../sql/permissoes.sql', import.meta.url), 'utf8'))
    .replaceAll(':"api_role"', `"${name}"`);
  await owner.query(schema + dados);
  await owner.query('CREATE SCHEMA bronze; CREATE TABLE bronze.privado (valor text)');
  dbUrl.username = name;
  dbUrl.password = password;
  reader = new Pool({ connectionString: dbUrl.toString(), max: 2, statement_timeout: 2500, connectionTimeoutMillis: 2000 });
  app = await buildApp({
    indicadores: criarConsultasIndicadores(reader),
    catalogos: criarConsultasCatalogos(reader),
    health: criarHealth(reader),
  }, { docs: true });
  const server = app;
  const db = owner;
  const apiUser = reader;
  const resumo = async (params: Record<string, string> = {}) => {
    const response = await server.inject(`/api/v1/indicadores/resumo?${new URLSearchParams({ ano: '2023', ...params })}`);
    assert.equal(response.statusCode, 200, response.body);
    return response.json();
  };

  await t.test('sem permissões falha; com grants consulta sem permitir escrita nem acesso à Bronze', async () => {
    assert.equal((await server.inject('/health')).statusCode, 503);
    await db.query(permissions);
    assert.equal((await server.inject('/health')).statusCode, 200);
    await assert.rejects(apiUser.query('DELETE FROM gold.fato_evasao_curso'), { code: '42501' });
    await assert.rejects(apiUser.query('SELECT * FROM bronze.privado'), { code: '42501' });
  });

  await t.test('filtros vêm da fato, preservam códigos e distinguem oferta de sede', async () => {
    const response = await server.inject('/api/v1/filtros');
    assert.equal(response.statusCode, 200, response.body);
    const filtros = response.json();
    assert.deepEqual(filtros.anos, [2024, 2023, 2022]);
    assert.ok(!filtros.anos.includes(2010));
    assert.ok(filtros.cursos.some((x: { codigo: string }) => x.codigo === '001'));
    assert.ok(filtros.areas_gerais.some((x: { codigo: string }) => x.codigo === '01'));
    assert.ok(filtros.municipios_sede.some((x: { codigo: string }) => x.codigo === '5102504'));
    assert.ok(!filtros.municipios_oferta.some((x: { codigo: string }) => x.codigo === '5102504'));
    assert.ok(!JSON.stringify(filtros).includes('id_instituicao'));
  });

  await t.test('taxa pondera cursos por base e não usa média das taxas', async () => {
    const result = await resumo({ categoria_administrativa: 'Pública Federal' });
    assert.equal(result.totais.vinculos_total, 1000);
    assert.equal(result.totais.alunos_desvinculados, 190);
    assert.equal(result.taxas.evasao_curso, 0.24);
    assert.equal(result.taxas.evasao_ies, 0.19);
    assert.notEqual(result.taxas.evasao_curso, (0.15 + 0.25) / 2);
    assert.equal(result.qualidade.registros_com_alunos, 2);
  });

  await t.test('todos os filtros combinam por E; entrada textual não vira SQL', async () => {
    const filtros = { codigo_curso: '001', codigo_area_geral: '01', codigo_municipio_oferta: '5103403',
      modalidade: 'Presencial', categoria_administrativa: 'Pública Federal',
      organizacao_academica: 'Universidade', codigo_municipio_sede: '5103403' };
    assert.equal((await resumo(filtros)).totais.vinculos_total, 100);
    assert.equal((await resumo({ ...filtros, codigo_area_geral: '06' })).qualidade.sem_dados, true);
    assert.equal((await resumo({ modalidade: "x' OR TRUE --" })).qualidade.sem_dados, true);
    assert.equal((await resumo({ ano: '2022' })).totais.vinculos_total, 1000);
    assert.equal((await resumo({ ano: '1999' })).totais.vinculos_total, null);
  });

  await t.test('EaD tem sede, mas não recebe município de oferta inventado', async () => {
    assert.equal((await resumo({ codigo_curso: '002', codigo_municipio_sede: '5103403' })).totais.vinculos_total, 900);
    assert.equal((await resumo({ codigo_curso: '002', codigo_municipio_oferta: '5103403' })).qualidade.sem_dados, true);
  });

  await t.test('docentes não geram zeros, e base zero não gera uma taxa', async () => {
    const docentes = await resumo({ codigo_curso: '003' });
    assert.equal(docentes.qualidade.sem_dados, true);
    assert.equal(docentes.qualidade.registros_sem_alunos, 1);
    assert.equal(docentes.totais.matriculas_total, null);
    assert.equal(docentes.taxas.evasao_curso, null);
    const zero = await resumo({ codigo_curso: '004' });
    assert.equal(zero.base_risco, 0);
    assert.equal(zero.qualidade.sem_dados, false);
    assert.equal(zero.taxas.evasao_curso, null);
  });

  await t.test('ruído, dados parciais e grupos pequenos têm sinalização explícita', async () => {
    const ruido = await resumo({ codigo_curso: '005' });
    assert.equal(ruido.totais.alunos_desvinculados, -2.5);
    assert.equal(ruido.totais.ingressantes_total, 0.25);
    assert.equal(ruido.taxas.evasao_curso, 0.75 / 20.5);
    assert.equal(ruido.qualidade.flag_valor_negativo, true);
    const parcial = await resumo({ categoria_administrativa: 'Pública Estadual' });
    assert.equal(parcial.qualidade.dados_incompletos, true);
    assert.equal(parcial.totais.alunos_desvinculados, null);
    assert.equal(parcial.taxas.evasao_curso, null);
    const grupo = await resumo({ categoria_administrativa: 'Pública Municipal' });
    assert.equal(grupo.base_risco, 40);
    assert.equal(grupo.qualidade.flag_grupo_pequeno, false);
    assert.equal((await resumo({ codigo_curso: '007' })).qualidade.flag_grupo_pequeno, true);
  });

  await t.test('reconstrução altera IDs; reaplicar grants recupera consultas por código', async () => {
    const antes = await resumo({ codigo_curso: '001' });
    await db.query(`BEGIN; DROP SCHEMA gold CASCADE; ${schema} ${dados} COMMIT;`);
    assert.equal((await server.inject('/health')).statusCode, 503);
    await db.query(permissions);
    await db.query(`BEGIN;
      INSERT INTO gold.dim_curso (id_curso, codigo_curso, nome_curso) VALUES (101, 'temporario', 'Pedagogia');
      UPDATE gold.fato_evasao_curso SET id_curso = 101 WHERE id_curso = 1;
      DELETE FROM gold.dim_curso WHERE id_curso = 1;
      UPDATE gold.dim_curso SET codigo_curso = '001' WHERE id_curso = 101;
      COMMIT;`);
    assert.equal((await server.inject('/health')).statusCode, 200);
    assert.deepEqual(await resumo({ codigo_curso: '001' }), antes);
  });

  await t.test('consulta sintética responde dentro de três segundos', async () => {
    const start = performance.now();
    await resumo();
    const duration = performance.now() - start;
    t.diagnostic(`Resumo com dados sintéticos: ${duration.toFixed(1)} ms; não representa o volume real.`);
    assert.ok(duration < 3000, `${duration.toFixed(1)} ms`);
  });
});
