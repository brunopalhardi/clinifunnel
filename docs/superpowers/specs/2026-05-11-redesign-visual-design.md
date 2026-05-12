# Redesign Visual — CliniFunnel

> **Status:** aprovado pela direção (Bruno) em 2026-05-11
> **Autor da spec:** Claude (Opus 4.7)
> **Escopo desta spec:** estabelecer o novo sistema visual + entregar o login redesenhado como primeira tela. Demais telas vêm em PRs subsequentes seguindo os mesmos tokens.

---

## 1. Objetivo

Repaginar a identidade visual do CliniFunnel de **âmbar/dourado clínico** para um sistema **laranja vivo + papel quente (light) / preto + glow laranja (dark)**, com a estética de "produto premium moderno" (glass cards, grids sutis, glow do acento).

Por que: o visual atual (Clinical Alabaster + Obsidian Atelier com dourado) é correto e funcional, mas não tem personalidade marcante. O novo sistema mantém todo o respaldo técnico (mesma stack shadcn/tailwind/CSS vars) mas troca a paleta e o "envelope visual" pra um produto que se parece com SaaS de referência (Stripe, Linear, Vercel) sem perder a vibe clínica/quente.

## 2. Princípios

1. **Laranja é a única cor de acento.** Sem amarelo, sem rosa, sem outro accent. Toda hierarquia visual passa pelo laranja, pela neutra (papel/preto) e pelo tom de texto.
2. **Light é o default**, com toggle pra dark a qualquer momento (persistido por usuário). Cada modo é igualmente cuidado — dark não é "light invertido".
3. **Branco puro é proibido.** Light usa tons papel/alabaster quentes; texto principal não é preto puro.
4. **Glass + glow + grid sutil** é a assinatura. Não é só "tema de cores" — é uma textura.
5. **Manrope (display) + Inter (UI)** continuam. Não trocar fontes.
6. **Raio padrão 0.75rem**, sem mudança. Já é o token atual.
7. **Acessibilidade ≥ AA**: contraste mínimo 4.5:1 pra texto, 3:1 pra UI/ícones. Toda combinação nova checada.

## 3. Tokens de design

### 3.1 Cor primária e variantes

| Token | Valor | Uso |
|---|---|---|
| `primary` | `#FF7A1A` · HSL `22 100% 55%` | Botões primários, ring de foco, links de acento, KPIs positivos |
| `primary-hover` | `#FF8A33` · HSL `22 100% 60%` | Hover/topo do gradiente |
| `primary-press` | `#E0631A` · HSL `19 80% 49%` | Estado pressionado, links em light (mais legível sobre fundo claro) |
| `primary-soft-dark` | `#FF9F5C` · HSL `22 100% 68%` | Links e variantes em dark mode (mais legível sobre preto) |

**Gradiente padrão do botão primário:**
```css
background: linear-gradient(180deg, #FF8A33 0%, #FF7A1A 100%);
box-shadow: 0 6px 18px rgba(255,122,26,0.35), 0 1px 0 rgba(255,255,255,0.2) inset;
```

### 3.2 Light mode — "Papel Quente"

| Token | Valor HSL | Hex aproximado | Uso |
|---|---|---|---|
| `background` | `38 38% 93%` | `#f5efe4` | Fundo de página (alabaster quente) |
| `card` | `40 80% 98%` | `#fffdf8` | Cards opacos / inputs |
| `card-glass` | `rgba(255,250,242,0.82)` | — | Glass card (login, modais hero) |
| `foreground` | `36 35% 13%` | `#2a2418` | Texto principal (marrom-quase-preto) |
| `muted-foreground` | `36 18% 40%` | `#756a55` | Texto secundário |
| `border` | `38 35% 83%` | `#e3dac5` | Bordas e separadores |
| `input` | `40 80% 98%` | `#fffdf8` | Fundo de input |
| `ring` | `22 100% 55%` | `#FF7A1A` | Focus ring |
| `accent-soft` | `rgba(255,122,26,0.12)` | — | Tags, badges, hover sutil |

### 3.3 Dark mode — "Carvão Glow"

| Token | Valor HSL | Hex aproximado | Uso |
|---|---|---|---|
| `background` | `240 14% 5%` | `#0a0a0c` | Fundo de página |
| `card` | `240 12% 9%` | `#15151a` | Cards opacos |
| `card-glass` | `rgba(20,20,24,0.72)` | — | Glass card |
| `foreground` | `0 0% 100%` | `#ffffff` | Texto principal |
| `muted-foreground` | `240 6% 53%` | `#888888` | Texto secundário |
| `border` | `rgba(255,255,255,0.08)` | — | Bordas e separadores |
| `input` | `rgba(255,255,255,0.04)` | — | Fundo de input |
| `ring` | `22 100% 55%` | `#FF7A1A` | Focus ring |
| `accent-soft` | `rgba(255,122,26,0.16)` | — | Tags, badges |

### 3.4 Semânticas (mantidas)

| Token | Light | Dark |
|---|---|---|
| `success` | `#10804d` (HSL 160 70% 30%) | `#22c692` (HSL 160 72% 50%) |
| `destructive` | `#dc2929` (HSL 0 75% 50%) | `#df3737` (HSL 0 72% 51%) |
| `warning` | igual a `primary` (laranja) | igual a `primary` |

> **Decisão:** não introduzir amarelo separado pra "warning". Laranja vivo já cumpre. Reduz ruído da paleta.

### 3.5 Tipografia

| Token | Família | Pesos | Uso |
|---|---|---|---|
| `font-display` | Manrope | 700, 800 | h1–h6, KPIs, números grandes |
| `font-sans` | Inter | 400, 500, 600, 700 | Body, labels, botões |
| `font-mono` | (nativa) | 400, 500 | Códigos, valores monetários "raw" se precisar |

**Escala:**
- `display-1` 32px / 1.2 / -0.02em — hero de página (raro)
- `h1` 24px / 1.2 / -0.02em — título de página/card hero
- `h2` 19px / 1.3 / -0.01em — título de seção/card
- `h3` 15px / 1.4 — subtítulo
- `body` 13.5px / 1.5 — padrão
- `small` 12px / 1.5 — labels, secundário
- `micro` 11px / 1.3 / 0.10em uppercase — pré-títulos, footers

### 3.6 Raios e sombras

| Token | Valor | Uso |
|---|---|---|
| `radius` | `0.75rem` (12px) | Botões, inputs |
| `radius-lg` | `1rem` (16px) | Cards |
| `radius-xl` | `1.375rem` (22px) | Glass cards / hero |
| `shadow-glow` | `0 24px 70px rgba(255,122,26,0.18)` (light) / `0.22` (dark) | Glass card |
| `shadow-button` | `0 6px 18px rgba(255,122,26,0.35)` | Botão primário |
| `shadow-card` | `0 1px 2px rgba(0,0,0,0.04), 0 10px 32px rgba(0,0,0,0.06)` (light) | Cards opacos |
| `shadow-card-dark` | `0 1px 0 rgba(255,255,255,0.04) inset` | Cards opacos no dark |

### 3.7 Texturas decorativas

**Grid de fundo (light):**
```css
background-image:
  linear-gradient(rgba(70,50,20,0.06) 1px, transparent 1px),
  linear-gradient(90deg, rgba(70,50,20,0.06) 1px, transparent 1px);
background-size: 32px 32px;
mask-image: radial-gradient(circle at center, #000 30%, transparent 80%);
```

**Grid de fundo (dark):** mesma estrutura, opacidade `rgba(255,255,255,0.05)`.

**Glow laranja (ambos os modos):**
```css
background:
  radial-gradient(circle at 22% 28%, rgba(255,122,26,0.20), transparent 55%),
  radial-gradient(circle at 78% 82%, rgba(255,122,26,0.12), transparent 55%),
  var(--background);
```

> Aplicar apenas em telas hero (login, "vazio", erro). NÃO usar como fundo de páginas internas — gera ruído visual.

## 4. Componentes-base afetados

Esta spec cobre tokens. Os componentes shadcn que mudam de aparência sem mudar API:

| Componente | Mudança |
|---|---|
| `Button` (primary) | Gradiente laranja + sombra colorida; sem mudança em API |
| `Button` (secondary/ghost/outline) | Bordas creme/whitealpha, hover laranja muito sutil |
| `Input` | Borda creme (light) / whitealpha (dark); focus laranja com ring de 3px de glow |
| `Card` | Default opaco; nova variante `card-glass` pra hero |
| `Badge` | Variante `badge-primary` usa `accent-soft` (laranja translúcido) + texto laranja-escuro |
| `Link` | Cor `primary-press` no light, `primary-soft-dark` no dark |

> **Não trocar API de componente.** Toda mudança vive em `globals.css` (vars HSL) + `tailwind.config.ts` (eventual novo token).

## 5. Login redesenhado (entrega 1)

### 5.1 Estrutura

```
LoginPage (full-screen container)
 ├── Background layer
 │    ├── solid base (#f5efe4 light / #0a0a0c dark)
 │    ├── radial glow laranja (2 fontes, 22%/28% e 78%/82%)
 │    └── grid 32×32 com mask radial central
 ├── Top bar (absolute)
 │    ├── left: "PT-BR" (preparação i18n — pode virar dropdown futuramente)
 │    └── right: Toggle light/dark (pill)
 ├── Glass card (centralizado, max-w-380)
 │    ├── Brand mark (icon "C" + "CliniFunnel" com "Funnel" laranja)
 │    ├── Pre-title: "PAINEL DE GESTÃO" (uppercase 11px laranja)
 │    ├── Heading: "Acessar sua clínica" (24px display)
 │    ├── Subtitle: "Entre com email e senha pra continuar"
 │    ├── Input: Email (label + input, sem ícone interno)
 │    ├── Input: Senha (label + input type=password)
 │    ├── Link: "Esqueci minha senha →" (alinhado à direita)
 │    └── Button: "Entrar" (primary, gradiente)
 └── Footer (absolute bottom)
      └── Link: "CliniFunnel v{APP_VERSION} · novidades" → /changelog
```

### 5.2 Comportamento

| Estado | Comportamento |
|---|---|
| Carregamento (submit) | Botão exibe "Entrando…" e fica disabled (igual hoje) |
| Erro | Mensagem em `text-destructive` aparece acima do botão (igual hoje, só muda a cor pra usar token) |
| Toggle light/dark | Persiste em `localStorage` chave `theme-mode` (`light` \| `dark` \| `system`) |
| Link "Esqueci minha senha" | **Decisão:** ativar o link no PR1 apontando pra `/forgot-password`, e criar nessa mesma PR a página placeholder que mostra "Em breve — fale com o admin da clínica" (evita 404). Backend de reset por email fica fora desta spec (vira PR próprio quando priorizado). |
| "PT-BR" no canto | Estático nesta primeira entrega. Vira dropdown só quando i18n for de fato implementado (não nesta spec). |

### 5.3 Acessibilidade

- Inputs com `<label>` associado por `htmlFor` (mantém o atual).
- Focus visível: ring laranja de 3px (`0 0 0 3px rgba(255,122,26,0.18)`).
- Contraste verificado: texto principal `#2a2418` sobre `#fffdf8` = 14.8:1 (AAA). Texto principal branco sobre `#15151a` = 17:1 (AAA).
- `prefers-reduced-motion`: desabilitar hover transforms/transitions.

## 6. Plano de rollout (PRs subsequentes)

Cada item abaixo vira um PR separado, todos saindo do mesmo worktree `feat/visual-redesign` mas potencialmente quebrados em commits/PRs menores:

1. **PR 1 — Tokens + Login** (esta spec)
   - Atualizar `globals.css`: vars HSL light + dark, **incluindo redirecionar `--gold` pros mesmos valores de `--primary`** pra absorver os 39 usos legados sem regressão.
   - Atualizar `tailwind.config.ts`: adicionar `shadow-glow`, `shadow-button`, `radius-xl` se precisarem como tokens.
   - Refazer `src/app/login/page.tsx` no novo layout (glass + grid + glow).
   - Toggle de modo + persistência em `localStorage` (`theme-mode`).
   - Criar `/forgot-password` placeholder.
   - Bump versão (minor: 0.38.0 → 0.39.0) + entrada no `CHANGELOG`.

2. **PR 2 — Sidebar + Header**
   - Reaplicar tokens na sidebar/dashboard layout
   - Mark "Clini**Funnel**" + ícone "C" no header

3. **PR 3 — Dashboard Overview (KPIs + cards)**
   - Aplicar `card-glass` em cards hero, `card` em listas
   - KPIs com tipografia Manrope display

4. **PR 4 — Leads / Pacientes / demais telas**
   - Aplicação dos tokens, sem mudança de layout estrutural

5. **PR 5 — Polimento**
   - Estados vazios, erros, formulários genéricos
   - Verificação visual em todas as rotas

Cada PR roda lint+tsc+test+build localmente antes de subir; cada PR bumpa versão em `package.json` + `src/lib/version.ts` (minor pro PR1, patch ou minor depois conforme escopo).

## 7. O que NÃO está nesta spec (out of scope)

- i18n real (PT-BR/EN switching). Só preparamos o slot visual.
- Forgot password backend (fluxo de reset por email).
- Mudança da identidade fora do produto (favicon, OG image, landing).
- Mobile-first refinamento detalhado (o login funciona em mobile, mas a polidez mobile vira PR à parte).
- Animações além de `transition: 0.15s` em hovers básicos.

## 8. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Conflito com PRs paralelos de fix dos gaps | Gaps mexem em `lib/`, `workers/`, `prisma/`. Visual mexe em `globals.css`, `tailwind.config.ts`, `app/`, `components/`. Zero sobreposição esperada. Antes de cada merge, `git fetch origin main` e checar arquivos tocados. |
| Token `gold` legado quebrar visual de telas existentes | Grep no `src/` mostrou **39 usos** de `bg-gold`/`text-gold`/`--gold` em 13 arquivos (dashboard, leads, patients, financeiro, ltv, campaigns, settings, changelog, sidebar, header, date-filter). **Decisão:** no PR1, redirecionar a variável CSS `--gold` pros mesmos valores HSL de `--primary` (ambos os modos). Isso faz todas as 39 ocorrências migrarem automaticamente sem mexer no código de feature. O token `gold` continua existindo no tailwind config mas vira sinônimo visual do `primary`. Em PR2/3 (sidebar, dashboard) trocamos `bg-gold` → `bg-primary` nos lugares afetados pra consolidar. |
| Glow + grid pesar em mobile / hardware antigo | Aplicar somente em `LoginPage` por enquanto. Se reclamarem, virar `prefers-reduced-motion` ou simplificar. |
| Tom papel quente "verde-amarelar" demais em alguns monitores | Testado: tons HSL 38–40 em saturação 35–80% ficam estáveis. Manter `#f5efe4` como referência; ajustar só se Bruno reportar problema visual no monitor dele. |

## 9. Critérios de aceite (PR1)

- [ ] `globals.css` atualizado com novos tokens light + dark
- [ ] `tailwind.config.ts` exporta `shadow-glow`, `shadow-button`, `radius-xl` (se necessário)
- [ ] `/login` renderiza no novo layout em light e dark
- [ ] Toggle light/dark funciona e persiste em localStorage
- [ ] `lint`, `tsc --noEmit`, `test`, `build` passam localmente
- [ ] Lighthouse: contraste ≥ AA em todos os textos
- [ ] Visual revisado por Bruno no navegador local antes de mergear
- [ ] `CHANGELOG` em `src/lib/version.ts` registra "visual: redesign do login + nova paleta laranja (v0.39.0)"
- [ ] Item correspondente em `docs/IMPROVEMENTS.md` movido pra "Concluídos"
