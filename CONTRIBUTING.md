# Como trabalhar neste repositório

Este repositório contém a aplicação web: frontend React, backend Fastify e documentação. A [pipeline Python](https://github.com/TCC-EvasaoMT/Pipeline-TCC) tem repositório e ciclo de execução próprios.

## Branches

Usamos [GitHub Flow](https://docs.github.com/en/get-started/using-github/github-flow): `main` deve continuar executável, e cada tarefa nasce em uma branch curta a partir dela. Não usamos `develop`, branches permanentes por integrante ou uma branch permanente para cada camada. Uma funcionalidade pode alterar frontend e backend juntos.

Exemplos de nomes:

- `feat/filtro-por-curso`
- `fix/taxa-com-base-zero`
- `docs/metodologia-indicadores`
- `chore/atualizar-dependencias`

Depois que `main` estiver publicada no GitHub, inicie cada tarefa com:

```powershell
git switch main
git pull --ff-only
git switch -c feat/filtro-por-curso
```

Faça alterações, execute `pnpm check` e, quando mudar consultas, execute também `pnpm test:integration` com PostgreSQL de teste. Confira e selecione os arquivos do commit:

```powershell
git status
git diff
git add frontend/src/App.tsx
git diff --staged
git commit -m "feat(frontend): adiciona filtro por curso"
git push -u origin feat/filtro-por-curso
```

Abra um pull request para `main`. Use uma descrição que explique o comportamento e como foi testado. Peça revisão de outro integrante, corrija o que for necessário e faça **Squash and merge**, com o título no formato de commit abaixo. Apague a branch remota depois do merge. O PR pode ter vários commits de trabalho; o squash registra a entrega como uma mudança coesa em `main`.

## Commits

Seguimos [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/):

```text
tipo(escopo): descrição
```

| Tipo | Quando usar | Exemplo |
| --- | --- | --- |
| `feat` | Funcionalidade nova | `feat(frontend): adiciona seleção de ano` |
| `fix` | Correção de comportamento | `fix(backend): preserva valores ausentes no resumo` |
| `refactor` | Organização do código sem mudar comportamento | `refactor(backend): encapsula módulo de indicadores` |
| `test` | Testes | `test(backend): verifica permissões após reconstruir a Gold` |
| `docs` | Documentação | `docs: explica como executar o monorepo` |
| `build` | Dependências e compilação | `build: configura workspace pnpm` |
| `ci` | Automação no GitHub | `ci: valida aplicação com PostgreSQL` |
| `chore` | Manutenção sem encaixe mais específico | `chore: ajusta arquivos ignorados pelo Git` |

Use `frontend` e `backend` quando isso ajudar. O escopo é opcional; mudanças que atravessam a aplicação podem omiti-lo. Escreva a descrição em português, explicando a mudança, e mantenha cada commit focado em uma intenção. Alterações independentes devem ficar em commits separados. Alterações de front e back necessárias para a mesma funcionalidade podem ficar juntas.

Para incompatibilidade em um contrato publicado, sinalize com `!` e explique a migração:

```text
feat(backend)!: altera a representação dos filtros

BREAKING CHANGE: o filtro de curso passa a aceitar o código original como texto.
```

## Primeiro commit e publicação

O Git local foi iniciado com `main`; o primeiro commit deve registrar a base funcional existente. Depois de revisar `git status`, os arquivos e a documentação acadêmica que deseja incluir:

```powershell
git add .
git diff --staged --stat
git diff --staged
git commit -m "feat: inicia aplicação de evasão com React e Fastify"
```

Crie no GitHub um repositório vazio para a aplicação, por exemplo `TCC-EvasaoMT/Aplicacao-TCC`, sem gerar README ou `.gitignore` pelo site. O nome é uma sugestão, não um repositório já criado. Adicione o endereço real como remote e publique a base:

```powershell
git remote add origin URL_DO_REPOSITORIO
git push -u origin main
```

O primeiro envio estabelece a base. A partir dele, trabalhe por branches e PRs. Um repositório Git local e um repositório hospedado no GitHub são coisas distintas: `git init` não publica arquivos.

Depois da publicação, configure uma regra para `main` exigir PR, uma aprovação de outro integrante e o check **Validar monorepo**, se esses recursos estiverem disponíveis para o repositório. Habilite squash merge e exclusão automática das branches após o merge. O workflow incluído executa TypeScript, testes, build e integração com PostgreSQL sintético; a regra de proteção precisa ser configurada no GitHub.

## O que versionar

- Código, documentação, testes sintéticos, exemplos de configuração e o único `pnpm-lock.yaml` da raiz.
- `.env`, `node_modules`, `dist`, caches, logs e a pasta `dados` ficam ignorados. Nunca adicione tokens, senhas ou extrações reais para contornar o `.gitignore`.
- A pipeline permanece no repositório dela, sem cópia nem submódulo aqui. Quando uma mudança depender de ambos, relacione os dois PRs e descreva o contrato esperado da Gold.
- Não altere credenciais ou parâmetros do `.env` de outro integrante. Mudanças de configuração devem ser documentadas no `.env.example` e no README.
