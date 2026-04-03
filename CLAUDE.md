# CLAUDE.md — CliniFunnel

## Stack
- **Framework**: Next.js 14 (App Router) + TypeScript (strict)
- **UI**: Tailwind CSS + shadcn/ui
- **Database**: PostgreSQL (Prisma ORM)
- **Fila/Jobs**: BullMQ + Redis
- **Deploy**: Docker + GitHub Actions → VPS

## Versionamento (Semantic Versioning)

Toda mudanca que vai para producao DEVE ter bump de versao em:
1. `package.json` → campo `"version"`
2. `src/lib/version.ts` → constante `APP_VERSION` + entrada no `CHANGELOG`

| Tipo | Bump | Quando usar |
|------|------|-------------|
| Major | X.0.0 | Breaking change |
| Minor | 0.X.0 | Feature nova |
| Patch | 0.0.X | Bug fix |

## Git Workflow (OBRIGATORIO)

1. NUNCA commitar direto na `main` — sempre via feature branch → PR → squash merge
2. NUNCA reusar branch — cada fix/feature tem sua propria branch
3. SEMPRE bumpar versao antes de abrir PR
4. SEMPRE usar squash merge

### Nomenclatura de branches
```
feat/nome-da-feature
fix/descricao-do-bug
chore/descricao
```

### Fluxo
```bash
git checkout main && git pull origin main
git checkout -b feat/minha-feature
# desenvolver, commitar
git push -u origin feat/minha-feature
gh pr create --title "feat: descricao" --body "..."
gh pr merge --squash
git checkout main && git pull origin main
```

## Comandos uteis

```bash
# Dev
docker compose -f docker-compose.dev.yml up -d   # Postgres + Redis
npm run dev                                        # Next.js dev server

# Database
npx prisma migrate dev                            # Criar/aplicar migrations
npx prisma studio                                 # GUI do banco
npx prisma generate                               # Gerar client

# Build
npm run build                                      # Build producao
```

## Convencoes

- TypeScript strict: sem `any`, sem `!` desnecessarios
- Imports: usar `@/` para paths absolutos
- Componentes: PascalCase
- API routes: kebab-case
- Funcoes: camelCase, verbos descritivos
- Webhooks: sempre responder 200 rapido, processar async via BullMQ
- Variaveis sensiveis: nunca hardcode, sempre via env ou banco
