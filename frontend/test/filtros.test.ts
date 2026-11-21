import assert from 'node:assert/strict';
import { test } from 'node:test';
import { atualizarSelecao, limparFiltros, serializarFiltros } from '../src/modules/indicadores/filtros.ts';

const catalogo = {
  anos: [2024, 2023], cursos: [{ codigo: '001', nome: null }], areas_gerais: [{ codigo: '01', nome: 'Educação' }],
  modalidades: ['A distância'], categorias_administrativas: ['Pública Federal'], organizacoes_academicas: ['Universidade'],
  municipios_oferta: [{ codigo: '5107909', nome: 'Sinop' }], municipios_sede: [{ codigo: '5103403', nome: 'Cuiabá' }],
};

test('serializa os oito filtros preservando zeros, acentos e a distinção entre sede e oferta', () => {
  const filtros = { ano: '2023', codigo_curso: '001', codigo_area_geral: '01', modalidade: 'A distância',
    categoria_administrativa: 'Pública Federal', organizacao_academica: 'Universidade',
    codigo_municipio_oferta: '5107909', codigo_municipio_sede: '5103403' };
  assert.deepEqual(Object.fromEntries(new URLSearchParams(serializarFiltros(filtros))), filtros);
  assert.deepEqual(atualizarSelecao(filtros, catalogo), filtros);
});

test('limpar mantém o ano e omite filtros opcionais na requisição', () => {
  assert.equal(serializarFiltros(limparFiltros('2023')), 'ano=2023');
  assert.equal(serializarFiltros(limparFiltros()), '');
});

test('carga inicial seleciona o ano mais recente e atualização preserva escolhas disponíveis', () => {
  assert.equal(atualizarSelecao(limparFiltros(), catalogo).ano, '2024');
  const atual = { ...limparFiltros('2023'), codigo_curso: '001', codigo_area_geral: '01' };
  assert.deepEqual(atualizarSelecao(atual, catalogo), atual);
});

test('atualização remove opções que deixaram de existir e trata catálogo vazio', () => {
  const atual = { ...limparFiltros('2022'), codigo_curso: '999', modalidade: 'A distância' };
  assert.deepEqual(atualizarSelecao(atual, catalogo), { ...limparFiltros('2024'), modalidade: 'A distância' });
  assert.deepEqual(atualizarSelecao(atual, { ...catalogo, anos: [], modalidades: [] }), limparFiltros());
});
