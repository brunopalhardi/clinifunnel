# Redesign Visual — PR2: Sidebar + Header

> **Status:** aprovado por Bruno em 2026-05-12
> **Autor da spec:** Claude (Opus 4.7)
> **Spec pai:** [`2026-05-11-redesign-visual-design.md`](./2026-05-11-redesign-visual-design.md) — define a paleta laranja + tokens light/dark já em produção desde v0.39.0.
> **Escopo desta spec:** repaginar `Sidebar` e `Header` aplicando o novo sistema visual + consolidar `bg-gold`/`text-gold` em `bg-primary`/`text-primary` nesses dois componentes (zerar a maior fonte do "legado dourado"). Não toca em conteúdo das páginas internas — isso é PR3+.

---

## 1. Objetivo

Os dois componentes de chrome (sidebar + header) aparecem em toda página do dashboard. Refazendo aqui, o sistema inteiro já dá um salto perceptivo, e a maior concentração de `text-gold`/`bg-gold` legado (sidebar: 8 ocorrências, header: 2 ocorrências) sai do caminho com refactor explícito.

Mudanças principais (validadas com Bruno via companion visual):

1. **Sidebar acompanha o tema** — antes era sempre escura (`bg-sidebar` HSL `240 14% 7%` em ambos os modos); agora light = papel quente, dark = preto carvão.
2. **Brand block** vira wordmark "Clini**Funnel**" (Funnel laranja) + microsubtítulo "PAINEL CLÍNICO". Remove o ícone "CF" quadrado atual e o subtítulo "Precision Analytics" (inglês destoava).
3. **Item ativo** ganha fundo laranja 12% + texto laranja escuro (light: `#E0631A`, dark: `#FF9F5C`) **mantendo** a barra lateral de 3px que já existia. Hover passa a usar um cinza-papel sutil em vez de `white/5`.
4. **Toggle de tema sai da sidebar** e vira pill no header, junto com Sincronizar + avatar + Sair. Sidebar fica focada só em nav + versão.
5. **Avatar** ganha gradiente laranja (`linear-gradient(135deg, #FF7A1A, #FF5A1F)`) com sombra colorida — mesmo tratamento do ícone "C" do login.
6. **Header** ganha backdrop-blur leve (`backdrop-blur-sm`) sobre o fundo principal.
7. **Consolidação `bg-gold`→`bg-primary`**: 10 usos em `sidebar.tsx` + `header.tsx` são reescritos pra `text-primary`/`bg-primary`. O alias `--gold` continua existindo pra absorver as 29 ocorrências restantes em outras páginas (a serem migradas em PR3+).

## 2. Tokens (já existem desde v0.39.0)

Esta spec **não cria novos tokens** — todos os necessários já foram introduzidos pelo PR1. Recapitulando os usados aqui:

| Token CSS var | Light | Dark | Uso aqui |
|---|---|---|---|
| `--background` | `38 38% 93%` (`#f5efe4`) | `240 14% 5%` (`#0a0a0c`) | Fundo da área principal e do header (com alpha 0.85 + blur) |
| `--card` | `40 80% 98%` (`#fffdf8`) | `240 12% 9%` (`#15151a`) | Bg dos botões/clinic-pill no header |
| `--primary` | `22 100% 55%` (`#FF7A1A`) | igual | Acento; item ativo da nav usa @ 12% alpha; avatar gradiente |
| `--border` | `38 35% 83%` (`#e3dac5`) | `240 8% 16%` | Border do header e dos pills |
| `--foreground` | `36 35% 13%` (`#2a2418`) | `0 0% 100%` (`#fff`) | Texto principal |
| `--muted-foreground` | `36 18% 40%` (`#756a55`) | `240 6% 53%` | Texto secundário (nav itens não ativos, sync info) |

**Novo:** `--sidebar` ganha valor light. Hoje:
```css
:root      { --sidebar: 240 14% 7%; }   /* light: mas força sempre escuro — bug visual */
.dark      { --sidebar: 240 14% 5%; }
```

Vira:
```css
:root      { --sidebar: 38 32% 89%; --sidebar-foreground: 36 25% 25%; }  /* papel mais escuro que o bg */
.dark      { --sidebar: 240 14% 5%; --sidebar-foreground: 0 0% 88%; }
```

> Light sidebar (`#ebe1cb`) fica ~4% mais escuro que o background da área principal (`#f5efe4`) — separação suave mas perceptível, sem virar um bloco de "tecido" diferente.

## 3. Componentes afetados

### 3.1 `src/components/layout/sidebar.tsx`

**Brand block (substitui o atual):**
```tsx
<div className="px-3 pb-1 pt-1">
  <h1 className="font-display text-[20px] font-extrabold tracking-[-0.03em] leading-none text-sidebar-foreground">
    Clini<span className="text-primary">Funnel</span>
  </h1>
  <p className="mt-1.5 text-[8px] font-bold uppercase tracking-[0.22em] text-sidebar-foreground/40">
    Painel Clínico
  </p>
</div>
```

Remove: `<div class="bg-gold/20">CF</div>`, texto `text-gold` no h1, subtítulo "Precision Analytics".

**Nav items (substitui o estilo do ativo):**
```tsx
className={cn(
  "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors",
  isActive
    ? "bg-primary/12 font-semibold text-primary"
    : "text-sidebar-foreground/60 hover:bg-sidebar-foreground/[0.04] hover:text-sidebar-foreground"
)}
```

Mantém a barra lateral de 3px (`bg-primary` em vez de `bg-gold`).

**Footer (simplifica):**
```tsx
<div className="border-t border-sidebar-foreground/10 px-4 pb-5 pt-3">
  <Link
    href="/changelog"
    className="block text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 transition-colors hover:text-sidebar-foreground/70"
  >
    CliniFunnel v{APP_VERSION} · novidades
  </Link>
</div>
```

Remove: o botão do `toggleTheme` (`<button onClick={toggleTheme}>…</button>`) — vai pro header.

**Imports limpos:**
- Remove `useTheme` (não usado mais aqui)
- Remove SVGs do sol/lua

### 3.2 `src/components/layout/header.tsx`

**Clinic selector** (light + dark via tokens):
```tsx
className="bg-card border border-border rounded-md px-3 py-1.5 text-sm font-display font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
```
Trocar `focus:ring-1 focus:ring-gold/50` por `focus:ring-2 focus:ring-primary/40`.

**Sync info + botão:** trocar `text-success` (mantém — já é verde correto) só revisar o `Button variant="outline"` pra usar tokens:
```tsx
<Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
  …
</Button>
```
Remove o `border-border/50` override; default já usa border-border que agora é creme/whitealpha.

**Toggle de tema** — novo no header, importando `ThemeToggle` (componente que já existe em `src/components/layout/theme-toggle.tsx`):

```tsx
import { ThemeToggle } from "@/components/layout/theme-toggle";

// dentro do <div className="flex items-center gap-3">:
<ThemeToggle />
<span className="h-5 w-px bg-border" />  {/* divider */}
```

> `ThemeToggle` foi criado no PR1 e usado no login. Já tá pronto.

**Avatar** (substitui o atual):
```tsx
<div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[hsl(16,100%,55%)] text-[11px] font-semibold text-white shadow-[0_2px_8px_hsl(22,100%,55%/0.3)]">
  {session.user.name?.charAt(0).toUpperCase() || "U"}
</div>
```

Trocar `bg-gold/20 text-gold` pelo gradiente acima.

**Header container** (substitui):
```tsx
<header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/85 px-6 backdrop-blur-md">
```

Adições: `sticky top-0 z-30` (mantém visível no scroll) + `backdrop-blur-md` (vidro sobre o fundo).

### 3.3 `src/components/theme-provider.tsx` (sem mudança)

API `useTheme()` continua funcionando. Só não é mais consumida pela sidebar; resta no `ThemeToggle` (que vai pro header).

### 3.4 `src/app/dashboard/layout.tsx` (sem mudança esperada)

Mas vale verificar: se ele tinha estrutura tipo `<div class="bg-zinc-950">…</div>` hardcoded pra forçar dark, isso precisa virar `bg-background` pra respeitar o tema. Item da verificação visual.

## 4. Acessibilidade

- Item ativo da nav: contraste do texto `#E0631A` sobre fundo `rgba(255,122,26,0.12)` em painel `#ebe1cb` = ~5.6:1 (AA) ✓. Dark: `#FF9F5C` sobre `rgba(255,122,26,0.10)` em `#0a0a0c` = ~7.8:1 ✓.
- Avatar usa o "C" texto branco sobre gradiente laranja = ~5.1:1 (AA) ✓.
- Toggle/Sync no header: borda + bg `--card` garantem contraste sobre o fundo da área (light: `#fffdf8` sobre `#f5efe4` = subtle mas perceptível com border). Mantém `transition-colors` pra hover legível.
- `prefers-reduced-motion`: nenhum transform usado aqui — só `transition-colors`. Safe.

## 5. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Item ativo "some" em sidebar light se contrastar pouco | Spec especifica `bg-primary/12` + texto `text-primary` + barra lateral `bg-primary`. Três sinais visuais combinados. Testado no companion. |
| Sidebar light ficar igual demais ao background da página | Sidebar bg `#ebe1cb` é ~4% mais escuro que `#f5efe4`. Borda `border-r border-border` reforça a separação. Verificar no browser local. |
| Header sticky cobrir conteúdo no scroll | `z-30` garante stacking; backdrop-blur permite ler o conteúdo por baixo. Padding-top do container abaixo permanece (sem reset necessário — Next.js handles isso). |
| Remoção do toggle da sidebar quebrar muscle memory | Bruno é o único usuário direto + companion visual mostrou explicitamente onde o toggle agora vive. Aceitável. Se reclamar, podemos voltar a colocar nos dois lugares (cost: ~10 lines). |
| `text-gold`/`bg-gold` ainda usados em 29 lugares fora da sidebar/header | Continuam funcionando via alias `--gold → --primary` (PR1). Não regridem. Consolidação por arquivo segue em PR3+. |

## 6. Critérios de aceite

- [ ] `src/components/layout/sidebar.tsx` não contém mais `text-gold`/`bg-gold`/`useTheme` e renderiza brand wordmark + nav novo.
- [ ] `src/components/layout/header.tsx` usa `<ThemeToggle />` + avatar gradiente; não contém mais `text-gold`/`bg-gold`.
- [ ] `--sidebar` HSL atualizado em `globals.css` (light papel + dark carvão).
- [ ] `lint`, `tsc --noEmit`, `test`, `build` passam.
- [ ] Verificação visual local em `/dashboard`, `/dashboard/leads`, `/dashboard/campaigns`, `/changelog`: sidebar+header refletem mockup hi-fi, light + dark.
- [ ] Toggle de tema no header alterna corretamente e persiste após reload.
- [ ] `npm run dev` sem novos warnings de console (especialmente hidratação).
- [ ] Bump v0.39.0 → **v0.40.0** (minor); entrada nova no `CHANGELOG` em `src/lib/version.ts`.
- [ ] Item em `docs/IMPROVEMENTS.md` movido pra "Concluidos" linkando o PR.

## 7. O que NÃO está nesta spec (out of scope)

- Mudar conteúdo de páginas internas (`/dashboard/leads`, `/dashboard/campaigns`, etc) — PR3+.
- Refator do `Select` shadcn pra clinic-selector — fica como `<select>` nativo estilizado por enquanto.
- Reorganização do menu lateral (incluir/remover itens, agrupar). Lista fica idêntica.
- Mobile responsivo (sidebar colapsável) — vira PR5 (polimento).
- Migrar os 29 `text-gold`/`bg-gold` restantes — segue automático via alias até PR3+.

## 8. Versão e mensagens

Branch: `feat/visual-redesign-pr2-sidebar-header`
Versão: v0.40.0 (minor)
Commit message exemplos:
- `refactor: sidebar usa tokens novos (light papel + dark carvao), brand wordmark`
- `feat: ThemeToggle no header, avatar com gradiente laranja`
- `refactor: remove toggle de tema da sidebar (movido pro header)`
- `chore: bump v0.40.0 e changelog do redesign PR2`
