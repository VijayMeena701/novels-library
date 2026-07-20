# UI/UX Polish & Theme System Refactor – Context Digest

This document transcribes the design brief provided in the UI/UX refactor image so the guidance is searchable in-repo.

## 1. Primary Goal
- Transform the current "normal" website experience into a polished, dedicated reader akin to Kindle, Apple Books, Kobo, or Moon Reader.
- Focus areas: readability, typography, spacing, immersive reading experience, modernized controls, richer visuals, and better handling of reader-specific tooling (navigation, themes, listening controls, etc.).
- Keep the experience feeling like a premium reading application rather than a generic web app.

## 2. Non-Negotiable Technical Constraints
Do **not** modify core functionality:
- Routing, authentication, APIs, data fetching, caching, background jobs, push notifications, login flow, search, top navigation structure, token logic, or content hierarchy (unless a small tweak is absolutely necessary for styling).
- No breaking changes; this effort is purely a UX polish + theming pass. Everything must keep working exactly as before.

## 3. Overall Design Direction
- The interface should feel like a premium reading app; the book content must remain the primary focus.
- Keep the existing layout structure but refine the finish so it appears intentional, calm, and book-focused.

## 4. Theme System Requirements
- Implement a proper reader theme system applied consistently to: reader container, global/page background, side panels, reading toolbar, progress bar, buttons, inputs, modals, and auxiliary UI.
- The entire experience should look cohesive under each theme.

### Theme Palettes (use as CSS vars or theme tokens)
| Theme  | Background | Reader | Text | Border | Accent |
|--------|------------|--------|------|--------|--------|
| Paper (default) | `#FFF8F1` | `#F2E7DB` | `#2E2B27` | `#E8D3B7` | `#A96A4A` |
| Sepia | `#F0E9C5` | `#FAE0A3` | `#3B3320` | `#E0B145` | `#A96A64` |
| Forest | `#182310` | `#2D3B20` | `#E0E3A1` | `#0F3A23` | `#0FA73C` |
| Night | `#111111` | `#1B1B1B` | `#ECECEC` | `#2A2A2A` | `#4960FF` |
| Amoled | `#000000` | `#080808` | `#E6E6E6` | `#1A1A1A` | `#4300FF` |

## 5. Reading Layout Improvements
- Keep the current layout; do *not* redesign structure.
- Improve perceived readability via typography, spacing, paragraph spacing, and alignment tweaks.
- Recommended targets: reading width 680–760px, base font size 18–20px, line-height 1.65–1.8, paragraph spacing 1.1–1.5em.
- The reading experience should feel effortless and distraction-free.

## 6. Navigation Guidelines
- Do **not** rebuild navigation flows; simplify the visuals only.
- Maintain existing layout/order while removing redundant borders/backgrounds so navigation visually matches the new themes.

## 7. Reader Controls
- Preserve the Listen button and all existing controls; only restyle them.
- Buttons should match the provided reference (consistent sizing, iconography, spacing) and adopt the active theme colors.
- Keep action order and underlying functionality untouched.

## 8. Bottom Reading Toolbar
- Introduce a minimal toolbar that is always visible during reading, without being intrusive.
- Includes: chapter progress bar, next/previous chapter controls, reading time + percentage text, and the Listen CTA.

## 9. Progress Indicator
- Replace the chapter info block with a visual progress bar that shows counts + percentage (e.g., `1177 / 2321 Chapters • 50%`).
- Reuse existing data; do not change data access logic.

## 10. Floating Reader (TTS Panel)
- The floating reader already works; polish the visuals only.
- Retain all controls/actions, tighten spacing, improve icon buttons, and style with theme colors.
- Continue showing currently selected voice + speed; keep layout compact.

## 11. Reader Settings Panel
- Functionality is complete; focus purely on aesthetics.
- Improve spacing, typography, toggles, sliders, reset buttons, and option alignment.
- The panel must automatically inherit the active theme.

## 12. Desktop Constraints
- Desktop layout should stay structurally identical: navigation, sidebars, toolbar placement, reading order, etc.
- Avoid adding brand-new UI chrome unless absolutely necessary.

## 13. Mobile Constraints
- Keep full functionality; no major layout rewrites.
- Maintain navigation, content sections, bottom drawer/toolbars, theme selector placement, and maximize usable reading area.

## 14. Animations
- Add only subtle, tasteful animations (150–200 ms). No large/flashy transitions.
- Keep transitions performant and low-overhead.

## 15. Accessibility
- Uphold strong color contrast, provide visible focus states, and maintain keyboard navigation.
- Ensure theme colors remain AA-compliant wherever possible.

## 16. Responsiveness
- Preserve responsiveness across breakpoints; avoid fixed heights when possible.
- Typography and spacing should scale smoothly so the reader feels natural on any device size.

## 17. Code Requirements
- Preserve existing components, data flow, and structure; introduce new components only when necessary.
- Avoid extra dependencies unless essential.
- Implement themes using the provided tokens/CSS variables (Tailwind-friendly).
- The refactor must be non-breaking; all current features must behave exactly as before.

## 18. Final Objective
- Post-refactor, the app should immediately feel like a dedicated e-book reader with premium polish.
- Users should notice better comfort, visuals, controls, and cohesiveness without any regression in functionality.
