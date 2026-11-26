# Como trabalhar neste repositório

Este repositório contém a aplicação web: frontend React, backend Fastify e documentação. A [pipeline Python](https://github.com/TCC-EvasaoMT/Pipeline-TCC) tem repositório e ciclo de execução próprios.

## Branches

Usamos [GitHub Flow](https://docs.github.com/en/get-started/using-github/github-flow): `main` deve continuar executável, e cada tarefa nasce em uma branch curta a partir dela. Não usamos `develop`, branches permanentes por integrante ou uma branch permanente para cada camada. Uma funcionalidade pode alterar frontend e backend juntos.

Exemplos de nomes:

- `feat/filtro-por-curso`
- `fix/taxa-com-base-zero`
- `docs/metodologia-indicadores`
- `chore/atualizar-dependencias`

Inicie cada tarefa a partir da `main` atualizada:

```powershell
git switch main
git pull --ff-only
git switch -c feat/filtro-por-curso
```

Faça alterações, execute `pnpm check` e, quando mudar consultas, grants ou autenticação, execute também `pnpm test:integration` com PostgreSQL de teste. Confira e selecione os arquivos do commit:

```powershell
git status
git diff
git add frontend/src/App.tsx
git diff --staged
git commit -m "feat(frontend): adiciona filtro por curso"
git push -u origin feat/filtro-por-curso
```

Abra um pull request para `main`. Use uma descrição que explique o comportamento e como foi testado. Peça revisão de outro integrante, corrija o que for necessário e faça **Squash and merge**, com o título no formato de commit abaixo. Apague a branch remota depois do merge. O PR pode ter vários commits de trabalho; o squash registra a entrega como uma mudança coesa em `main`.

## Formatação

Frontend e backend usam a configuração do Prettier em `.prettierrc.json`: tabulações com largura de dois espaços, aspas simples em JavaScript/TypeScript, sem ponto e vírgula, sem vírgula final e finais de linha LF. A largura de referência é de 80 caracteres; o Prettier decide as quebras conforme a sintaxe.

Execute na raiz:

```powershell
pnpm format        # Formata os arquivos compatíveis do projeto
pnpm format:check  # Verifica a formatação sem alterar arquivos
```

Para formatar somente os arquivos de uma tarefa, use, por exemplo, `pnpm exec prettier --write backend/src/modules/analises/evolucao.ts`. A versão do Prettier fica fixada no `package.json`; instale as dependências com pnpm antes de usar a integração do editor. O editor deve usar essa instalação local e a configuração da raiz.

`.prettierignore` exclui builds, dependências, caches, lockfile, dados, configurações de ambiente e a documentação local em `docs-codex`. O Prettier também respeita o `.gitignore` ao ser executado pela raiz. SQL não tem formatador incluído nesta configuração.

Execute a formatação ao terminar uma alteração. Mantenha formatações gerais em commits próprios, separadas de mudanças funcionais. `format:check` não integra `pnpm check` nem o workflow de CI atual; execute-o também antes do PR.

## Commits

Seguimos [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/):

```text
tipo(escopo): descrição
```

| Tipo       | Quando usar                                   | Exemplo                                                      |
| ---------- | --------------------------------------------- | ------------------------------------------------------------ |
| `feat`     | Funcionalidade nova                           | `feat(frontend): adiciona seleção de ano`                    |
| `fix`      | Correção de comportamento                     | `fix(backend): preserva valores ausentes no resumo`          |
| `refactor` | Organização do código sem mudar comportamento | `refactor(backend): encapsula módulo de indicadores`         |
| `test`     | Testes                                        | `test(backend): verifica permissões após reconstruir a Gold` |
| `docs`     | Documentação                                  | `docs: explica como executar o monorepo`                     |
| `build`    | Dependências e compilação                     | `build: configura workspace pnpm`                            |
| `ci`       | Automação no GitHub                           | `ci: valida aplicação com PostgreSQL`                        |
| `chore`    | Manutenção sem encaixe mais específico        | `chore: ajusta arquivos ignorados pelo Git`                  |

Use um escopo quando isso ajudar: `frontend`, `backend` ou o módulo, como `analises` e `auth`. O escopo é opcional; mudanças que atravessam a aplicação podem omiti-lo. Escreva a descrição em português, explicando a mudança, e mantenha cada commit focado em uma intenção. Alterações independentes devem ficar em commits separados. Alterações de front e back necessárias para a mesma funcionalidade podem ficar juntas.

Para incompatibilidade em um contrato publicado, sinalize com `!` e explique a migração:

```text
feat(backend)!: altera a representação dos filtros

BREAKING CHANGE: o filtro de curso passa a aceitar o código original como texto.
```

## Configuração de um novo clone

O repositório da aplicação já está publicado. Para começar em outro computador:

```powershell
git clone https://github.com/TCC-EvasaoMT/Aplicacao-TCC.git
cd Aplicacao-TCC
pnpm install --frozen-lockfile
```

Siga o [README](README.md) para configurar o ambiente ou executar a demonstração. O clone já configura `origin`; confira o destino com `git remote -v` antes de publicar uma branch.

A configuração recomendada de `main` exige PR, uma aprovação de outro integrante e o check **Validar monorepo**, conforme os recursos disponíveis no GitHub. Habilite squash merge e exclusão automática das branches após o merge. O workflow executa TypeScript, testes, build e integração com PostgreSQL sintético; sua presença no código não confirma que a proteção de branch está ativa.

## Documentação

Consulte o [índice](docs/README.md) antes de criar um arquivo. Mantenha contratos em `docs/api`, interface em `docs/frontend`, decisões estruturais em `docs/arquitetura` e execução em `docs/operacao`. Fontes e definições ficam em `docs/metodologia`; a comparação com o texto acadêmico fica em `docs/tcc`.

Descreva o comportamento disponível na `main`. Identifique funcionalidades pendentes e diferencie testes executados de roteiros ainda pendentes. Ao mover um documento, atualize links e âncoras, inclusive nos READMEs. Mudanças de funcionalidade devem atualizar a documentação do módulo e a matriz de requisitos; o mapa de desenvolvimento permanece local em `docs-codex/`.

## O que versionar

- Código, documentação, testes sintéticos, exemplos de configuração e o único `pnpm-lock.yaml` da raiz.
- `.env`, `node_modules`, `dist`, caches, logs e a pasta `dados` ficam ignorados. Nunca adicione tokens, senhas ou extrações reais para contornar o `.gitignore`.
- A pipeline permanece no repositório dela, sem cópia nem submódulo aqui. Quando uma mudança depender de ambos, relacione os dois PRs e descreva o contrato esperado da Gold.
- Não altere credenciais ou parâmetros do `.env` de outro integrante. Mudanças de configuração devem ser documentadas no `.env.example` e no README.
