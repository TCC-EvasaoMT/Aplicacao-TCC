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
INSERT INTO gold.fato_evasao_curso
  (id_tempo, id_instituicao, id_curso, id_area_conhecimento, id_localidade, id_oferta, codigo_curso,
   vinculos_total, ingressantes_total, matriculas_total, concluintes_total, alunos_cursando,
   alunos_desvinculados, alunos_transferidos, alunos_matricula_trancada, alunos_falecidos,
   docentes_total, flag_valor_negativo, flag_grupo_pequeno)
VALUES
  (2, 1, 1, 1, 1, 1, '001', 1000, 100, 800, 200, 600, 90, 10, 100, 0, 20, false, false),
  (3, 1, 1, 1, 1, 1, '001', 100, 20, 70, 20, 50, 10, 5, 15, 0, 10, false, false),
  (3, 1, 2, 2, 0, 2, '002', 900, 100, 600, 100, 500, 180, 45, 75, 0, 30, false, false),
  (3, 0, 3, 0, 0, 0, '003', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 5, false, NULL),
  (4, 0, 3, 0, 0, 0, '003', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 5, false, NULL),
  (3, 2, 4, 1, 2, 1, '004', 0, 0, 0, 0, 0, 1, 0, 0, 0, 3, false, true),
  (3, 2, 5, 1, 2, 1, '005', 20.5, 0.25, 14.75, 4.25, 10.5, -2.5, 3.25, 5, 0, 3, true, true),
  (3, 2, 6, 1, 2, 1, '006', 30, 2, 20, 5, 15, NULL, 1, 4, 0, 3, false, false),
  (3, 3, 7, 2, 2, 1, '007', 20, 2, 12, 2, 10, 4, 1, 3, 0, 3, false, true),
  (3, 3, 8, 2, 2, 1, '008', 20, 2, 14, 2, 12, 2, 1, 3, 0, 3, false, true);
