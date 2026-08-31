<!-- BEGIN:contrato-claude-codex v1 -->
# Contrato Claude + Codex — clinifunnel

> **Fonte única.** Este é o texto que os dois agentes leem.
> Codex lê `AGENTS.md` nativamente. Claude Code lê `CLAUDE.md`, que importa este
> arquivo com `@AGENTS.md`. **Edite sempre aqui — nunca duplique no CLAUDE.md.**
> O bloco entre os marcadores `contrato-claude-codex` é gerado: atualize em todos os
> projetos de uma vez com `docs/agentes/stamp-agents.sh` na raiz do workspace.
> Tudo o que estiver **fora** dos marcadores é livre e nunca é sobrescrito.

## 0. Idioma e interlocutor
- Trabalho e respostas em **PT-BR**.
- O dono é o **Bruno**: visão de produto e negócio forte, técnico, mas **não é dev
  full-time**. Explique todo termo técnico em uma frase simples antes de pedir decisão.
- Ordem de uma explicação: problema em português → exemplo com número real →
  consequência para o negócio → só então o detalhe técnico → **uma** decisão, com
  recomendação explícita. Nunca despejar quatro perguntas juntas.

## 1. Somos uma equipe, não dois concorrentes
- Claude e Codex servem ao mesmo dono e ao mesmo projeto. Compartilhem contexto.
- **Nunca** descarte, reverta, sobrescreva ou "limpe" trabalho do outro agente sem
  autorização explícita do Bruno. Alteração não commitada que você não escreveu é
  trabalho em curso de alguém.
- Achou algo do outro agente que parece errado? **Sinalize, não conserte por cima.**

## 2. Divisão de trabalho (preferência, não muro)

| Normalmente **Claude** | Normalmente **Codex** |
|---|---|
| descoberta visual, UX, design system | arquitetura, regra de negócio |
| interface, componentes, telas, estados vazios/erro | backend, banco, migrations, integrações |
| material visual e documentação para o cliente | testes, revisão técnica, performance |

Qualquer um pode sair da sua faixa quando a tarefa exigir — desde que registre no
bilhete de handoff (§5) o que tocou.

## 3. A regra que faz o paralelo funcionar: um worktree por tarefa

**Nunca dois agentes editando a mesma área ao mesmo tempo.**

1. `git fetch --all --prune`
2. Ler as **duas** direções:
   - `git log --oneline origin/main..main` → tenho coisa por empurrar?
   - `git log --oneline main..origin/main` → o remoto andou sem mim?
3. `git worktree list` e `git branch -a` → que frentes já estão abertas.
4. Abrir worktree próprio, irmão do checkout:
   `git worktree add ../<repo>-<tarefa> -b feat/<tarefa>`
   Prefixos: `feat/` · `fix/` · `chore/` · `docs/`.
5. **Empurrar a branch no primeiro commit** (`git push -u origin <branch>`).
   Branch no remoto é como o outro agente descobre que a frente existe.

- **Nunca commitar direto no `main`.**
- Frente nova enquanto outra está em curso → worktree novo. Não se mexe no que já está a andar.
- Um worktree = uma tarefa = um PR. Terminou e mergeou → remova o worktree.

## 4. Antes de editar qualquer arquivo
- `git status` no repositório certo. Trabalhe **só** no repositório que contém a tarefa;
  este workspace tem vários projetos independentes, não é um produto só.
- Leia o contexto local: este arquivo, o `README.md`, e o `COLLABORATION.md` **irmão do
  checkout** (fora do repositório, não committado) se existir — é onde moram o caminho
  do deploy, onde se vê a versão, a próxima migration livre e as armadilhas conhecidas.
  Se não existir, crie ao descobrir a primeira dessas coisas.
- Se a área já está tomada por outra frente, escolha outra tarefa ou fale com o Bruno.

## 5. O bilhete de handoff (obrigatório ao terminar ou parar no meio)
Deixe por escrito — na descrição do PR ou no `COLLABORATION.md` irmão:
- **O que mudou:** arquivos e áreas tocadas.
- **O que foi verificado:** comando rodado + resultado real. Nunca alegue ter executado
  o que não executou.
- **O que ficou pendente** e qual o próximo passo objetivo.
- **Contratos alterados:** tipos, schema, endpoints, permissões, estados de tela,
  decisões documentadas. Mudou contrato → atualize os consumidores e a documentação
  na mesma entrega.

## 6. Mergear não é entregar
Depois do merge, nesta ordem:
1. aplicar as migrations;
2. fazer o deploy **pelo caminho deste projeto** — em vários deles o deploy sai da
   pasta local, e o merge no GitHub **não põe nada no ar**;
3. abrir a aplicação e **confirmar a versão** (rodapé, tela de versão ou `/api/version`);
4. smoke test do que mudou.

Só depois disso dizer "entregue" — e só depois disso avisar o cliente.
Depois de **cada rebase**, reconferir o número da migration
(`ls supabase/migrations | tail -5`). Colidiu? Renumera-se a **minha**, nunca a do outro.

## 7. Qualidade e segurança
- Mudanças pequenas, verificáveis, escritas no idioma do código que já existe.
- Rode os comandos de verificação do projeto quando forem pertinentes.
- **Nunca** commitar, logar ou expor segredos, arquivos `.env`, tokens ou dado pessoal.
- Peça confirmação antes de ação externa, destrutiva ou que mude produção — salvo
  autorização já dada para esta tarefa. Autorização dada uma vez vale para as
  ocorrências seguintes do mesmo tipo: não reconfirme a cada passo.

## 8. Precedência
1. Instrução direta do Bruno na conversa.
2. Instruções mais próximas do arquivo em edição (um `AGENTS.md` de subpasta).
3. Este arquivo.
4. `AGENTS.md` da raiz do workspace (`~/Documents/Claude.Code/AGENTS.md`).
5. Comportamento padrão da ferramenta.
<!-- END:contrato-claude-codex v1 -->

---

# Orientações do projeto

Este projeto faz parte do contrato de colaboração do workspace. Leia o `CLAUDE.md` deste diretório integralmente antes de qualquer análise ou alteração não trivial: ele contém o contexto, a arquitetura de deploy e os comandos específicos do CliniFunnel.

Mantenha Claude e Codex alinhados: preserve contratos entre interface e backend, não sobrescreva trabalho local de outro agente e registre decisões ou pendências relevantes no local apropriado do projeto.

## 9. Contexto deste projeto

<!-- Area livre: o carimbador nunca sobrescreve daqui para baixo. -->

- **Repositorio:** brunopalhardi/clinifunnel
- **Stack:** _preencher_
- **Como rodar:** _preencher_
- **Como faz o deploy:** _preencher (varios projetos deployam da pasta local)_
- **Onde se ve a versao no ar:** _preencher_
- **Armadilhas conhecidas:** _preencher_
