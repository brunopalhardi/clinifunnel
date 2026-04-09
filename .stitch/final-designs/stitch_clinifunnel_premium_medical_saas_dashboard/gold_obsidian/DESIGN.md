# Precision Noir: A Design System for Clinical Intelligence

## 1. Overview & Creative North Star
The design system is built upon the "Clinical Architect" North Star. In the high-stakes world of clinical analytics, data must not only be legible—it must feel authoritative, deliberate, and expensive. We are moving away from the "SaaS-standard" dashboard of white cards and blue shadows. 

Instead, this system adopts a **Precision Noir** aesthetic. It leverages intentional asymmetry, deep tonal layering, and high-contrast typography to create a workspace that feels more like a high-end editorial piece or a luxury cockpit than a database. By treating the UI as a series of physical, light-emitting surfaces rather than flat boxes, we instill a sense of focus and surgical precision.

## 2. Colors & Surface Philosophy
The palette is rooted in a near-black foundation, accented by a sophisticated gold that serves as a beacon for critical insights.

### Tonal Architecture
*   **Primary (`#f2c36b` / `#d4a853`):** Reserved for high-value actions and critical data pathing. Use the `primary_container` for large focal points and `primary` for refined text-level emphasis.
*   **Neutral Foundation:** We use `surface` (`#131318`) as our canvas. Depth is not added via shadows, but through the `surface_container` hierarchy.

### The "No-Line" Rule
Explicitly prohibit the use of 1px solid borders for sectioning. Boundaries must be defined through background color shifts. To separate a sidebar from a main view, place a `surface_container_low` section against the standard `surface` background. This creates a "molded" look that feels integrated into the hardware.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack. 
*   **Lowest Level:** `surface_container_lowest` for background utility areas.
*   **Mid Level:** `surface` for the main workspace.
*   **High Level:** `surface_container_high` for interactive elements or focused data modules.
Each inner container should use a slightly higher or lower tier than its parent to define importance without visual clutter.

### The Glass & Gradient Rule
To achieve the "Precision Noir" feel, floating elements (modals, dropdowns, hovered states) should utilize **Glassmorphism**. Use semi-transparent surface colors with a `backdrop-blur` (12px–20px). Main CTAs should not be flat; apply a subtle linear gradient from `primary` to `primary_container` to give the buttons a tactile, metallic soul.

## 3. Typography
We use a dual-typeface system to balance technical precision with modern elegance.

*   **Headlines (Manrope):** Used for all `display` and `headline` levels. Manrope’s geometric yet warm construction provides an "Editorial Tech" feel. Use `headline-lg` for dashboard titles to command attention.
*   **UI & Data (Inter):** Used for `title`, `body`, and `label` levels. Inter’s high x-height and readability make it the workhorse for dense clinical data.
*   **The Hierarchy Lens:** Use `label-sm` in `on_surface_variant` for metadata. The high contrast between a `display-md` (Manrope) and a `label-md` (Inter) creates the "signature" look of this design system—making data feel like an architectural blueprint.

## 4. Elevation & Depth
Depth is an atmospheric property, not a structural one.

*   **The Layering Principle:** Stack `surface_container_lowest` cards on `surface_container_low` sections to create a natural "lift." This tonal layering replaces the need for heavy shadows.
*   **Ambient Shadows:** When an element must "float" (e.g., a critical alert or a context menu), use an extra-diffused shadow.
    *   **Blur:** 24px–40px.
    *   **Opacity:** 4%–8%.
    *   **Color:** Tint the shadow with `on_surface` rather than pure black to simulate natural ambient light.
*   **The Ghost Border Fallback:** If accessibility requires a container boundary, use a **Ghost Border**. Apply the `outline_variant` token at 15% opacity. Never use 100% opaque, high-contrast borders.

## 5. Components

### Buttons
*   **Primary:** Gradient of `primary` to `primary_container`. 12px (`md`) corner radius. Text is `on_primary`.
*   **Secondary:** `surface_container_high` background with a `primary` text color. No border.
*   **Tertiary:** Ghost style. No background; `on_surface` text. Use `primary` for the hover state.

### Input Fields
*   **Styling:** Use `surface_container_highest` for the input track. 
*   **States:** On focus, transition the background to `surface_bright` and add a 1px "Ghost Border" using `primary`.
*   **Labels:** Use `label-md` in `on_surface_variant` positioned strictly above the field—never inside as a placeholder.

### Cards & Data Modules
*   **Forbid Dividers:** Never use a line to separate card headers from content. Use a 24px vertical gap or a subtle background shift (e.g., header in `surface_container_high`, body in `surface_container`).
*   **Rounding:** All cards must strictly adhere to the `md` (12px) rounding scale to maintain the "Precision Noir" geometry.

### Clinical Analytics Specifics
*   **Data Density:** Use `body-sm` for table data to maximize information density. Use the `tertiary` (`afcbff`) color for secondary data streams to provide visual relief from the gold.
*   **Insight Chips:** Use `secondary_container` with `on_secondary_container` text for non-critical status updates. They should have a `full` (9999px) roundness to contrast against the rigid 12px dashboard grid.

## 6. Do’s and Don’ts

### Do
*   **Do** use extreme whitespace (32px+) between major data modules to let the "Noir" aesthetic breathe.
*   **Do** use `surface_tint` at low opacities (3-5%) as an overlay for interactive hover states.
*   **Do** prioritize the typographic scale; let the difference between Manrope and Inter tell the story.

### Don’t
*   **Don’t** use pure white (`#FFFFFF`) for text. Always use `on_surface` or `on_surface_variant` to prevent eye strain in dark mode.
*   **Don’t** use standard "drop shadows." If it doesn't look like a soft glow or a natural elevation shift, it is too heavy.
*   **Don’t** use a grid of boxes. Overlap elements slightly or use asymmetrical column widths (e.g., a 65/35 split) to break the "template" feel.