-- Fixture de teste: DDL das oito tabelas consumidas pela API, sem carga nem migração.
-- Fonte: TCC-EvasaoMT/Pipeline-TCC/sql/gold.sql
-- Commit: ff66b7d44306a257fedde422a771848cc9a7899f; blob: 95f77bb83d4e38de29b39a7466794de9eb3a3b39.
CREATE SCHEMA gold;

CREATE TABLE gold.dim_tempo (
    id_tempo      integer PRIMARY KEY,
    ano_censo     integer UNIQUE,     -- também faz o papel de ano de ingresso na coorte
    ano_anterior  integer             -- usado na evasão anual pelo método Lobo
);

CREATE TABLE gold.dim_instituicao (
    id_instituicao            integer PRIMARY KEY,
    codigo_mantenedora        text,
    categoria_administrativa  text,
    organizacao_academica     text,
    codigo_municipio_sede     text,
    municipio_sede            text,
    uf_sede                   text,
    regiao_sede               text,
    mesorregiao_sede          text,
    microrregiao_sede         text
);

CREATE TABLE gold.dim_curso (
    id_curso                   integer PRIMARY KEY,
    codigo_curso               text UNIQUE,
    nome_curso                 text,
    grau_academico             text,
    nivel_academico            text,
    carga_horaria              numeric,
    situacao_curso             text,     -- situação de funcionamento no último ano observado
    prazo_integralizacao_anos  numeric,
    ano_inicio_funcionamento   integer
);

CREATE TABLE gold.dim_area_conhecimento (
    id_area_conhecimento    integer PRIMARY KEY,
    codigo_rotulo_cine      text UNIQUE,
    nome_curso_cine         text,
    codigo_area_geral       text,
    area_geral              text,
    codigo_area_especifica  text,
    area_especifica         text,
    codigo_area_detalhada   text,
    area_detalhada          text
);

CREATE TABLE gold.dim_localidade (
    id_localidade     integer PRIMARY KEY,
    codigo_municipio  text UNIQUE,
    municipio         text,
    uf                text,
    nome_uf           text,
    regiao            text,
    eh_capital        boolean,
    mesorregiao       text,
    microrregiao      text
);

CREATE TABLE gold.dim_oferta (
    id_oferta                     integer PRIMARY KEY,
    modalidade_ensino             text,
    turno                         text,
    eh_gratuito                   boolean,
    possui_parte_ead              boolean,
    percentual_carga_horaria_ead  numeric,
    UNIQUE NULLS NOT DISTINCT (modalidade_ensino, turno, eh_gratuito, possui_parte_ead,
                               percentual_carga_horaria_ead)
);

CREATE TABLE gold.fato_evasao_curso (
    id_tempo                   integer NOT NULL REFERENCES gold.dim_tempo,
    id_instituicao             integer NOT NULL REFERENCES gold.dim_instituicao,
    id_curso                   integer NOT NULL REFERENCES gold.dim_curso,
    id_area_conhecimento       integer NOT NULL REFERENCES gold.dim_area_conhecimento,
    id_localidade              integer NOT NULL REFERENCES gold.dim_localidade,
    id_oferta                  integer NOT NULL REFERENCES gold.dim_oferta,
    codigo_curso               text NOT NULL,
    vinculos_total             numeric,
    alunos_cursando            numeric,
    alunos_matricula_trancada  numeric,
    alunos_desvinculados       numeric,
    alunos_transferidos        numeric,
    concluintes_total          numeric,
    alunos_falecidos           numeric,
    ingressantes_total         numeric,
    matriculas_total           numeric,
    docentes_total             numeric,
    docentes_doutores          numeric,
    docentes_tempo_integral    numeric,
    flag_valor_negativo        boolean,
    flag_grupo_pequeno         boolean,
    PRIMARY KEY (id_tempo, id_curso)
);

-- Lida somente na linha do ano de ingresso igual ao ano do censo, para os ingressantes.
CREATE TABLE gold.fato_evasao_coorte (
    id_tempo                   integer NOT NULL REFERENCES gold.dim_tempo,
    id_tempo_ingresso          integer NOT NULL REFERENCES gold.dim_tempo,
    id_instituicao             integer NOT NULL REFERENCES gold.dim_instituicao,
    id_curso                   integer NOT NULL REFERENCES gold.dim_curso,
    id_area_conhecimento       integer NOT NULL REFERENCES gold.dim_area_conhecimento,
    id_localidade              integer NOT NULL REFERENCES gold.dim_localidade,
    id_oferta                  integer NOT NULL REFERENCES gold.dim_oferta,
    codigo_curso               text NOT NULL,
    vinculos_total             numeric,
    alunos_cursando            numeric,
    alunos_matricula_trancada  numeric,
    alunos_desvinculados       numeric,
    alunos_transferidos        numeric,
    concluintes_total          numeric,
    alunos_falecidos           numeric,
    ingressantes_total         numeric,
    flag_valor_negativo        boolean,
    flag_grupo_pequeno         boolean,
    PRIMARY KEY (id_tempo, id_tempo_ingresso, id_curso)
);

-- Perfil: uma linha por curso, categoria de um fator e ano. Cada fator soma o
-- total de vínculos; fatores diferentes nunca são somados entre si.
CREATE TABLE gold.dim_perfil (
    id_perfil         integer PRIMARY KEY,
    grupo_fator       text,
    fator             text,
    categoria         text,
    codigo_categoria  text,
    ordem_categoria   integer,
    variavel_origem   text,
    UNIQUE NULLS NOT DISTINCT (fator, codigo_categoria)
);

CREATE TABLE gold.fato_evasao_perfil (
    id_tempo                   integer NOT NULL REFERENCES gold.dim_tempo,
    id_instituicao             integer NOT NULL REFERENCES gold.dim_instituicao,
    id_curso                   integer NOT NULL REFERENCES gold.dim_curso,
    id_area_conhecimento       integer NOT NULL REFERENCES gold.dim_area_conhecimento,
    id_localidade              integer NOT NULL REFERENCES gold.dim_localidade,
    id_oferta                  integer NOT NULL REFERENCES gold.dim_oferta,
    id_perfil                  integer NOT NULL REFERENCES gold.dim_perfil,
    codigo_curso               text NOT NULL,
    vinculos_total             numeric,
    alunos_cursando            numeric,
    alunos_matricula_trancada  numeric,
    alunos_desvinculados       numeric,
    alunos_transferidos        numeric,
    concluintes_total          numeric,
    alunos_falecidos           numeric,
    flag_valor_negativo        boolean,
    flag_grupo_pequeno         boolean,
    PRIMARY KEY (id_tempo, id_curso, id_perfil)
);
