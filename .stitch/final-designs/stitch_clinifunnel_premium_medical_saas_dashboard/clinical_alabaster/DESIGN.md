# Design System Strategy: The Clinical Curator

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Clinical Curator."** 

We are moving away from the cluttered, "dashboard-heavy" look of traditional medical software. Instead, we are designing a high-end editorial experience that feels like a Swiss private clinic—sterile yet warm, authoritative yet inviting. This system rejects the rigid, boxy constraints of standard bootstrap layouts in favor of **Intentional Asymmetry** and **Tonal Breathability.** 

By utilizing oversized typography scales and overlapping surface layers, we create a sense of bespoke craftsmanship. The interface shouldn't just feel like a tool; it should feel like a premium service.

---

## 2. Colors & The Tonal Architecture
The palette is built on a foundation of "Medical White" and "Deep Slate," punctuated by "Surgical Gold."

*   **Primary (#785600):** This is our surgical strike. Use it sparingly for primary actions and critical highlights. It represents value, precision, and human warmth.
*   **Surface & Background (#f8f9fa / #ffffff):** These define the environment. They should feel airy and expansive.
*   **On-Surface (#191c1d):** Our "Deep Slate." This is used for maximum legibility in body text and primary headers.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to section off content. In this design system, boundaries are defined strictly through background color shifts. To separate a sidebar from a main feed, transition from `surface` (#f8f9fa) to `surface-container-low` (#f3f4f5). Lines create visual "noise"; tonal shifts create "atmosphere."

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers—stacked sheets of fine, heavy-stock paper. 
- **Base:** `surface` (#f8f9fa).
- **Secondary Content:** `surface-container-low` (#f3f4f5).
- **Interactive Cards:** `surface-container-lowest` (#ffffff).
By nesting a `#ffffff` card on a `#f3f4f5` section, you create a "natural lift" that feels more premium than a drop shadow.

### The "Glass & Gradient" Rule
For floating elements (modals, dropdowns, navigation bars), use **Glassmorphism**. Apply the `surface` color at 80% opacity with a `24px` backdrop blur. To add "soul" to hero sections, use a subtle radial gradient transitioning from `primary` (#785600) to `primary-container` (#986d00) at a 15-degree angle.

---

## 3. Typography: The Editorial Voice
We use **Manrope** for its geometric precision and modern readability. The goal is a high-contrast hierarchy that feels like a medical journal or a luxury magazine.

*   **Display Scales (lg, md, sm):** Use these for hero statements and key metrics. They should be "monolithic"—heavy, bold, and given massive amounts of negative space.
*   **Headline & Title Scales:** Used for section headers. Ensure `headline-lg` (2rem) has significant tracking-tight (-0.02em) to feel authoritative.
*   **Body & Label Scales:** These are the workhorses. `body-lg` (1rem) is the default for clinical notes. Use `label-md` for metadata, always in All-Caps with +0.05em letter spacing to maintain a "clinical tag" aesthetic.

---

## 4. Elevation & Depth
Depth is achieved through **Tonal Layering** rather than traditional structural shadows.

*   **The Layering Principle:** Avoid elevation levels 1-5. Instead, use the `surface-container` tiers. A "raised" state is simply a move from `surface-container-high` to `surface-container-highest`.
*   **Ambient Shadows:** If an element must float (e.g., a critical diagnostic modal), use a shadow with a blur radius of `40px` and an opacity of `4%`. The shadow color should be a tinted version of our Slate (`on-surface`), never pure black.
*   **The "Ghost Border" Fallback:** If a border is required for accessibility, use the `outline-variant` token at **15% opacity**. A 100% opaque border is considered a failure of the design system.
*   **Glassmorphism Depth:** When using glass containers, the background behind it should be slightly out of focus. This "Depth of Field" effect mimics high-end photography, reinforcing the premium feel.

---

## 5. Components

### Buttons
*   **Primary:** Solid `primary` (#785600) with `on-primary` (#ffffff) text. Use the `md` (0.75rem) roundedness. No shadows.
*   **Secondary:** `surface-container-high` background with `primary` text. This creates a sophisticated, tonal look.
*   **Tertiary:** Ghost style. No container, just `primary` text with an icon.

### Input Fields
*   **Structure:** No 4-sided boxes. Use a "Bottom-Line Only" approach or a very soft `surface-container-low` filled background with a `0.5rem` bottom-radius. 
*   **Focus State:** The bottom line transitions to `primary` (Gold) with a `2px` thickness.

### Cards & Lists
*   **Rule:** **Forbid dividers.** Use `24px` or `32px` of vertical white space to separate list items. 
*   **Cards:** Use `surface-container-lowest` (#ffffff) on a `surface` (#f8f9fa) background. Rounding should be `lg` (1rem) to feel soft and approachable.

### Specialized Clinical Components
*   **The "Metric Block":** A large `display-md` number in `on-surface`, with a small `label-sm` unit of measurement in `primary` (Gold) positioned as a superscript. 
*   **Status Chips:** Use `secondary-container` for neutral states and `error-container` for critical alerts. Keep the text high-contrast using `on-secondary-container`.

---

## 6. Do's and Don'ts

### Do:
*   **Use Asymmetry:** Place a large headline on the left with a small, focused action on the right, leaving the center wide open.
*   **Embrace "Empty" Space:** High-end design is defined by what you *don't* put on the screen.
*   **Layer Surfaces:** Use at least three tiers of `surface-container` in complex views to create a sense of architectural depth.

### Don't:
*   **Don't Use Dividers:** If you feel the need to draw a line, increase the padding instead.
*   **Don't Use Pure Black:** Even for text, stay within the `on-surface` (#191c1d) Deep Slate range.
*   **Don't Default to Center Alignment:** Editorial design thrives on strong left-aligned axes and intentional offsets.
*   **Don't Overuse Gold:** The gold is a reward for the user's eye. If everything is gold, nothing is premium.