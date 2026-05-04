<!--
Antes de abrir o PR, leia CLAUDE.md secao "Padrao de Engenharia".
Cada item abaixo e obrigatorio. PR sem checklist completo nao sera revisado.
-->

## Resumo

<!-- 1-3 frases descrevendo o que muda e por que. -->

## Tipo

- [ ] feat (feature nova — bump minor)
- [ ] fix (bug fix — bump patch)
- [ ] chore (processo/infra/docs — bump patch ou minor)
- [ ] refactor (mudanca interna sem feature/fix — bump patch)

## Item do backlog

<!-- Link/referencia para item em docs/IMPROVEMENTS.md -->
Ref: `docs/IMPROVEMENTS.md` — secao "..." — item "..."

## Checklist obrigatorio

- [ ] Branch tem nome no padrao (`feat/`, `fix/`, `chore/`, `refactor/`)
- [ ] `package.json` `version` bumpado
- [ ] `src/lib/version.ts` `APP_VERSION` bumpado e nova entrada no `CHANGELOG`
- [ ] `docs/IMPROVEMENTS.md` atualizado (item movido para "Concluidos" ou registrado)
- [ ] `npm run lint` passa localmente
- [ ] `npx tsc --noEmit` passa localmente
- [ ] `npm run build` passa localmente
- [ ] Mudancas de UI: testadas em `npm run dev` (descrever abaixo o que foi testado)
- [ ] Mudancas de schema Prisma: migration commitada em `prisma/migrations/`
- [ ] Migration destrutiva (drop/rename): plano de rollback descrito abaixo

## Como testei

<!-- Passo a passo do teste manual, especialmente para mudancas de UI ou comportamento. -->

## Rollback (se aplicavel)

<!-- Para mudancas destrutivas de banco ou de processo, descrever como reverter. -->

## Notas para o revisor

<!-- Pontos que merecem atencao especial, decisoes de design, alternativas consideradas. -->
