# Design System: The Obsidian Atelier

## 1. Overview & Creative North Star
**The Creative North Star: "Precision Noir"**
This design system moves beyond the standard SaaS "dashboard" aesthetic to create a digital environment that feels like a high-end, private clinical atelier. It is defined by the tension between clinical precision and obsidian-toned luxury. 

We break the "template" look by rejecting rigid, boxy layouts in favor of **intentional asymmetry** and **tonal depth**. The UI should feel like a series of meticulously carved obsidian surfaces illuminated by a single, focused light source. We utilize extreme typographic contrast and layered transparency to guide the user’s eye, ensuring the experience feels curated rather than engineered.

---

## 2. Colors & Surface Philosophy
The palette is rooted in deep, light-absorbing blacks and charcoals, punctuated by a surgical "Gold" accent that denotes high-value actions and clinical excellence.

### Color Tokens (Material Design Mapping)
*   **Background:** `#131318` (The canvas)
*   **Primary (Gold):** `#f2c36b` (Brand/CTA)
*   **Primary Container:** `#d4a853` (Muted Brand)
*   **Secondary (Success Green):** `#4edea3` (Clinical Status)
*   **Surface:** `#131318` (Base Layer)
*   **Surface Container (Lowest to Highest):** `#0e0e13` → `#35343a` (Depth Tiers)

### The "No-Line" Rule
**Prohibit 1px solid borders for sectioning.** 
Structural separation must be achieved through background shifts. To separate a sidebar from a main content area, use `surface-container-low` against `background`. High-contrast lines are considered "visual noise" and cheapen the premium feel.

### Surface Hierarchy & Nesting
Treat the UI as physical layers of "Obsidian Glass." 
1.  **Level 0 (Background):** The deepest layer (`surface-container-lowest`).
2.  **Level 1 (Main Worksheets):** `surface` or `surface-container-low`.
3.  **Level 2 (Active Cards):** `surface-container-high`.
Each inner container should feel "carved out" or "placed upon" rather than boxed in.

### The Glass & Gradient Rule
Floating elements (Modals, Popovers, Hover Cards) must utilize **Glassmorphism**.
*   **Effect:** Apply `surface-container-highest` at 60% opacity with a `24px` backdrop blur.
*   **Soul Gradients:** Main CTAs should never be flat. Use a subtle linear gradient from `primary` to `primary-container` at a 135° angle to give buttons a metallic, "lit-from-within" glow.

---

## 3. Typography: The Editorial Voice
We use **Inter** not as a system font, but as a precise instrument. The hierarchy relies on dramatic scale shifts to create an authoritative, clinical tone.

*   **Display (Display-LG/MD):** Used for high-level data summaries. Letter spacing set to `-0.02em` for a compact, "engraved" look.
*   **Headlines (Headline-SM/MD):** The editorial voice. Use these to frame the user's journey. 
*   **Titles (Title-LG):** Reserved for card headers and section starts.
*   **Labels (Label-MD/SM):** All-caps with `0.05em` letter spacing when used for metadata, creating a "technical blueprint" aesthetic.

**Hierarchy Strategy:** Pair a `Display-SM` gold metric with a `Label-SM` muted text to create a high-contrast information "anchor."

---

## 4. Elevation & Depth
In "The Obsidian Atelier," shadows are light, not dark.

*   **The Layering Principle:** Avoid structural lines. Place a `surface-container-highest` card inside a `surface-container-low` wrapper to create a soft "lift."
*   **Ambient Shadows:** For floating glass panels, use a diffused shadow: `0 20px 40px rgba(0, 0, 0, 0.4)`. The shadow color must be a tinted version of the background to ensure it looks like an occlusion of light, not a "fuzzy grey border."
*   **The "Ghost Border" Fallback:** If a boundary is required for accessibility, use the `outline-variant` at **10% opacity**. It should be barely perceptible—a whisper of an edge.
*   **Glassmorphism Depth:** When nesting glass elements, increase the backdrop blur for each successive layer (e.g., Layer 1: 8px blur, Layer 2: 24px blur).

---

## 5. Components

### Buttons
*   **Primary:** Gradient (`primary` to `primary-container`), black text (`on-primary`), `8px` (DEFAULT) roundness. No border.
*   **Secondary:** `surface-container-highest` background with a "Ghost Border." 
*   **Tertiary:** Transparent background, `primary` colored text, no border.

### Input Fields
*   **Styling:** Use `surface-container-lowest` as the fill. 
*   **Interaction:** On focus, the "Ghost Border" transitions from 10% to 40% opacity of the `primary` (Gold) token. Avoid thick focus rings; use a subtle outer "glow" (diffused shadow).

### Chips & Badges
*   **Clinical Status:** Use `secondary-container` for success states with `on-secondary-container` text. Keep corners at `md` (0.75rem) to maintain the "pill" look without being fully circular.

### Cards & Lists
*   **No Dividers:** Lists are separated by vertical rhythm and whitespace. For hover states, shift the background to `surface-container-high`.
*   **Asymmetry:** In cards, right-align primary actions and left-align metadata to create an "editorial" flow that breaks the standard centered grid.

### Tooltips
*   **Styling:** Deep `surface-container-highest` with a 15% `outline` border. Use `label-sm` for the text.

---

## 6. Do’s and Don’ts

### Do:
*   **Do** use whitespace as a functional tool. If a section feels crowded, increase the padding rather than adding a border.
*   **Do** use the "Gold" primary color sparingly. It is a beacon of clinical precision; overusing it devalues the brand.
*   **Do** lean into the "Obsidian" feel by using `surface-container-lowest` for the background of the main content area to make data "pop."

### Don't:
*   **Don't** use 100% white (#FFFFFF). Use `on-surface` (`#e4e1e9`) for high-readability text to avoid "light-bleed" on dark backgrounds.
*   **Don't** use standard 1px grey dividers (#333). If you must separate, use a `2px` height gap of the `background` color.
*   **Don't** use sharp 0px corners. Every element should feel machined and polished (8px–12px).