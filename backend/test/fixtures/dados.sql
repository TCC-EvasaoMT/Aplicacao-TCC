-- Dados inteiramente sintéticos, usados somente no banco temporário de teste.
INSERT INTO gold.dim_tempo VALUES (0, NULL, NULL), (1, 2010, 2009), (2, 2022, 2021), (3, 2023, 2022), (4, 2024, 2023);
INSERT INTO gold.dim_instituicao (id_instituicao, categoria_administrativa, organizacao_academica, codigo_municipio_sede, municipio_sede)
VALUES (0, 'Não informado', 'Não informado', NULL, NULL),
  (1, 'Pública Federal', 'Universidade', '5103403', 'Cuiabá'),
  (2, 'Pública Estadual', 'Universidade', '5102504', 'Cáceres'),
  (3, 'Pública Municipal', 'Faculdade', '5107909', 'Sinop');
INSERT INTO gold.dim_curso (id_curso, codigo_curso, nome_curso)
VALUES (0, NULL, 'Não informado'), (1, '001', 'Pedagogia'), (2, '002', 'Computação'),
  (3, '003', 'Somente docentes'), (4, '004', 'Base zero'), (5, '005', 'Ruído'),
  (6, '006', 'Medida ausente'), (7, '007', 'Grupo pequeno A'), (8, '008', 'Grupo pequeno B');
INSERT INTO gold.dim_area_conhecimento (id_area_conhecimento, codigo_rotulo_cine, codigo_area_geral, area_geral)
VALUES (0, NULL, NULL, NULL), (1, '0113', '01', 'Educação'), (2, '0613', '06', 'Computação');
INSERT INTO gold.dim_localidade (id_localidade, codigo_municipio, municipio)
VALUES (0, NULL, 'Não se aplica / não informado'), (1, '5103403', 'Cuiabá'), (2, '5107909', 'Sinop');
INSERT INTO gold.dim_oferta (id_oferta, modalidade_ensino, turno)
VALUES (0, 'Não informado', 'Não informado'), (1, 'Presencial', 'Noturno'), (2, 'A distância', 'Não se aplica (EaD)');
-- ingressantes_total e matriculas_total trazem ruído proposital, como na carga real:
-- a API calcula essas medidas e não deve ler as duas colunas nem a flag_valor_negativo.
INSERT INTO gold.fato_evasao_curso
  (id_tempo, id_instituicao, id_curso, id_area_conhecimento, id_localidade, id_oferta, codigo_curso,
   vinculos_total, ingressantes_total, matriculas_total, concluintes_total, alunos_cursando,
   alunos_desvinculados, alunos_transferidos, alunos_matricula_trancada, alunos_falecidos,
   docentes_total, flag_valor_negativo, flag_grupo_pequeno)
VALUES
  (2, 1, 1, 1, 1, 1, '001', 1000, 92388, -166996, 200, 600, 90, 10, 100, 0, 20, true, false),
  (3, 1, 1, 1, 1, 1, '001', 100, -87726, 136635, 20, 50, 10, 5, 15, 0, 10, true, false),
  (3, 1, 2, 2, 0, 2, '002', 900, 5000, -300, 100, 500, 180, 45, 75, 0, 30, true, false),
  (3, 0, 3, 0, 0, 0, '003', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 5, false, NULL),
  (4, 0, 3, 0, 0, 0, '003', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 5, false, NULL),
  (3, 2, 4, 1, 2, 1, '004', 0, 0, 0, 0, 0, 1, 0, 0, 0, 3, false, true),
  (3, 2, 5, 1, 2, 1, '005', 20.5, -40, 900, 4.25, 10.5, -2.5, 3.25, 5, 0, 3, true, true),
  (3, 2, 6, 1, 2, 1, '006', 30, 7, -3, 5, 15, NULL, 1, 4, 0, 3, true, false),
  (3, 3, 7, 2, 2, 1, '007', 20, -10, 400, 2, 10, 4, 1, 3, 0, 3, true, true),
  (3, 3, 8, 2, 2, 1, '008', 20, 50, -60, 2, 12, 2, 1, 3, 0, 3, true, true);
-- Ingressantes de cada curso: linha da coorte com ano de ingresso igual ao do censo.
-- A coorte de 2022 observada em 2023 é um distrator e não pode ser somada.
INSERT INTO gold.fato_evasao_coorte
  (id_tempo, id_tempo_ingresso, id_instituicao, id_curso, id_area_conhecimento, id_localidade,
   id_oferta, codigo_curso, vinculos_total)
VALUES
  (2, 2, 1, 1, 1, 1, 1, '001', 100),
  (3, 3, 1, 1, 1, 1, 1, '001', 20),
  (3, 2, 1, 1, 1, 1, 1, '001', 70),
  (3, 3, 1, 2, 2, 0, 2, '002', 100),
  (3, 3, 2, 4, 1, 2, 1, '004', 0),
  (3, 3, 2, 5, 1, 2, 1, '005', 0.25),
  (3, 3, 2, 6, 1, 2, 1, '006', 2),
  (3, 3, 3, 7, 2, 2, 1, '007', 2),
  (3, 3, 3, 8, 2, 2, 1, '008', 2);
-- Perfil com dois fatores. O código 7 do apoio social não está no catálogo e só
-- aparece em 2022: em 2023 é uma categoria sem registros. O 006 masculino tem
-- desvinculados ausentes; o 007 tem grupo pequeno e ruído negativo.
INSERT INTO gold.dim_perfil (id_perfil, grupo_fator, fator, categoria, codigo_categoria, ordem_categoria, variavel_origem)
VALUES (1, 'Demográfico', 'Sexo', 'Feminino', '1', 1, 'SUP_ALUNO.TP_SEXO'),
  (2, 'Demográfico', 'Sexo', 'Masculino', '2', 2, 'SUP_ALUNO.TP_SEXO'),
  (3, 'Permanência', 'Recebe apoio social', 'Sim', '1', 1, 'SUP_ALUNO.IN_APOIO_SOCIAL'),
  (4, 'Permanência', 'Recebe apoio social', 'Não', '0', 2, 'SUP_ALUNO.IN_APOIO_SOCIAL'),
  (5, 'Permanência', 'Recebe apoio social', 'Código 7 não previsto no catálogo', '7', 99, 'SUP_ALUNO.IN_APOIO_SOCIAL');
INSERT INTO gold.fato_evasao_perfil
  (id_tempo, id_instituicao, id_curso, id_area_conhecimento, id_localidade, id_oferta, id_perfil, codigo_curso,
   vinculos_total, alunos_cursando, alunos_matricula_trancada, alunos_desvinculados, alunos_transferidos,
   concluintes_total, alunos_falecidos, flag_valor_negativo, flag_grupo_pequeno)
VALUES
  (3, 1, 1, 1, 1, 1, 1, '001', 60, 30, 9, 6, 3, 12, 0, false, false),
  (3, 1, 1, 1, 1, 1, 2, '001', 40, 20, 6, 4, 2, 8, 0, false, false),
  (3, 1, 2, 2, 0, 2, 1, '002', 500, 280, 40, 90, 20, 70, 0, false, false),
  (3, 1, 2, 2, 0, 2, 2, '002', 400, 220, 35, 90, 25, 30, 0, false, false),
  (3, 3, 7, 2, 2, 1, 1, '007', 12, 6, 2, 2, 1, 1, 0, false, true),
  (3, 3, 7, 2, 2, 1, 2, '007', 8, 4, 1, 2, 0, 1, 0, false, true),
  (3, 2, 6, 1, 2, 1, 2, '006', 30, 15, 4, NULL, 1, 5, 0, false, false),
  (3, 1, 1, 1, 1, 1, 3, '001', 10, 7, 1, 0, 0, 2, 0, false, true),
  (3, 1, 1, 1, 1, 1, 4, '001', 90, 43, 14, 10, 5, 18, 0, false, false),
  (3, 1, 2, 2, 0, 2, 3, '002', 100, 80, 5, 1, 0, 14, 0, false, false),
  (3, 1, 2, 2, 0, 2, 4, '002', 800, 420, 70, 179, 45, 86, 0, false, false),
  (3, 3, 7, 2, 2, 1, 3, '007', 2.5, 3, 0, -0.5, 0, 0, 0, true, true),
  (3, 3, 7, 2, 2, 1, 4, '007', 17.5, 7, 3, 4.5, 1, 2, 0, false, true),
  (2, 1, 1, 1, 1, 1, 5, '001', 5, 5, 0, 0, 0, 0, 0, false, true);
