CREATE TABLE app.usuarios (
    id uuid PRIMARY KEY,
    email text NOT NULL UNIQUE CHECK (email = lower(email)),
    senha_hash text NOT NULL,
    ativo boolean NOT NULL DEFAULT true,
    criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.usuario_permissoes (
    usuario_id uuid NOT NULL REFERENCES app.usuarios(id) ON DELETE CASCADE,
    permissao text NOT NULL CHECK (permissao IN ('etl:consultar', 'etl:reprocessar')),
    PRIMARY KEY (usuario_id, permissao)
);

CREATE TABLE app.sessoes (
    id uuid PRIMARY KEY,
    usuario_id uuid NOT NULL REFERENCES app.usuarios(id) ON DELETE CASCADE,
    criado_em timestamptz NOT NULL DEFAULT now(),
    expira_em timestamptz NOT NULL DEFAULT now() + interval '7 days',
    revogada_em timestamptz
);
CREATE INDEX sessoes_usuario_idx ON app.sessoes(usuario_id);

-- Tokens consumidos são mantidos até a remoção da sessão para detectar reuso.
CREATE TABLE app.tokens_renovacao (
    hash text PRIMARY KEY,
    sessao_id uuid NOT NULL REFERENCES app.sessoes(id) ON DELETE CASCADE,
    usado_em timestamptz
);
CREATE INDEX tokens_sessao_idx ON app.tokens_renovacao(sessao_id);
