# Design System Document: The Clinical Obsidian Methodology

## 1. Overview & Creative North Star
**Creative North Star: "The Obsidian Atelier"**

This design system is built to transform clinical data from a utility into an editorial experience. Inspired by the precision of high-end medical instruments and the minimalist luxury of modern architectural workspaces, it moves away from the "cluttered dashboard" trope. We prioritize **intentional negative space**, **tonal depth**, and **asymmetric balance** to create an environment that feels calm, authoritative, and ultra-premium.

The goal is not to show information, but to *curate* it. By utilizing layered glassmorphism and generous padding (24px+), we ensure that even the most complex aesthetic analytics feel breathable and easy to navigate.

---

## 2. Colors & Surface Architecture

The palette is rooted in a deep, nocturnal base that allows our accent gold and functional greens/reds to vibrate with clarity without causing eye strain.

### Core Palette (Material Mapping)
*   **Background (`#0A0A0F`):** The foundation. A deep, void-like charcoal that provides the ultimate contrast for gold accents.
*   **Surface / Surface-Dim (`#131318`):** Use for the lowest level of the layout.
*   **Primary (`#f2c36b` / `#D4A853`):** Reserved exclusively for high-intent actions and critical "Golden Metrics."
*   **Secondary (`#c4c4e2` / `#8B8BA7`):** Muted lavender for metadata, secondary labels, and non-interactive icons.
*   **Tertiary/Emerald (`#10B981`):** Growth indicators and successful clinical outcomes.
*   **Error/Rose (`#F43F5E`):** Critical alerts or inventory shortages.

### The "No-Line" Rule
**Prohibition:** Do not use 1px solid borders to define section boundaries. 
**Execution:** Boundaries must be defined by background shifts. A `surface-container-low` card sitting on a `surface` background is sufficient. If a container needs further definition, use the **Inner Glow** (1px white at 5% opacity) to catch "top-down light" rather than a traditional stroke.

### Surface Hierarchy & Nesting
Treat the UI as physical layers of obsidian and frosted glass:
1.  **Level 0 (Base):** `surface` (`#131318`)
2.  **Level 1 (Navigation/Sidebar):** `surface-container-low` (`#1b1b20`)
3.  **Level 2 (Main Dashboard Cards):** `surface-container` (`#1f1f25`) + 8% white overlay.
4.  **Level 3 (Modals/Popovers):** `surface-container-highest` (`#35343a`) + Glassmorphism (Backdrop-blur: 12px).

---

## 3. Typography: Editorial Authority

We use a high-contrast pairing to distinguish between "System" and "Brand."

*   **Display & Headlines (Manrope/DM Sans):** Bold (700 weight). Used for high-level clinic performance and patient names. The tight tracking and heavy weight convey confidence.
*   **UI & Body (Inter):** Used for all functional elements, data points, and labels. It provides the neutral, Swiss-style clarity required for medical data.

**The Typographic Hierarchy:**
*   **Display-LG (3.5rem):** Used for "Hero Numbers" (e.g., Total Revenue).
*   **Headline-SM (1.5rem):** Used for section titles (e.g., "Daily Patient Flow").
*   **Label-MD (0.75rem):** Used for secondary descriptors in `on_secondary` lavender.

---

## 4. Elevation & Depth: Tonal Layering

Shadows in this system do not represent "black ink" under a card; they represent **Ambient Occlusion.**

*   **The Layering Principle:** Stacking is the primary method of hierarchy. A "Highest" container should only sit on a "Low" or "Lowest" container. Never place two identical surface levels adjacent to one another.
*   **Ambient Shadows:** For floating elements (Modals/Dropdowns), use a 32px or 64px blur radius at 6% opacity. The color should be `#000000` but softened by the backdrop-blur.
*   **The "Ghost Border":** For interactive elements like input fields, use the `outline_variant` at 15% opacity. It should be felt more than seen.
*   **Signature Texture:** Apply a 2% opacity "noise" texture to the `surface` background to break the digital flatness and provide a tactile, paper-like quality.

---

## 5. Components

### Buttons
*   **Primary:** Solid `primary_container` (#D4A853). Text in `on_primary` (#412D00). No border. 12px (`DEFAULT`) radius.
*   **Secondary:** Ghost style. No background. `outline_variant` (15% opacity) border. Text in `primary`.
*   **Tertiary:** Text only in `secondary` lavender.

### Cards & Lists
*   **No Dividers:** Never use horizontal lines to separate list items. Use 16px of vertical whitespace or a subtle background hover state (`surface_bright` at 4% opacity).
*   **Inner Glow:** All cards must feature a 1px top-inner-border: `rgba(255, 255, 255, 0.05)`.

### Input Fields
*   **State:** Default state uses `surface_container_highest`.
*   **Focus:** Transition the "Ghost Border" from 15% to 40% opacity and apply a subtle glow using the `primary` color (4px blur).

### Clinical Status Chips
*   **Positive:** Tertiary background (10% opacity) with solid tertiary text.
*   **Alert:** Error background (10% opacity) with solid error text.
*   **Shape:** Pill-shaped (`full` roundedness) to contrast with the 12px dashboard cards.

---

## 6. Do’s and Don’ts

### Do:
*   **Do** use asymmetrical layouts for the header. Place the most important metric (The North Star metric) significantly larger and slightly offset from the secondary grid.
*   **Do** allow for at least 32px of padding between major functional modules.
*   **Do** use glassmorphism for sidebars to allow the "Obsidian" background texture to peak through.

### Don’t:
*   **Don't** use pure white (#FFFFFF) for text. Use `on_surface` (#E4E1E9) to maintain the sophisticated dark-mode atmosphere.
*   **Don't** use sharp corners. Every element (except for perhaps some data-viz lines) must adhere to the 12px or higher roundedness scale.
*   **Don't** use standard "Drop Shadows." If it looks like a default shadow, the opacity is too high or the blur is too low.