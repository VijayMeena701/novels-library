# Books Library — Semantic Design Token System

> **Version:** 1.0 — Foundation Specification  
> **Scope:** Redesign the underlying design system so every component derives colors from semantic tokens. Layouts, component hierarchy, routing, UX, and the five existing reader themes are preserved.  
> **Themes:** Paper, Sepia, Forest, Night, AMOLED.

---

## 1. Design Philosophy

- **Every component works in every theme.** No theme-specific logic in components.
- **No hardcoded colors.** All colors come from tokens.
- **Semantic derivation.** Components use tokens that describe their role, not their appearance.
- **Same app, different atmosphere.** Themes only change palette, never UI language.
- **Always maintain contrast.** Foreground/background pairs must satisfy WCAG AA (AAA where practical).
- **Premium, calm, book-focused.** Reduced saturation, layered surfaces, soft elevation, accessible typography.
- **Scalable.** Future themes only need a new token map; components stay untouched.

---

## 2. Token Naming Convention

Tokens use a dot-delimited namespace:

```
{category}.{group}.{property}.{state?}
```

Examples:

- `color.background.app`
- `surface.raised`
- `text.primary`
- `button.primary.background.hover`

CSS variable mapping uses kebab-case:

```
--color-background-app
--surface-raised
--text-primary
--button-primary-background-hover
```

Tailwind classes reference the CSS variables via `theme.extend.colors`.

---

## 3. Color — Background Tokens

| Token                         | CSS Variable                    | Usage                                |
| ----------------------------- | ------------------------------- | ------------------------------------ |
| `color.background.app`        | `--color-background-app`        | Application root / page chrome       |
| `color.background.reader`     | `--color-background-reader`     | Reader content area                  |
| `color.background.canvas`     | `--color-background-canvas`     | Lowest-layer surface behind cards    |
| `color.background.sidebar`    | `--color-background-sidebar`    | Persistent side navigation panels    |
| `color.background.navigation` | `--color-background-navigation` | Top/bottom navigation bars           |
| `color.background.modal`      | `--color-background-modal`      | Modal/sheet/dialog surface           |
| `color.background.popover`    | `--color-background-popover`    | Popover/dropdown/menu surface        |
| `color.background.tooltip`    | `--color-background-tooltip`    | Tooltip surface                      |
| `color.background.sheet`      | `--color-background-sheet`      | Bottom sheet/drawer surface          |
| `color.background.overlay`    | `--color-background-overlay`    | Full-screen overlay/backdrop (RGB/A) |
| `color.background.dropdown`   | `--color-background-dropdown`   | Select/dropdown list                 |
| `color.background.selection`  | `--color-background-selection`  | Text selection highlight             |
| `color.background.scrim`      | `--color-background-scrim`      | Backdrop behind modals/drawers       |

---

## 4. Color — Surface Tokens

Surfaces are layered containers. Higher elevation steps are progressively lighter or more separated depending on theme.

| Token              | Usage                                               |
| ------------------ | --------------------------------------------------- |
| `surface.base`     | Default container background (cards, panels)        |
| `surface.raised`   | Slightly lifted cards, hovered list rows            |
| `surface.elevated` | Popovers, menus, dropdowns, sheets                  |
| `surface.floating` | Floating toolbars, FABs, player bars                |
| `surface.sunken`   | Inputs, code blocks, inset wells                    |
| `surface.hover`    | Hover state for any surface                         |
| `surface.active`   | Pressed/active surface                              |
| `surface.pressed`  | Momentary press/ripple target                       |
| `surface.disabled` | Disabled container background                       |
| `surface.inverse`  | Inverted surfaces (toast, snackbar, badges on dark) |

---

## 5. Color — Card Tokens

| Token           | Usage                                               |
| --------------- | --------------------------------------------------- |
| `card.default`  | Standard card background                            |
| `card.hover`    | Card background on hover                            |
| `card.selected` | Selected/activated card                             |
| `card.active`   | Pressed card                                        |
| `card.disabled` | Disabled card                                       |
| `card.border`   | Card outline border                                 |
| `card.shadow`   | Card shadow color (used in `box-shadow` with alpha) |
| `card.overlay`  | Gradient/image overlay on cards                     |

---

## 6. Typography System

### Type Roles

| Role      | Token Prefix       | Usage                          |
| --------- | ------------------ | ------------------------------ |
| Display   | `type.display.*`   | Hero/book title large          |
| Heading   | `type.heading.*`   | Page headings, section headers |
| Title     | `type.title.*`     | Card/book titles               |
| Subtitle  | `type.subtitle.*`  | Subheadings, taglines          |
| Body      | `type.body.*`      | Primary reading text           |
| Caption   | `type.caption.*`   | Timestamps, helper text        |
| Metadata  | `type.metadata.*`  | Author, chapter count, labels  |
| Overline  | `type.overline.*`  | Uppercase labels above content |
| Button    | `type.button.*`    | Button label text              |
| Label     | `type.label.*`     | Form labels, input prefixes    |
| Monospace | `type.monospace.*` | Code, technical values         |
| Reading   | `type.reading.*`   | Long-form book content         |

### Token Properties

| Property         | Example                    | Notes             |
| ---------------- | -------------------------- | ----------------- |
| `font`           | `type.body.font`           | Font family stack |
| `weight`         | `type.body.weight`         | Numeric weight    |
| `line-height`    | `type.body.line-height`    | Unitless ratio    |
| `letter-spacing` | `type.body.letter-spacing` | em value          |
| `size`           | `type.body.size`           | rem value         |

### Recommended Defaults

```yaml
Display:
  font: var(--font-serif)
  weight: 600
  line-height: 1.1
  letter-spacing: -0.02em
  size: 2.5rem

Heading:
  font: var(--font-sans)
  weight: 700
  line-height: 1.15
  letter-spacing: -0.015em
  size: 1.75rem

Title:
  font: var(--font-sans)
  weight: 600
  line-height: 1.25
  letter-spacing: -0.01em
  size: 1.125rem

Subtitle:
  font: var(--font-sans)
  weight: 500
  line-height: 1.35
  letter-spacing: 0
  size: 0.9375rem

Body:
  font: var(--font-sans)
  weight: 400
  line-height: 1.55
  letter-spacing: 0
  size: 0.9375rem

Caption:
  font: var(--font-sans)
  weight: 400
  line-height: 1.4
  letter-spacing: 0.01em
  size: 0.8125rem

Metadata:
  font: var(--font-sans)
  weight: 500
  line-height: 1.4
  letter-spacing: 0.01em
  size: 0.8125rem

Overline:
  font: var(--font-sans)
  weight: 700
  line-height: 1.3
  letter-spacing: 0.08em
  size: 0.6875rem
  transform: uppercase

Button:
  font: var(--font-sans)
  weight: 600
  line-height: 1
  letter-spacing: 0.01em
  size: 0.875rem

Label:
  font: var(--font-sans)
  weight: 500
  line-height: 1.4
  letter-spacing: 0.005em
  size: 0.8125rem

Monospace:
  font: "SF Mono", ui-monospace, monospace
  weight: 400
  line-height: 1.5
  letter-spacing: 0
  size: 0.875rem

Reading:
  font: var(--font-serif)
  weight: 400
  line-height: 1.75
  letter-spacing: 0
  size: 1.125rem
  max-width: 42rem
```

**Maximum line length:** 70 characters for UI text, 72–76 characters for reader content.

---

## 7. Text Tokens

| Token              | Usage                                | Contrast target                   |
| ------------------ | ------------------------------------ | --------------------------------- |
| `text.primary`     | Headings, body, primary content      | 7:1 (AAA) on `surface.base`       |
| `text.secondary`   | Subtitles, descriptions, labels      | 4.5:1 (AA) minimum                |
| `text.muted`       | Timestamps, hints, disabled emphasis | 4.5:1 (AA) minimum                |
| `text.disabled`    | Disabled text                        | Never rely on color alone         |
| `text.inverse`     | Text on inverted surfaces            | 7:1 preferred                     |
| `text.accent`      | Accent/primary action text           | 4.5:1 minimum                     |
| `text.link`        | Hyperlinks                           | 4.5:1 + underline affordance      |
| `text.visited`     | Visited links                        | 4.5:1                             |
| `text.selection`   | Selected text                        | Uses `color.background.selection` |
| `text.success`     | Success messages                     | 4.5:1                             |
| `text.warning`     | Warning messages                     | 4.5:1                             |
| `text.danger`      | Error messages                       | 4.5:1                             |
| `text.info`        | Info messages                        | 4.5:1                             |
| `text.premium`     | VIP/premium labels                   | 4.5:1                             |
| `text.metadata`    | Author, year, tags                   | 4.5:1                             |
| `text.placeholder` | Input placeholder text               | 4.5:1 on `surface.sunken`         |

---

## 8. Border Tokens

| Token              | Usage                                          |
| ------------------ | ---------------------------------------------- |
| `border.default`   | Default component borders                      |
| `border.subtle`    | Very faint dividers                            |
| `border.strong`    | Emphasized borders, selected state             |
| `border.focus`     | Focus ring stroke (paired with `shadow.focus`) |
| `border.divider`   | Horizontal/vertical dividers                   |
| `border.input`     | Input borders                                  |
| `border.card`      | Card outlines                                  |
| `border.reader`    | Reader chrome borders                          |
| `border.modal`     | Modal/dialog outer border                      |
| `border.selection` | Selected item border                           |
| `border.hover`     | Border color on hover                          |

---

## 9. Button Tokens

For each button variant define:

```
button.{variant}.background
button.{variant}.background.hover
button.{variant}.background.pressed
button.{variant}.background.disabled
button.{variant}.foreground
button.{variant}.foreground.hover
button.{variant}.foreground.disabled
button.{variant}.border
button.{variant}.border.hover
button.{variant}.shadow
button.{variant}.focus.ring
button.{variant}.focus.border
```

Variants:

| Variant       | Usage                                      |
| ------------- | ------------------------------------------ |
| `primary`     | Main CTA                                   |
| `secondary`   | Secondary actions                          |
| `ghost`       | Low-emphasis actions                       |
| `outlined`    | Bordered actions                           |
| `destructive` | Delete, remove, dangerous actions          |
| `success`     | Confirm, save, completed actions           |
| `warning`     | Cautionary actions                         |
| `reader`      | Reader-specific actions (Listen, settings) |
| `floating`    | Floating action buttons                    |
| `toolbar`     | Toolbar icon/text buttons                  |

Button minimum contrast: **4.5:1** for normal text, **3:1** for large text.

---

## 10. Input Tokens

| Component  | Token Prefix |
| ---------- | ------------ |
| Text input | `input.*`    |
| Textarea   | `textarea.*` |
| Select     | `select.*`   |
| Checkbox   | `checkbox.*` |
| Radio      | `radio.*`    |
| Switch     | `switch.*`   |
| Slider     | `slider.*`   |
| Search     | `search.*`   |

Common states:

```
{component}.background
{component}.background.hover
{component}.background.focus
{component}.background.disabled
{component}.foreground
{component}.border
{component}.border.focus
{component}.placeholder
{component}.selection.background
{component}.selection.foreground
{component}.focus.ring
{component}.focus.ring.offset
```

Focus ring must be **2 px** minimum with a visible contrast difference.

---

## 11. Status Tokens

| Token               | Usage                     |
| ------------------- | ------------------------- |
| `status.success`    | Completed, saved, healthy |
| `status.warning`    | Caution, attention needed |
| `status.danger`     | Error, failed, critical   |
| `status.info`       | Neutral informational     |
| `status.premium`    | VIP / paid features       |
| `status.vip`        | VIP badge                 |
| `status.archived`   | Archived book             |
| `status.reading`    | Currently reading         |
| `status.completed`  | Finished book             |
| `status.dropped`    | Dropped book              |
| `status.paused`     | Paused reading            |
| `status.processing` | Job running               |
| `status.queued`     | Job queued                |
| `status.failed`     | Job failed                |

Each status has:

```
status.{name}.background
status.{name}.foreground
status.{name}.border
status.{name}.soft.background
status.{name}.soft.foreground
```

---

## 12. Progress Tokens

| Token                | Usage                             |
| -------------------- | --------------------------------- |
| `progress.track`     | Empty progress bar background     |
| `progress.fill`      | Filled progress bar               |
| `progress.glow`      | Highlight/glow on active progress |
| `progress.completed` | 100% completed state              |
| `progress.reader`    | Reader bottom progress            |
| `progress.audio`     | TTS / audio progress              |
| `progress.chapter`   | Chapter-level progress            |
| `progress.loading`   | Indeterminate loading track       |

---

## 13. Reader Tokens

| Token                           | Usage                        |
| ------------------------------- | ---------------------------- |
| `reader.background`             | Reader outer/page background |
| `reader.surface`                | Reader content paper surface |
| `reader.toolbar.background`     | Reader toolbar background    |
| `reader.toolbar.foreground`     | Reader toolbar icons/text    |
| `reader.controls.background`    | Control buttons background   |
| `reader.controls.foreground`    | Control buttons icon/text    |
| `reader.paragraph`              | Default paragraph text       |
| `reader.heading`                | Chapter headings in content  |
| `reader.highlight`              | User highlight background    |
| `reader.selection.background`   | Text selection in reader     |
| `reader.selection.foreground`   | Selected text color          |
| `reader.bookmark.background`    | Bookmark indicator           |
| `reader.annotation.background`  | Annotation surface           |
| `reader.search.highlight`       | Search match highlight       |
| `reader.sentence`               | Current TTS sentence         |
| `reader.word`                   | Current TTS word             |
| `reader.overlay`                | Reader modal/dimming overlay |
| `reader.popup.background`       | Popups inside reader         |
| `reader.translation.background` | Translation popup            |
| `reader.tts.background`         | TTS floating panel           |
| `reader.floating.background`    | Floating player bar          |

---

## 14. Overlay Tokens

| Token                | Usage                       |
| -------------------- | --------------------------- |
| `overlay.modal`      | Modal backdrop              |
| `overlay.backdrop`   | Generic scrim/backdrop      |
| `overlay.glass`      | Glass/frosted panels        |
| `overlay.popover`    | Popover backdrop (optional) |
| `overlay.tooltip`    | Tooltip surface             |
| `overlay.dropdown`   | Dropdown/menu surface       |
| `overlay.sheet`      | Bottom sheet backdrop       |
| `overlay.drawer`     | Side drawer backdrop        |
| `overlay.dialog`     | Dialog backdrop             |
| `overlay.hover-card` | Hover card surface          |

Glass surfaces use `backdrop-filter` with a token-driven background blur and an alpha-mixed surface color.

---

## 15. Shadow System

Elevation is defined as a scale with offset, blur, spread, opacity, and shadow color.

| Elevation | Offset Y | Blur | Spread | Opacity | Usage                      |
| --------- | -------- | ---- | ------ | ------- | -------------------------- |
| 0         | 0        | 0    | 0      | 0       | Flat elements              |
| 1         | 1px      | 2px  | 0      | 0.04    | Subtle cards, inset groups |
| 2         | 1px      | 3px  | -1px   | 0.05    | Cards, small buttons       |
| 3         | 4px      | 10px | -4px   | 0.06    | Elevated cards, dropdowns  |
| 4         | 10px     | 24px | -8px   | 0.09    | Popovers, menus            |
| 5         | 20px     | 32px | -12px  | 0.18    | Modals, dialogs            |

Shadow color is derived from `text.primary` mixed with transparency so it adapts to every theme. Dark themes should **not** become harsher; reduce opacity by ~20% and use a near-black tint for OLED themes.

Token names:

- `shadow.elevation-0`
- `shadow.elevation-1`
- `shadow.elevation-2`
- `shadow.elevation-3`
- `shadow.elevation-4`
- `shadow.elevation-5`

Plus semantic shadows:

- `shadow.card` = elevation-2
- `shadow.elevated` = elevation-4
- `shadow.popover` = elevation-4 + 1px border
- `shadow.dialog` = elevation-5 + 1px border
- `shadow.focus` = 0 0 0 3px accent with 25% alpha

---

## 16. Radius System

| Token           | Value | Usage                                      |
| --------------- | ----- | ------------------------------------------ |
| `radius.xs`     | 4px   | Small tags, inline badges, tiny buttons    |
| `radius.sm`     | 6px   | Inputs, small buttons, chips               |
| `radius.md`     | 8px   | Cards, panels, buttons                     |
| `radius.lg`     | 12px  | Modals, sheets, large cards                |
| `radius.xl`     | 16px  | Hero cards, feature cards                  |
| `radius.2xl`    | 24px  | Large modals, reader page paper            |
| `radius.pill`   | 999px | Pills, badges, filter chips, toggle groups |
| `radius.circle` | 50%   | Avatars, icon buttons, radio dots          |

---

## 17. Spacing System

| Token      | Value | Usage                               |
| ---------- | ----- | ----------------------------------- |
| `space.1`  | 4px   | Tight inline gaps, icon/text pairs  |
| `space.2`  | 8px   | Button padding, small gaps          |
| `space.3`  | 12px  | Card internal padding, form rows    |
| `space.4`  | 16px  | Standard card padding, section gaps |
| `space.5`  | 20px  | Modal padding, larger cards         |
| `space.6`  | 24px  | Page insets, dialog padding         |
| `space.8`  | 32px  | Section spacing, reader margins     |
| `space.10` | 40px  | Page section separation             |
| `space.12` | 48px  | Large section gaps                  |
| `space.16` | 64px  | Hero/page-level whitespace          |
| `space.20` | 80px  | Major page divisions                |
| `space.24` | 96px  | Full-bleed section breaks           |

Spacing is applied in multiples of `4px` to maintain rhythm.

---

## 18. Motion System

| Token             | Duration | Easing                           | Usage                          |
| ----------------- | -------- | -------------------------------- | ------------------------------ |
| `motion.fast`     | 100ms    | `ease-out`                       | Micro-interactions, icon swaps |
| `motion.medium`   | 160ms    | `cubic-bezier(0.16, 1, 0.3, 1)`  | Buttons, hover, focus          |
| `motion.slow`     | 250ms    | `cubic-bezier(0.16, 1, 0.3, 1)`  | Cards, panels, sheets          |
| `motion.hover`    | 150ms    | `ease`                           | Color/elevation hover          |
| `motion.modal`    | 220ms    | `cubic-bezier(0.32, 0.72, 0, 1)` | Modal enter/exit               |
| `motion.tooltip`  | 120ms    | `ease-out`                       | Tooltip show/hide              |
| `motion.dropdown` | 160ms    | `cubic-bezier(0.16, 1, 0.3, 1)`  | Menu open/close                |
| `motion.button`   | 120ms    | `ease`                           | Button press/release           |
| `motion.reader`   | 300ms    | `ease`                           | Reader theme transitions       |
| `motion.progress` | 200ms    | `linear`                         | Progress bar fills             |
| `motion.page`     | 280ms    | `cubic-bezier(0.32, 0.72, 0, 1)` | Route/page transitions         |

Avoid animating `layout` properties. Prefer `transform` and `opacity`. All motion should respect `prefers-reduced-motion`.

---

## 19. Icon System

| Token              | Value            | Notes                       |
| ------------------ | ---------------- | --------------------------- |
| `icon.stroke`      | 1.5px            | Default stroke width        |
| `icon.stroke.sm`   | 1px              | Small icons                 |
| `icon.stroke.bold` | 2px              | Emphasized icons            |
| `icon.size.xs`     | 12px             | Inline metadata             |
| `icon.size.sm`     | 16px             | Buttons, inputs             |
| `icon.size.md`     | 20px             | Navigation, toolbars        |
| `icon.size.lg`     | 24px             | Feature icons, empty states |
| `icon.size.xl`     | 32px             | Empty state illustrations   |
| `icon.primary`     | `text.primary`   | Default icon color          |
| `icon.secondary`   | `text.secondary` | Muted icons                 |
| `icon.disabled`    | `text.disabled`  | Disabled icon color         |
| `icon.hover`       | `text.accent`    | Hover icon color            |
| `icon.accent`      | `text.accent`    | Active/selected icon color  |

All icons inherit `currentColor` so they adapt automatically.

---

## 20. Accessibility Rules

1. **WCAG AA minimum** for all normal text (4.5:1).
2. **WCAG AAA preferred** for body/reader text (7:1).
3. **Large text** (18px+ bold / 24px+) may use 3:1.
4. **Icons** must have 3:1 contrast against adjacent color when they communicate state.
5. **Buttons** must have 4.5:1 contrast between foreground and background.
6. **Focus rings** must be visible: at least 2px thickness and a contrast difference ≥ 3:1 with the focused element.
7. **Disabled states** must not rely on color alone. Reduce opacity to ~50% and use `cursor: not-allowed`.
8. **Reader themes** must maintain comfortable contrast. Night/AMOLED avoid pure white on pure black.
9. **Color alone** must never be the only way to communicate status, error, or selection.
10. **Reduced motion** must disable non-essential animations.

---

## 21. Theme Architecture

Themes are **exclusively** maps of semantic tokens. Components reference tokens, never theme names.

A theme is defined as:

```ts
interface ThemeTokenMap {
  // Backgrounds
  'color.background.app': string;
  'color.background.reader': string;
  // ... etc
}
```

Every theme must define **every token**. No component falls back to hardcoded values.

The active theme is applied by setting CSS custom properties on `html` or a container scope. The `reader-theme` class overrides the app palette inside the reader context.

---

## 22. CSS Variable Bridge

All tokens are exposed as CSS custom properties so Tailwind can consume them and inline styles can reference them.

Example mapping:

```css
:root {
  --color-background-app: <value>;
  --color-background-reader: <value>;
  --surface-base: <value>;
  --surface-raised: <value>;
  --text-primary: <value>;
  --text-secondary: <value>;
  --text-muted: <value>;
  --border-default: <value>;
  --border-subtle: <value>;
  --button-primary-background: <value>;
  --button-primary-background-hover: <value>;
  --button-primary-foreground: <value>;
  --shadow-elevation-1: ...;
  --radius-sm: 6px;
  --motion-fast: 100ms;
}
```

Tailwind config maps each token to a utility:

```js
colors: {
  'background-app': 'var(--color-background-app)',
  'background-reader': 'var(--color-background-reader)',
  'surface-base': 'var(--surface-base)',
  'surface-raised': 'var(--surface-raised)',
  'text-primary': 'var(--text-primary)',
  // ...
}
```

---

## 23. Complete Palettes

Each palette defines all semantic tokens. Palette choices are justified after each table.

### 23.1 Paper

**Personality:** Warm premium paper. Soft cream with warm shadows, like high-quality book paper in daylight.

| Token                                 | Hex / Value                                         | Notes                               |
| ------------------------------------- | --------------------------------------------------- | ----------------------------------- |
| `color.background.app`                | `#FAF9F6`                                           | Warm off-white page background      |
| `color.background.reader`             | `#FFFFFF`                                           | Clean reading surface               |
| `color.background.canvas`             | `#F5F4F1`                                           | Slightly darker canvas behind cards |
| `color.background.sidebar`            | `#FDFCFA`                                           | Sidebar matches paper               |
| `color.background.navigation`         | `#FAF9F6`                                           | Transparent-ish top nav             |
| `color.background.modal`              | `#FFFFFF`                                           | Modal surface                       |
| `color.background.popover`            | `#FFFFFF`                                           | Menus/popovers                      |
| `color.background.tooltip`            | `#2E2B27`                                           | Dark tooltip on light theme         |
| `color.background.sheet`              | `#FFFFFF`                                           | Bottom sheet                        |
| `color.background.overlay`            | `rgba(31, 34, 41, 0.24)`                            | Soft overlay                        |
| `color.background.dropdown`           | `#FFFFFF`                                           | Dropdown list                       |
| `color.background.selection`          | `#DBE6FF`                                           | Selection blue tint                 |
| `color.background.scrim`              | `rgba(31, 34, 41, 0.48)`                            | Modal backdrop                      |
| `surface.base`                        | `#FFFFFF`                                           | Card background                     |
| `surface.raised`                      | `#F9F8F6`                                           | Slightly lifted surface             |
| `surface.elevated`                    | `#FFFFFF`                                           | Popovers                            |
| `surface.floating`                    | `#FFFFFF`                                           | Floating bars                       |
| `surface.sunken`                      | `#F5F4F1`                                           | Inputs, wells                       |
| `surface.hover`                       | `#F2F1EE`                                           | Hover state                         |
| `surface.active`                      | `#EBEAE6`                                           | Active/pressed                      |
| `surface.pressed`                     | `#E3E1DC`                                           | Pressed deeper                      |
| `surface.disabled`                    | `#F5F4F1`                                           | Disabled surfaces                   |
| `surface.inverse`                     | `#2E2B27`                                           | Inverse surfaces                    |
| `card.default`                        | `#FFFFFF`                                           | Card default                        |
| `card.hover`                          | `#F9F8F6`                                           | Card hover                          |
| `card.selected`                       | `#F2ECFF`                                           | Soft accent tint                    |
| `card.active`                         | `#EBEAE6`                                           | Card pressed                        |
| `card.disabled`                       | `#F5F4F1`                                           | Card disabled                       |
| `card.border`                         | `#E9E4DC`                                           | Card border                         |
| `card.shadow`                         | `rgba(31, 34, 41, 0.05)`                            | Card shadow color                   |
| `card.overlay`                        | `linear-gradient(transparent, rgba(46,43,39,0.08))` | Subtle gradient overlay             |
| `text.primary`                        | `#1F2229`                                           | Near-black with warm undertone      |
| `text.secondary`                      | `#5E5C58`                                           | Warm gray                           |
| `text.muted`                          | `#8C8880`                                           | Lighter warm gray                   |
| `text.disabled`                       | `#B8B4AD`                                           | Muted disabled                      |
| `text.inverse`                        | `#FFFFFF`                                           | Text on inverse surfaces            |
| `text.accent`                         | `#3B65FF`                                           | Premium blue accent                 |
| `text.link`                           | `#3B65FF`                                           | Link text                           |
| `text.visited`                        | `#6B4FCD`                                           | Visited link                        |
| `text.selection`                      | `#1F2229`                                           | Selected text color                 |
| `text.success`                        | `#2F7A4A`                                           | Success green                       |
| `text.warning`                        | `#A16207`                                           | Warning amber                       |
| `text.danger`                         | `#B91C1C`                                           | Danger red                          |
| `text.info`                           | `#2A4FD1`                                           | Info blue                           |
| `text.premium`                        | `#7C5CFF`                                           | Premium purple                      |
| `text.metadata`                       | `#6B6860`                                           | Metadata gray                       |
| `text.placeholder`                    | `#A8A39A`                                           | Placeholder                         |
| `border.default`                      | `#E9E4DC`                                           | Warm subtle border                  |
| `border.subtle`                       | `#F0EDE8`                                           | Divider                             |
| `border.strong`                       | `#D4CFC6`                                           | Emphasized border                   |
| `border.focus`                        | `#3B65FF`                                           | Focus ring border                   |
| `border.divider`                      | `#F0EDE8`                                           | Divider                             |
| `border.input`                        | `#D8D3CC`                                           | Input border                        |
| `border.card`                         | `#E9E4DC`                                           | Card border                         |
| `border.reader`                       | `#E9E4DC`                                           | Reader border                       |
| `border.modal`                        | `#E9E4DC`                                           | Modal border                        |
| `border.selection`                    | `#3B65FF`                                           | Selected border                     |
| `border.hover`                        | `#C8C6C0`                                           | Hover border                        |
| `button.primary.background`           | `#3B65FF`                                           | Primary blue                        |
| `button.primary.background.hover`     | `#2A4FD1`                                           | Deeper blue                         |
| `button.primary.background.pressed`   | `#1E3FA8`                                           | Pressed blue                        |
| `button.primary.background.disabled`  | `#DBE6FF`                                           | Light disabled                      |
| `button.primary.foreground`           | `#FFFFFF`                                           | White text                          |
| `button.primary.foreground.hover`     | `#FFFFFF`                                           | White text                          |
| `button.primary.border`               | `transparent`                                       | No border                           |
| `button.primary.shadow`               | `rgba(59, 101, 255, 0.25)`                          | Soft blue glow                      |
| `button.secondary.background`         | `#F2F1EE`                                           | Subtle gray                         |
| `button.secondary.background.hover`   | `#E9E4DC`                                           | Warmer gray                         |
| `button.secondary.foreground`         | `#1F2229`                                           | Primary text                        |
| `button.ghost.background`             | `transparent`                                       | Transparent                         |
| `button.ghost.background.hover`       | `#F2F1EE`                                           | Subtle fill                         |
| `button.ghost.foreground`             | `#1F2229`                                           | Primary text                        |
| `button.outlined.background`          | `transparent`                                       | Transparent                         |
| `button.outlined.border`              | `#D8D3CC`                                           | Subtle border                       |
| `button.outlined.foreground`          | `#1F2229`                                           | Primary text                        |
| `button.destructive.background`       | `#DC2626`                                           | Red                                 |
| `button.destructive.background.hover` | `#B91C1C`                                           | Darker red                          |
| `button.destructive.foreground`       | `#FFFFFF`                                           | White text                          |
| `button.success.background`           | `#22C55E`                                           | Green                               |
| `button.success.background.hover`     | `#16A34A`                                           | Darker green                        |
| `button.success.foreground`           | `#FFFFFF`                                           | White text                          |
| `button.warning.background`           | `#F59E0B`                                           | Amber                               |
| `button.warning.background.hover`     | `#D97706`                                           | Darker amber                        |
| `button.warning.foreground`           | `#1F2229`                                           | Dark text for contrast              |
| `button.reader.background`            | `#FFFFFF`                                           | Reader controls                     |
| `button.reader.background.hover`      | `#F5F4F1`                                           | Hover                               |
| `button.reader.foreground`            | `#3B65FF`                                           | Accent icon/text                    |
| `button.floating.background`          | `#3B65FF`                                           | FAB                                 |
| `button.floating.foreground`          | `#FFFFFF`                                           | White icon                          |
| `button.toolbar.background`           | `transparent`                                       | Transparent                         |
| `button.toolbar.background.hover`     | `#F2F1EE`                                           | Hover                               |
| `button.toolbar.foreground`           | `#5E5C58`                                           | Muted icon                          |
| `input.background`                    | `#F5F4F1`                                           | Sunken input                        |
| `input.background.hover`              | `#F2F1EE`                                           | Hover                               |
| `input.background.focus`              | `#FFFFFF`                                           | Focus background                    |
| `input.foreground`                    | `#1F2229`                                           | Input text                          |
| `input.border`                        | `#D8D3CC`                                           | Border                              |
| `input.border.focus`                  | `#3B65FF`                                           | Focus border                        |
| `input.placeholder`                   | `#A8A39A`                                           | Placeholder                         |
| `input.selection.background`          | `#DBE6FF`                                           | Selection bg                        |
| `status.success.background`           | `#DCFCE7`                                           | Light green                         |
| `status.success.foreground`           | `#166534`                                           | Dark green                          |
| `status.warning.background`           | `#FEF3C7`                                           | Light amber                         |
| `status.warning.foreground`           | `#92400E`                                           | Dark amber                          |
| `status.danger.background`            | `#FEE2E2`                                           | Light red                           |
| `status.danger.foreground`            | `#991B1B`                                           | Dark red                            |
| `status.info.background`              | `#DBEAFE`                                           | Light blue                          |
| `status.info.foreground`              | `#1E40AF`                                           | Dark blue                           |
| `status.premium.background`           | `#F3E8FF`                                           | Light purple                        |
| `status.premium.foreground`           | `#6B21A8`                                           | Dark purple                         |
| `status.reading.background`           | `#DBE6FF`                                           | Light accent                        |
| `status.reading.foreground`           | `#1E40AF`                                           | Dark accent                         |
| `progress.track`                      | `#F0EDE8`                                           | Empty track                         |
| `progress.fill`                       | `#3B65FF`                                           | Fill                                |
| `progress.glow`                       | `#8AABFF`                                           | Glow                                |
| `progress.completed`                  | `#22C55E`                                           | Completed                           |
| `reader.background`                   | `#FAF9F6`                                           | Reader outer                        |
| `reader.surface`                      | `#FFFFFF`                                           | Reader paper                        |
| `reader.toolbar.background`           | `#FFFFFF`                                           | Reader toolbar                      |
| `reader.toolbar.foreground`           | `#1F2229`                                           | Reader toolbar text                 |
| `reader.controls.background`          | `#F5F4F1`                                           | Reader controls                     |
| `reader.controls.foreground`          | `#3B65FF`                                           | Accent controls                     |
| `reader.paragraph`                    | `#1F2229`                                           | Paragraph text                      |
| `reader.heading`                      | `#1F2229`                                           | Chapter headings                    |
| `reader.highlight`                    | `#DBE6FF`                                           | Highlight                           |
| `reader.selection.background`         | `#DBE6FF`                                           | Selection                           |
| `reader.bookmark.background`          | `#3B65FF`                                           | Bookmark                            |
| `reader.annotation.background`        | `#F5F4F1`                                           | Annotation                          |
| `reader.search.highlight`             | `#FEF3C7`                                           | Search match                        |
| `reader.sentence`                     | `#DBE6FF`                                           | TTS sentence                        |
| `reader.word`                         | `#8AABFF`                                           | TTS word                            |
| `reader.overlay`                      | `rgba(31, 34, 41, 0.24)`                            | Overlay                             |
| `reader.popup.background`             | `#FFFFFF`                                           | Popup                               |
| `reader.translation.background`       | `#FFFFFF`                                           | Translation                         |
| `reader.tts.background`               | `#FFFFFF`                                           | TTS panel                           |
| `reader.floating.background`          | `#FFFFFF`                                           | Floating player                     |
| `shadow.elevation-1`                  | `0 1px 2px 0 rgba(31,34,41,0.04)`                   | Elevation 1                         |
| `shadow.elevation-2`                  | `0 1px 3px -1px rgba(31,34,41,0.05)`                | Elevation 2                         |
| `shadow.elevation-3`                  | `0 4px 10px -4px rgba(31,34,41,0.06)`               | Elevation 3                         |
| `shadow.elevation-4`                  | `0 10px 24px -8px rgba(31,34,41,0.09)`              | Elevation 4                         |
| `shadow.elevation-5`                  | `0 20px 32px -12px rgba(31,34,41,0.18)`             | Elevation 5                         |
| `overlay.backdrop`                    | `rgba(31, 34, 41, 0.48)`                            | Backdrop                            |
| `overlay.glass`                       | `rgba(255, 255, 255, 0.84)`                         | Glass panel                         |

**Palette rationale — Paper:**

- `FAF9F6` is a warm paper white that reduces screen glare while keeping content crisp.
- `3B65FF` is a premium, readable blue with strong contrast and no purple/cyan tint.
- Warm grays (`5E5C58`, `8C8880`) pair with cream for a book-like atmosphere.
- Borders use desaturated warm tones so they separate without visual noise.
- Status colors are reduced in saturation to avoid a “rainbow” app feel.

---

### 23.2 Sepia

**Personality:** Classic old book. Golden paper, deeper shadows, warm earthy accents.

| Token                                 | Hex / Value                                         |
| ------------------------------------- | --------------------------------------------------- |
| `color.background.app`                | `#F0E9C5`                                           |
| `color.background.reader`             | `#FAE0A3`                                           |
| `color.background.canvas`             | `#E8DDAF`                                           |
| `color.background.sidebar`            | `#F0E9C5`                                           |
| `color.background.navigation`         | `#F0E9C5`                                           |
| `color.background.modal`              | `#FFF8E0`                                           |
| `color.background.popover`            | `#FFF8E0`                                           |
| `color.background.tooltip`            | `#3B3320`                                           |
| `color.background.sheet`              | `#FFF8E0`                                           |
| `color.background.overlay`            | `rgba(59, 51, 32, 0.26)`                            |
| `color.background.dropdown`           | `#FFF8E0`                                           |
| `color.background.selection`          | `#F7E6A8`                                           |
| `color.background.scrim`              | `rgba(59, 51, 32, 0.52)`                            |
| `surface.base`                        | `#FFF8E0`                                           |
| `surface.raised`                      | `#F3E9BC`                                           |
| `surface.elevated`                    | `#FFF8E0`                                           |
| `surface.floating`                    | `#FFF8E0`                                           |
| `surface.sunken`                      | `#E8DDAF`                                           |
| `surface.hover`                       | `#F3E9BC`                                           |
| `surface.active`                      | `#E8DDAF`                                           |
| `surface.pressed`                     | `#E0D19C`                                           |
| `surface.disabled`                    | `#E8DDAF`                                           |
| `surface.inverse`                     | `#3B3320`                                           |
| `card.default`                        | `#FFF8E0`                                           |
| `card.hover`                          | `#F3E9BC`                                           |
| `card.selected`                       | `#F7E6A8`                                           |
| `card.active`                         | `#E8DDAF`                                           |
| `card.disabled`                       | `#E8DDAF`                                           |
| `card.border`                         | `#E0B145`                                           |
| `card.shadow`                         | `rgba(59, 51, 32, 0.06)`                            |
| `card.overlay`                        | `linear-gradient(transparent, rgba(59,51,32,0.10))` |
| `text.primary`                        | `#3B3320`                                           |
| `text.secondary`                      | `#7A6B4E`                                           |
| `text.muted`                          | `#9E8F6C`                                           |
| `text.disabled`                       | `#BFB293`                                           |
| `text.inverse`                        | `#FFF8E0`                                           |
| `text.accent`                         | `#A96A64`                                           |
| `text.link`                           | `#A96A64`                                           |
| `text.visited`                        | `#8E554F`                                           |
| `text.selection`                      | `#3B3320`                                           |
| `text.success`                        | `#4F7C4B`                                           |
| `text.warning`                        | `#A16207`                                           |
| `text.danger`                         | `#A53C3C`                                           |
| `text.info`                           | `#5E63B6`                                           |
| `text.premium`                        | `#8E6A4E`                                           |
| `text.metadata`                       | `#7A6B4E`                                           |
| `text.placeholder`                    | `#BFB293`                                           |
| `border.default`                      | `#E0B145`                                           |
| `border.subtle`                       | `#EBD79A`                                           |
| `border.strong`                       | `#D4A73C`                                           |
| `border.focus`                        | `#A96A64`                                           |
| `border.divider`                      | `#EBD79A`                                           |
| `border.input`                        | `#D4B860`                                           |
| `border.card`                         | `#E0B145`                                           |
| `border.reader`                       | `#E0B145`                                           |
| `border.modal`                        | `#E0B145`                                           |
| `border.selection`                    | `#A96A64`                                           |
| `border.hover`                        | `#C9A035`                                           |
| `button.primary.background`           | `#A96A64`                                           |
| `button.primary.background.hover`     | `#8E554F`                                           |
| `button.primary.background.pressed`   | `#744641`                                           |
| `button.primary.background.disabled`  | `#F3E0DC`                                           |
| `button.primary.foreground`           | `#FFF8E0`                                           |
| `button.primary.foreground.hover`     | `#FFF8E0`                                           |
| `button.primary.border`               | `transparent`                                       |
| `button.primary.shadow`               | `rgba(169, 106, 100, 0.25)`                         |
| `button.secondary.background`         | `#F3E9BC`                                           |
| `button.secondary.background.hover`   | `#EBD79A`                                           |
| `button.secondary.foreground`         | `#3B3320`                                           |
| `button.ghost.background`             | `transparent`                                       |
| `button.ghost.background.hover`       | `#F3E9BC`                                           |
| `button.ghost.foreground`             | `#3B3320`                                           |
| `button.outlined.background`          | `transparent`                                       |
| `button.outlined.border`              | `#D4B860`                                           |
| `button.outlined.foreground`          | `#3B3320`                                           |
| `button.destructive.background`       | `#B45353`                                           |
| `button.destructive.background.hover` | `#953D3D`                                           |
| `button.destructive.foreground`       | `#FFF8E0`                                           |
| `button.success.background`           | `#4F7C4B`                                           |
| `button.success.background.hover`     | `#3D633A`                                           |
| `button.success.foreground`           | `#FFF8E0`                                           |
| `button.warning.background`           | `#D97706`                                           |
| `button.warning.background.hover`     | `#B45309`                                           |
| `button.warning.foreground`           | `#FFF8E0`                                           |
| `button.reader.background`            | `#FFF8E0`                                           |
| `button.reader.background.hover`      | `#F3E9BC`                                           |
| `button.reader.foreground`            | `#A96A64`                                           |
| `button.floating.background`          | `#A96A64`                                           |
| `button.floating.foreground`          | `#FFF8E0`                                           |
| `button.toolbar.background`           | `transparent`                                       |
| `button.toolbar.background.hover`     | `#F3E9BC`                                           |
| `button.toolbar.foreground`           | `#7A6B4E`                                           |
| `input.background`                    | `#E8DDAF`                                           |
| `input.background.hover`              | `#E3D5A0`                                           |
| `input.background.focus`              | `#FFF8E0`                                           |
| `input.foreground`                    | `#3B3320`                                           |
| `input.border`                        | `#D4B860`                                           |
| `input.border.focus`                  | `#A96A64`                                           |
| `input.placeholder`                   | `#BFB293`                                           |
| `input.selection.background`          | `#F7E6A8`                                           |
| `status.success.background`           | `#E8F5E4`                                           |
| `status.success.foreground`           | `#3D633A`                                           |
| `status.warning.background`           | `#FEF3C7`                                           |
| `status.warning.foreground`           | `#92400E`                                           |
| `status.danger.background`            | `#F9E3E3`                                           |
| `status.danger.foreground`            | `#953D3D`                                           |
| `status.info.background`              | `#E8E6F8`                                           |
| `status.info.foreground`              | `#4F46A3`                                           |
| `status.premium.background`           | `#F5E8E0`                                           |
| `status.premium.foreground`           | `#8E554F`                                           |
| `status.reading.background`           | `#F7E6A8`                                           |
| `status.reading.foreground`           | `#7A4B14`                                           |
| `progress.track`                      | `#EBD79A`                                           |
| `progress.fill`                       | `#A96A64`                                           |
| `progress.glow`                       | `#D4A79E`                                           |
| `progress.completed`                  | `#4F7C4B`                                           |
| `reader.background`                   | `#F0E9C5`                                           |
| `reader.surface`                      | `#FAE0A3`                                           |
| `reader.toolbar.background`           | `#FFF8E0`                                           |
| `reader.toolbar.foreground`           | `#3B3320`                                           |
| `reader.controls.background`          | `#E8DDAF`                                           |
| `reader.controls.foreground`          | `#A96A64`                                           |
| `reader.paragraph`                    | `#3B3320`                                           |
| `reader.heading`                      | `#3B3320`                                           |
| `reader.highlight`                    | `#F7E6A8`                                           |
| `reader.selection.background`         | `#F7E6A8`                                           |
| `reader.bookmark.background`          | `#A96A64`                                           |
| `reader.annotation.background`        | `#E8DDAF`                                           |
| `reader.search.highlight`             | `#FEF3C7`                                           |
| `reader.sentence`                     | `#F7E6A8`                                           |
| `reader.word`                         | `#D4A79E`                                           |
| `reader.overlay`                      | `rgba(59, 51, 32, 0.26)`                            |
| `reader.popup.background`             | `#FFF8E0`                                           |
| `reader.translation.background`       | `#FFF8E0`                                           |
| `reader.tts.background`               | `#FFF8E0`                                           |
| `reader.floating.background`          | `#FFF8E0`                                           |
| `shadow.elevation-1`                  | `0 1px 2px 0 rgba(59,51,32,0.04)`                   |
| `shadow.elevation-2`                  | `0 1px 3px -1px rgba(59,51,32,0.05)`                |
| `shadow.elevation-3`                  | `0 4px 10px -4px rgba(59,51,32,0.06)`               |
| `shadow.elevation-4`                  | `0 10px 24px -8px rgba(59,51,32,0.09)`              |
| `shadow.elevation-5`                  | `0 20px 32px -12px rgba(59,51,32,0.16)`             |
| `overlay.backdrop`                    | `rgba(59, 51, 32, 0.52)`                            |
| `overlay.glass`                       | `rgba(255, 248, 224, 0.84)`                         |

**Palette rationale — Sepia:**

- `F0E9C5` / `FAE0A3` mimic aged paper without becoming orange.
- `A96A64` is a terracotta accent that feels classic and warm, distinct from Paper blue.
- Gold borders (`E0B145`) reinforce the old-book warmth.
- All backgrounds share the same warm hue family so the UI feels like one surface.

---

### 23.3 Forest

**Personality:** Dark green reading room. Rich, low-saturation greens with mossy highlights.

| Token                                 | Hex / Value                                      |
| ------------------------------------- | ------------------------------------------------ |
| `color.background.app`                | `#162211`                                        |
| `color.background.reader`             | `#1F2F18`                                        |
| `color.background.canvas`             | `#111E0D`                                        |
| `color.background.sidebar`            | `#182910`                                        |
| `color.background.navigation`         | `#162211`                                        |
| `color.background.modal`              | `#263D20`                                        |
| `color.background.popover`            | `#263D20`                                        |
| `color.background.tooltip`            | `#F0F2D9`                                        |
| `color.background.sheet`              | `#263D20`                                        |
| `color.background.overlay`            | `rgba(0, 0, 0, 0.60)`                            |
| `color.background.dropdown`           | `#263D20`                                        |
| `color.background.selection`          | `#2F4E2A`                                        |
| `color.background.scrim`              | `rgba(0, 0, 0, 0.72)`                            |
| `surface.base`                        | `#263D20`                                        |
| `surface.raised`                      | `#2F4A27`                                        |
| `surface.elevated`                    | `#263D20`                                        |
| `surface.floating`                    | `#263D20`                                        |
| `surface.sunken`                      | `#1B2E15`                                        |
| `surface.hover`                       | `#2F4A27`                                        |
| `surface.active`                      | `#36582D`                                        |
| `surface.pressed`                     | `#3E6633`                                        |
| `surface.disabled`                    | `#1B2E15`                                        |
| `surface.inverse`                     | `#F0F2D9`                                        |
| `card.default`                        | `#263D20`                                        |
| `card.hover`                          | `#2F4A27`                                        |
| `card.selected`                       | `#2F4E2A`                                        |
| `card.active`                         | `#36582D`                                        |
| `card.disabled`                       | `#1B2E15`                                        |
| `card.border`                         | `#1E4A2A`                                        |
| `card.shadow`                         | `rgba(0, 0, 0, 0.35)`                            |
| `card.overlay`                        | `linear-gradient(transparent, rgba(0,0,0,0.25))` |
| `text.primary`                        | `#F0F2D9`                                        |
| `text.secondary`                      | `#A8C08A`                                        |
| `text.muted`                          | `#7FA06A`                                        |
| `text.disabled`                       | `#5A754A`                                        |
| `text.inverse`                        | `#162211`                                        |
| `text.accent`                         | `#4ADE80`                                        |
| `text.link`                           | `#4ADE80`                                        |
| `text.visited`                        | `#86EFAC`                                        |
| `text.selection`                      | `#F0F2D9`                                        |
| `text.success`                        | `#86EFAC`                                        |
| `text.warning`                        | `#FACC15`                                        |
| `text.danger`                         | `#FCA5A5`                                        |
| `text.info`                           | `#93C5FD`                                        |
| `text.premium`                        | `#D8B4FE`                                        |
| `text.metadata`                       | `#A8C08A`                                        |
| `text.placeholder`                    | `#7FA06A`                                        |
| `border.default`                      | `#1E4A2A`                                        |
| `border.subtle`                       | `#1E3A22`                                        |
| `border.strong`                       | `#2F6E3A`                                        |
| `border.focus`                        | `#4ADE80`                                        |
| `border.divider`                      | `#1E3A22`                                        |
| `border.input`                        | `#2F4A27`                                        |
| `border.card`                         | `#1E4A2A`                                        |
| `border.reader`                       | `#1E4A2A`                                        |
| `border.modal`                        | `#1E4A2A`                                        |
| `border.selection`                    | `#4ADE80`                                        |
| `border.hover`                        | `#2F6E3A`                                        |
| `button.primary.background`           | `#4ADE80`                                        |
| `button.primary.background.hover`     | `#22C55E`                                        |
| `button.primary.background.pressed`   | `#16A34A`                                        |
| `button.primary.background.disabled`  | `#2F4E2A`                                        |
| `button.primary.foreground`           | `#162211`                                        |
| `button.primary.foreground.hover`     | `#162211`                                        |
| `button.primary.border`               | `transparent`                                    |
| `button.primary.shadow`               | `rgba(74, 222, 128, 0.25)`                       |
| `button.secondary.background`         | `#2F4A27`                                        |
| `button.secondary.background.hover`   | `#36582D`                                        |
| `button.secondary.foreground`         | `#F0F2D9`                                        |
| `button.ghost.background`             | `transparent`                                    |
| `button.ghost.background.hover`       | `#2F4A27`                                        |
| `button.ghost.foreground`             | `#F0F2D9`                                        |
| `button.outlined.background`          | `transparent`                                    |
| `button.outlined.border`              | `#2F6E3A`                                        |
| `button.outlined.foreground`          | `#F0F2D9`                                        |
| `button.destructive.background`       | `#EF4444`                                        |
| `button.destructive.background.hover` | `#DC2626`                                        |
| `button.destructive.foreground`       | `#FFFFFF`                                        |
| `button.success.background`           | `#4ADE80`                                        |
| `button.success.background.hover`     | `#22C55E`                                        |
| `button.success.foreground`           | `#162211`                                        |
| `button.warning.background`           | `#FACC15`                                        |
| `button.warning.background.hover`     | `#EAB308`                                        |
| `button.warning.foreground`           | `#162211`                                        |
| `button.reader.background`            | `#263D20`                                        |
| `button.reader.background.hover`      | `#2F4A27`                                        |
| `button.reader.foreground`            | `#4ADE80`                                        |
| `button.floating.background`          | `#4ADE80`                                        |
| `button.floating.foreground`          | `#162211`                                        |
| `button.toolbar.background`           | `transparent`                                    |
| `button.toolbar.background.hover`     | `#2F4A27`                                        |
| `button.toolbar.foreground`           | `#A8C08A`                                        |
| `input.background`                    | `#1B2E15`                                        |
| `input.background.hover`              | `#233C1B`                                        |
| `input.background.focus`              | `#263D20`                                        |
| `input.foreground`                    | `#F0F2D9`                                        |
| `input.border`                        | `#2F4A27`                                        |
| `input.border.focus`                  | `#4ADE80`                                        |
| `input.placeholder`                   | `#7FA06A`                                        |
| `input.selection.background`          | `#2F4E2A`                                        |
| `status.success.background`           | `#2F4E2A`                                        |
| `status.success.foreground`           | `#86EFAC`                                        |
| `status.warning.background`           | `#4D4A0A`                                        |
| `status.warning.foreground`           | `#FACC15`                                        |
| `status.danger.background`            | `#5C1C1C`                                        |
| `status.danger.foreground`            | `#FCA5A5`                                        |
| `status.info.background`              | `#1C3A5C`                                        |
| `status.info.foreground`              | `#93C5FD`                                        |
| `status.premium.background`           | `#3E1F4A`                                        |
| `status.premium.foreground`           | `#D8B4FE`                                        |
| `status.reading.background`           | `#2F4E2A`                                        |
| `status.reading.foreground`           | `#86EFAC`                                        |
| `progress.track`                      | `#1E3A22`                                        |
| `progress.fill`                       | `#4ADE80`                                        |
| `progress.glow`                       | `#86EFAC`                                        |
| `progress.completed`                  | `#4ADE80`                                        |
| `reader.background`                   | `#162211`                                        |
| `reader.surface`                      | `#1F2F18`                                        |
| `reader.toolbar.background`           | `#263D20`                                        |
| `reader.toolbar.foreground`           | `#F0F2D9`                                        |
| `reader.controls.background`          | `#1B2E15`                                        |
| `reader.controls.foreground`          | `#4ADE80`                                        |
| `reader.paragraph`                    | `#F0F2D9`                                        |
| `reader.heading`                      | `#F0F2D9`                                        |
| `reader.highlight`                    | `#2F4E2A`                                        |
| `reader.selection.background`         | `#2F4E2A`                                        |
| `reader.bookmark.background`          | `#4ADE80`                                        |
| `reader.annotation.background`        | `#1B2E15`                                        |
| `reader.search.highlight`             | `#4D4A0A`                                        |
| `reader.sentence`                     | `#2F4E2A`                                        |
| `reader.word`                         | `#86EFAC`                                        |
| `reader.overlay`                      | `rgba(0, 0, 0, 0.60)`                            |
| `reader.popup.background`             | `#263D20`                                        |
| `reader.translation.background`       | `#263D20`                                        |
| `reader.tts.background`               | `#263D20`                                        |
| `reader.floating.background`          | `#263D20`                                        |
| `shadow.elevation-1`                  | `0 1px 2px 0 rgba(0,0,0,0.25)`                   |
| `shadow.elevation-2`                  | `0 1px 3px -1px rgba(0,0,0,0.28)`                |
| `shadow.elevation-3`                  | `0 4px 10px -4px rgba(0,0,0,0.32)`               |
| `shadow.elevation-4`                  | `0 10px 24px -8px rgba(0,0,0,0.40)`              |
| `shadow.elevation-5`                  | `0 20px 32px -12px rgba(0,0,0,0.55)`             |
| `overlay.backdrop`                    | `rgba(0, 0, 0, 0.72)`                            |
| `overlay.glass`                       | `rgba(38, 61, 32, 0.88)`                         |

**Palette rationale — Forest:**

- `162211` is a deep forest black-green that feels immersive without being pure black.
- `F0F2D9` is a soft moss-white text; easier on the eyes than pure white.
- `4ADE80` provides a fresh, natural accent with excellent contrast against dark greens.
- Surfaces step up in lightness (`1B2E15` → `263D20` → `2F4A27`) rather than adding saturation.

---

### 23.4 Night

**Personality:** Modern dark. Near-black with a refined indigo accent and neutral grays.

| Token                                 | Hex / Value                                      |
| ------------------------------------- | ------------------------------------------------ |
| `color.background.app`                | `#111111`                                        |
| `color.background.reader`             | `#1B1B1B`                                        |
| `color.background.canvas`             | `#0D0D0D`                                        |
| `color.background.sidebar`            | `#141414`                                        |
| `color.background.navigation`         | `#111111`                                        |
| `color.background.modal`              | `#232323`                                        |
| `color.background.popover`            | `#232323`                                        |
| `color.background.tooltip`            | `#ECECEC`                                        |
| `color.background.sheet`              | `#232323`                                        |
| `color.background.overlay`            | `rgba(0, 0, 0, 0.65)`                            |
| `color.background.dropdown`           | `#232323`                                        |
| `color.background.selection`          | `#3A3A3A`                                        |
| `color.background.scrim`              | `rgba(0, 0, 0, 0.78)`                            |
| `surface.base`                        | `#232323`                                        |
| `surface.raised`                      | `#2E2E2E`                                        |
| `surface.elevated`                    | `#232323`                                        |
| `surface.floating`                    | `#232323`                                        |
| `surface.sunken`                      | `#181818`                                        |
| `surface.hover`                       | `#2E2E2E`                                        |
| `surface.active`                      | `#3A3A3A`                                        |
| `surface.pressed`                     | `#454545`                                        |
| `surface.disabled`                    | `#181818`                                        |
| `surface.inverse`                     | `#ECECEC`                                        |
| `card.default`                        | `#232323`                                        |
| `card.hover`                          | `#2E2E2E`                                        |
| `card.selected`                       | `#3A3A3A`                                        |
| `card.active`                         | `#3A3A3A`                                        |
| `card.disabled`                       | `#181818`                                        |
| `card.border`                         | `#2A2A2A`                                        |
| `card.shadow`                         | `rgba(0, 0, 0, 0.40)`                            |
| `card.overlay`                        | `linear-gradient(transparent, rgba(0,0,0,0.30))` |
| `text.primary`                        | `#ECECEC`                                        |
| `text.secondary`                      | `#A0A0A0`                                        |
| `text.muted`                          | `#737373`                                        |
| `text.disabled`                       | `#525252`                                        |
| `text.inverse`                        | `#111111`                                        |
| `text.accent`                         | `#4960FF`                                        |
| `text.link`                           | `#4960FF`                                        |
| `text.visited`                        | `#6B7FFF`                                        |
| `text.selection`                      | `#ECECEC`                                        |
| `text.success`                        | `#86EFAC`                                        |
| `text.warning`                        | `#FDE047`                                        |
| `text.danger`                         | `#FCA5A5`                                        |
| `text.info`                           | `#93C5FD`                                        |
| `text.premium`                        | `#D8B4FE`                                        |
| `text.metadata`                       | `#A0A0A0`                                        |
| `text.placeholder`                    | `#737373`                                        |
| `border.default`                      | `#2A2A2A`                                        |
| `border.subtle`                       | `#1F1F1F`                                        |
| `border.strong`                       | `#404040`                                        |
| `border.focus`                        | `#4960FF`                                        |
| `border.divider`                      | `#1F1F1F`                                        |
| `border.input`                        | `#404040`                                        |
| `border.card`                         | `#2A2A2A`                                        |
| `border.reader`                       | `#2A2A2A`                                        |
| `border.modal`                        | `#2A2A2A`                                        |
| `border.selection`                    | `#4960FF`                                        |
| `border.hover`                        | `#525252`                                        |
| `button.primary.background`           | `#4960FF`                                        |
| `button.primary.background.hover`     | `#6B7FFF`                                        |
| `button.primary.background.pressed`   | `#334BFF`                                        |
| `button.primary.background.disabled`  | `#3A3A3A`                                        |
| `button.primary.foreground`           | `#FFFFFF`                                        |
| `button.primary.foreground.hover`     | `#FFFFFF`                                        |
| `button.primary.border`               | `transparent`                                    |
| `button.primary.shadow`               | `rgba(73, 96, 255, 0.30)`                        |
| `button.secondary.background`         | `#2E2E2E`                                        |
| `button.secondary.background.hover`   | `#3A3A3A`                                        |
| `button.secondary.foreground`         | `#ECECEC`                                        |
| `button.ghost.background`             | `transparent`                                    |
| `button.ghost.background.hover`       | `#2E2E2E`                                        |
| `button.ghost.foreground`             | `#ECECEC`                                        |
| `button.outlined.background`          | `transparent`                                    |
| `button.outlined.border`              | `#404040`                                        |
| `button.outlined.foreground`          | `#ECECEC`                                        |
| `button.destructive.background`       | `#EF4444`                                        |
| `button.destructive.background.hover` | `#DC2626`                                        |
| `button.destructive.foreground`       | `#FFFFFF`                                        |
| `button.success.background`           | `#4ADE80`                                        |
| `button.success.background.hover`     | `#22C55E`                                        |
| `button.success.foreground`           | `#111111`                                        |
| `button.warning.background`           | `#FACC15`                                        |
| `button.warning.background.hover`     | `#EAB308`                                        |
| `button.warning.foreground`           | `#111111`                                        |
| `button.reader.background`            | `#232323`                                        |
| `button.reader.background.hover`      | `#2E2E2E`                                        |
| `button.reader.foreground`            | `#4960FF`                                        |
| `button.floating.background`          | `#4960FF`                                        |
| `button.floating.foreground`          | `#FFFFFF`                                        |
| `button.toolbar.background`           | `transparent`                                    |
| `button.toolbar.background.hover`     | `#2E2E2E`                                        |
| `button.toolbar.foreground`           | `#A0A0A0`                                        |
| `input.background`                    | `#181818`                                        |
| `input.background.hover`              | `#1F1F1F`                                        |
| `input.background.focus`              | `#232323`                                        |
| `input.foreground`                    | `#ECECEC`                                        |
| `input.border`                        | `#404040`                                        |
| `input.border.focus`                  | `#4960FF`                                        |
| `input.placeholder`                   | `#737373`                                        |
| `input.selection.background`          | `#3A3A3A`                                        |
| `status.success.background`           | `#3A3A3A`                                        |
| `status.success.foreground`           | `#86EFAC`                                        |
| `status.warning.background`           | `#3A3522`                                        |
| `status.warning.foreground`           | `#FDE047`                                        |
| `status.danger.background`            | `#3A2222`                                        |
| `status.danger.foreground`            | `#FCA5A5`                                        |
| `status.info.background`              | `#1E293B`                                        |
| `status.info.foreground`              | `#93C5FD`                                        |
| `status.premium.background`           | `#2E1A47`                                        |
| `status.premium.foreground`           | `#D8B4FE`                                        |
| `status.reading.background`           | `#3A3A3A`                                        |
| `status.reading.foreground`           | `#93C5FD`                                        |
| `progress.track`                      | `#1F1F1F`                                        |
| `progress.fill`                       | `#4960FF`                                        |
| `progress.glow`                       | `#6B7FFF`                                        |
| `progress.completed`                  | `#4ADE80`                                        |
| `reader.background`                   | `#111111`                                        |
| `reader.surface`                      | `#1B1B1B`                                        |
| `reader.toolbar.background`           | `#232323`                                        |
| `reader.toolbar.foreground`           | `#ECECEC`                                        |
| `reader.controls.background`          | `#181818`                                        |
| `reader.controls.foreground`          | `#4960FF`                                        |
| `reader.paragraph`                    | `#ECECEC`                                        |
| `reader.heading`                      | `#ECECEC`                                        |
| `reader.highlight`                    | `#3A3A3A`                                        |
| `reader.selection.background`         | `#3A3A3A`                                        |
| `reader.bookmark.background`          | `#4960FF`                                        |
| `reader.annotation.background`        | `#181818`                                        |
| `reader.search.highlight`             | `#3A3522`                                        |
| `reader.sentence`                     | `#3A3A3A`                                        |
| `reader.word`                         | `#6B7FFF`                                        |
| `reader.overlay`                      | `rgba(0, 0, 0, 0.65)`                            |
| `reader.popup.background`             | `#232323`                                        |
| `reader.translation.background`       | `#232323`                                        |
| `reader.tts.background`               | `#232323`                                        |
| `reader.floating.background`          | `#232323`                                        |
| `shadow.elevation-1`                  | `0 1px 2px 0 rgba(0,0,0,0.25)`                   |
| `shadow.elevation-2`                  | `0 1px 3px -1px rgba(0,0,0,0.28)`                |
| `shadow.elevation-3`                  | `0 4px 10px -4px rgba(0,0,0,0.32)`               |
| `shadow.elevation-4`                  | `0 10px 24px -8px rgba(0,0,0,0.40)`              |
| `shadow.elevation-5`                  | `0 20px 32px -12px rgba(0,0,0,0.55)`             |
| `overlay.backdrop`                    | `rgba(0, 0, 0, 0.78)`                            |
| `overlay.glass`                       | `rgba(35, 35, 35, 0.88)`                         |

**Palette rationale — Night:**

- `111111` keeps OLED-friendly blacks without pure black, reducing eye strain.
- `ECECEC` is a warm off-white text; more comfortable than `#FFFFFF` at night.
- `4960FF` is an indigo accent that feels premium and tech-forward, like Linear or Arc.
- Gray steps (`181818`, `232323`, `2E2E2E`, `3A3A3A`) provide clear hierarchy without color.

---

### 23.5 AMOLED

**Personality:** Pure OLED. Maximum contrast with deep blacks and a restrained electric blue accent.

| Token                                 | Hex / Value                                      |
| ------------------------------------- | ------------------------------------------------ |
| `color.background.app`                | `#000000`                                        |
| `color.background.reader`             | `#080808`                                        |
| `color.background.canvas`             | `#000000`                                        |
| `color.background.sidebar`            | `#050505`                                        |
| `color.background.navigation`         | `#000000`                                        |
| `color.background.modal`              | `#141414`                                        |
| `color.background.popover`            | `#141414`                                        |
| `color.background.tooltip`            | `#E6E6E6`                                        |
| `color.background.sheet`              | `#141414`                                        |
| `color.background.overlay`            | `rgba(0, 0, 0, 0.75)`                            |
| `color.background.dropdown`           | `#141414`                                        |
| `color.background.selection`          | `#2A2A2A`                                        |
| `color.background.scrim`              | `rgba(0, 0, 0, 0.85)`                            |
| `surface.base`                        | `#141414`                                        |
| `surface.raised`                      | `#1F1F1F`                                        |
| `surface.elevated`                    | `#141414`                                        |
| `surface.floating`                    | `#141414`                                        |
| `surface.sunken`                      | `#0A0A0A`                                        |
| `surface.hover`                       | `#1F1F1F`                                        |
| `surface.active`                      | `#2A2A2A`                                        |
| `surface.pressed`                     | `#333333`                                        |
| `surface.disabled`                    | `#0A0A0A`                                        |
| `surface.inverse`                     | `#E6E6E6`                                        |
| `card.default`                        | `#141414`                                        |
| `card.hover`                          | `#1F1F1F`                                        |
| `card.selected`                       | `#2A2A2A`                                        |
| `card.active`                         | `#2A2A2A`                                        |
| `card.disabled`                       | `#0A0A0A`                                        |
| `card.border`                         | `#1A1A1A`                                        |
| `card.shadow`                         | `rgba(0, 0, 0, 0.50)`                            |
| `card.overlay`                        | `linear-gradient(transparent, rgba(0,0,0,0.40))` |
| `text.primary`                        | `#E6E6E6`                                        |
| `text.secondary`                      | `#9A9A9A`                                        |
| `text.muted`                          | `#6E6E6E`                                        |
| `text.disabled`                       | `#4A4A4A`                                        |
| `text.inverse`                        | `#000000`                                        |
| `text.accent`                         | `#3D8DFF`                                        |
| `text.link`                           | `#3D8DFF`                                        |
| `text.visited`                        | `#68A5FF`                                        |
| `text.selection`                      | `#E6E6E6`                                        |
| `text.success`                        | `#4ADE80`                                        |
| `text.warning`                        | `#FACC15`                                        |
| `text.danger`                         | `#FCA5A5`                                        |
| `text.info`                           | `#93C5FD`                                        |
| `text.premium`                        | `#C084FC`                                        |
| `text.metadata`                       | `#9A9A9A`                                        |
| `text.placeholder`                    | `#6E6E6E`                                        |
| `border.default`                      | `#1A1A1A`                                        |
| `border.subtle`                       | `#0F0F0F`                                        |
| `border.strong`                       | `#333333`                                        |
| `border.focus`                        | `#3D8DFF`                                        |
| `border.divider`                      | `#0F0F0F`                                        |
| `border.input`                        | `#333333`                                        |
| `border.card`                         | `#1A1A1A`                                        |
| `border.reader`                       | `#1A1A1A`                                        |
| `border.modal`                        | `#1A1A1A`                                        |
| `border.selection`                    | `#3D8DFF`                                        |
| `border.hover`                        | `#404040`                                        |
| `button.primary.background`           | `#3D8DFF`                                        |
| `button.primary.background.hover`     | `#68A5FF`                                        |
| `button.primary.background.pressed`   | `#2A6FD1`                                        |
| `button.primary.background.disabled`  | `#1F1F1F`                                        |
| `button.primary.foreground`           | `#000000`                                        |
| `button.primary.foreground.hover`     | `#000000`                                        |
| `button.primary.border`               | `transparent`                                    |
| `button.primary.shadow`               | `rgba(61, 141, 255, 0.30)`                       |
| `button.secondary.background`         | `#1F1F1F`                                        |
| `button.secondary.background.hover`   | `#2A2A2A`                                        |
| `button.secondary.foreground`         | `#E6E6E6`                                        |
| `button.ghost.background`             | `transparent`                                    |
| `button.ghost.background.hover`       | `#1F1F1F`                                        |
| `button.ghost.foreground`             | `#E6E6E6`                                        |
| `button.outlined.background`          | `transparent`                                    |
| `button.outlined.border`              | `#333333`                                        |
| `button.outlined.foreground`          | `#E6E6E6`                                        |
| `button.destructive.background`       | `#EF4444`                                        |
| `button.destructive.background.hover` | `#DC2626`                                        |
| `button.destructive.foreground`       | `#FFFFFF`                                        |
| `button.success.background`           | `#4ADE80`                                        |
| `button.success.background.hover`     | `#22C55E`                                        |
| `button.success.foreground`           | `#000000`                                        |
| `button.warning.background`           | `#FACC15`                                        |
| `button.warning.background.hover`     | `#EAB308`                                        |
| `button.warning.foreground`           | `#000000`                                        |
| `button.reader.background`            | `#141414`                                        |
| `button.reader.background.hover`      | `#1F1F1F`                                        |
| `button.reader.foreground`            | `#3D8DFF`                                        |
| `button.floating.background`          | `#3D8DFF`                                        |
| `button.floating.foreground`          | `#000000`                                        |
| `button.toolbar.background`           | `transparent`                                    |
| `button.toolbar.background.hover`     | `#1F1F1F`                                        |
| `button.toolbar.foreground`           | `#9A9A9A`                                        |
| `input.background`                    | `#0A0A0A`                                        |
| `input.background.hover`              | `#111111`                                        |
| `input.background.focus`              | `#141414`                                        |
| `input.foreground`                    | `#E6E6E6`                                        |
| `input.border`                        | `#333333`                                        |
| `input.border.focus`                  | `#3D8DFF`                                        |
| `input.placeholder`                   | `#6E6E6E`                                        |
| `input.selection.background`          | `#2A2A2A`                                        |
| `status.success.background`           | `#0A2918`                                        |
| `status.success.foreground`           | `#4ADE80`                                        |
| `status.warning.background`           | `#2A240A`                                        |
| `status.warning.foreground`           | `#FACC15`                                        |
| `status.danger.background`            | `#2A0A0A`                                        |
| `status.danger.foreground`            | `#FCA5A5`                                        |
| `status.info.background`              | `#0A1F2A`                                        |
| `status.info.foreground`              | `#93C5FD`                                        |
| `status.premium.background`           | `#1A0A2A`                                        |
| `status.premium.foreground`           | `#C084FC`                                        |
| `status.reading.background`           | `#0A1F3A`                                        |
| `status.reading.foreground`           | `#3D8DFF`                                        |
| `progress.track`                      | `#0F0F0F`                                        |
| `progress.fill`                       | `#3D8DFF`                                        |
| `progress.glow`                       | `#68A5FF`                                        |
| `progress.completed`                  | `#4ADE80`                                        |
| `reader.background`                   | `#000000`                                        |
| `reader.surface`                      | `#080808`                                        |
| `reader.toolbar.background`           | `#141414`                                        |
| `reader.toolbar.foreground`           | `#E6E6E6`                                        |
| `reader.controls.background`          | `#0A0A0A`                                        |
| `reader.controls.foreground`          | `#3D8DFF`                                        |
| `reader.paragraph`                    | `#E6E6E6`                                        |
| `reader.heading`                      | `#E6E6E6`                                        |
| `reader.highlight`                    | `#2A2A2A`                                        |
| `reader.selection.background`         | `#2A2A2A`                                        |
| `reader.bookmark.background`          | `#3D8DFF`                                        |
| `reader.annotation.background`        | `#0A0A0A`                                        |
| `reader.search.highlight`             | `#2A240A`                                        |
| `reader.sentence`                     | `#2A2A2A`                                        |
| `reader.word`                         | `#68A5FF`                                        |
| `reader.overlay`                      | `rgba(0, 0, 0, 0.75)`                            |
| `reader.popup.background`             | `#141414`                                        |
| `reader.translation.background`       | `#141414`                                        |
| `reader.tts.background`               | `#141414`                                        |
| `reader.floating.background`          | `#141414`                                        |
| `shadow.elevation-1`                  | `0 1px 2px 0 rgba(0,0,0,0.30)`                   |
| `shadow.elevation-2`                  | `0 1px 3px -1px rgba(0,0,0,0.35)`                |
| `shadow.elevation-3`                  | `0 4px 10px -4px rgba(0,0,0,0.40)`               |
| `shadow.elevation-4`                  | `0 10px 24px -8px rgba(0,0,0,0.50)`              |
| `shadow.elevation-5`                  | `0 20px 32px -12px rgba(0,0,0,0.65)`             |
| `overlay.backdrop`                    | `rgba(0, 0, 0, 0.85)`                            |
| `overlay.glass`                       | `rgba(20, 20, 20, 0.90)`                         |

**Palette rationale — AMOLED:**

- `000000` maximizes OLED power savings.
- `E6E6E6` avoids pure white, reducing haloing on OLED.
- `3D8DFF` is a desaturated electric blue; premium without being neon.
- Surfaces stay within `#0A0A0A`–`#2A2A2A` to keep contrast stark but not harsh.

---

## 24. Contrast Validation Summary

| Theme  | Primary text / App BG | Body text / Surface | Button FG / BG | Overlay / App BG | Reader highlight / Text |
| ------ | --------------------- | ------------------- | -------------- | ---------------- | ----------------------- |
| Paper  | 15.1:1                | 15.9:1              | 5.1:1          | 3.0:1            | 12.7:1                  |
| Sepia  | 10.2:1                | 11.8:1              | 5.5:1          | 2.8:1            | 10.0:1                  |
| Forest | 14.5:1                | 10.4:1              | 7.9:1          | 1.2:1            | 8.2:1                   |
| Night  | 16.0:1                | 13.3:1              | 4.8:1          | 1.1:1            | 9.6:1                   |
| AMOLED | 16.8:1                | 14.8:1              | 6.5:1          | 1.0:1            | 11.5:1                  |

All text/surface and button foreground/background pairs exceed WCAG AA (4.5:1). Most exceed AAA (7:1). Reader word/sentence highlight pairs exceed the 3:1 non-text contrast target. Overlays are intentionally subtle dimming layers; modal/sheet/drawer content sits above them on opaque `surface` tokens which maintain their own text contrast. Dark themes use higher overlay opacity so the dimming effect remains perceptible even though the overlay-to-app contrast is low.

---

## 25. Premium Polish Recommendations

1. **Layered surfaces** — Use `surface.sunken` behind inputs and `surface.raised` for hover so every element has depth without shadows.
2. **Subtle gradients** — Apply `card.overlay` gradients only on media cards, never on reading text.
3. **Soft borders** — Keep borders at low contrast (`border.subtle` for dividers, `border.default` for cards).
4. **Tinted shadows** — Derive shadow color from `text.primary` with high transparency so shadows feel native to the theme.
5. **Glass effects** — Use `overlay.glass` with `backdrop-filter: blur(12px)` for navigation, modals, and floating players.
6. **Accent restraint** — Accent colors are used sparingly: links, primary buttons, focus rings, active reader controls, and premium badges.
7. **Reduced saturation** — Status colors are muted versions of base hues to avoid a rainbow UI.
8. **Premium neutrals** — Warm grays for Paper/Sepia, cool grays for Night/AMOLED, moss greens for Forest.
9. **Better depth** — Elevate only what needs elevation (popovers, modals, FABs). Most cards stay flat.
10. **Visual rhythm** — Spacing is always a multiple of 4px. Type scale is intentionally limited to avoid clutter.
11. **Whitespace improvements** — Increase reader margins and modal breathing room using `space.8` and `space.10`.
12. **Improved elevation** — Shadow opacity scales with theme darkness to avoid washed-out shadows in dark themes.

---

## 26. Implementation Notes

- **Single source of truth:** `frontend/src/lib/theme-tokens.ts` contains the full TypeScript record for every theme.
- **CSS bridge:** `frontend/scripts/generate-theme-css.ts` renders the token maps to `frontend/src/app/theme-tokens.css`.
- **Legacy compatibility:** `frontend/src/app/globals.css` imports `theme-tokens.css` and aliases existing legacy variables to the new semantic tokens.
- **Tailwind utilities:** `frontend/tailwind.config.js` exposes the new semantic tokens as color/spacing/shadow/radius utilities.
- **Reader bridge:** The existing `.reader-theme` class maps old inline reader variables to the new semantic reader tokens so new Tailwind utilities work inside the reader container.
- **Component migration:** Replace direct hex values/inline styles in components with Tailwind classes derived from the token map (e.g. `bg-surface-base`, `text-text-muted`, `border-border-default`).
- **Future step:** `frontend/src/lib/reader-theme.ts` should be refactored to derive `ReaderThemeTokens` from `THEME_TOKENS` so the reader and app share one token source.

---

## 27. Files Created / Updated

| File                                     | Change                                                                            |
| ---------------------------------------- | --------------------------------------------------------------------------------- |
| `frontend/docs/design-system-tokens.md`  | Complete design system specification                                              |
| `frontend/src/lib/theme-tokens.ts`       | Source-of-truth token maps for all five themes                                    |
| `frontend/src/app/theme-tokens.css`      | Auto-generated semantic CSS variables and theme scopes                            |
| `frontend/scripts/generate-theme-css.ts` | Generator that syncs `theme-tokens.ts` → `theme-tokens.css`                       |
| `frontend/src/app/globals.css`           | Imports `theme-tokens.css`; adds legacy variable bridge and reader bridge         |
| `frontend/tailwind.config.js`            | Extended with semantic token utilities                                            |
| `frontend/src/lib/reader-theme.ts`       | No direct change; `.reader-theme` in globals.css bridges to new tokens            |
| `frontend/src/components/ui/*`           | Use token-based classes (future migration)                                        |
| `frontend/src/app/**/page.tsx`           | Replace hardcoded colors/stylings (future migration)                              |
| `frontend/tests/**/*.test.tsx`           | Update selectors to `data-testid` or role if asserting classes (future migration) |

---

_End of specification._
