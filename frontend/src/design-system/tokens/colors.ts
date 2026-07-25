/**
 * Semantic color tokens.
 *
 * Themes ONLY provide values for these color tokens. Spacing, typography,
 * radius, motion, etc. live in the design-system token modules.
 */

export type ColorToken =
	"color.background.app"
	| 	"color.background.reader"
	| 	"color.background.canvas"
	| 	"color.background.sidebar"
	| 	"color.background.navigation"
	| 	"color.background.modal"
	| 	"color.background.popover"
	| 	"color.background.tooltip"
	| 	"color.background.sheet"
	| 	"color.background.overlay"
	| 	"color.background.dropdown"
	| 	"color.background.selection"
	| 	"color.background.scrim"
	| 	"surface.base"
	| 	"surface.raised"
	| 	"surface.elevated"
	| 	"surface.floating"
	| 	"surface.sunken"
	| 	"surface.hover"
	| 	"surface.active"
	| 	"surface.pressed"
	| 	"surface.disabled"
	| 	"surface.inverse"
	| 	"card.default"
	| 	"card.hover"
	| 	"card.selected"
	| 	"card.active"
	| 	"card.disabled"
	| 	"card.border"
	| 	"card.shadow"
	| 	"card.overlay"
	| 	"text.primary"
	| 	"text.secondary"
	| 	"text.muted"
	| 	"text.disabled"
	| 	"text.inverse"
	| 	"text.accent"
	| 	"text.link"
	| 	"text.visited"
	| 	"text.selection"
	| 	"text.success"
	| 	"text.warning"
	| 	"text.danger"
	| 	"text.info"
	| 	"text.premium"
	| 	"text.metadata"
	| 	"text.placeholder"
	| 	"border.default"
	| 	"border.subtle"
	| 	"border.strong"
	| 	"border.focus"
	| 	"border.divider"
	| 	"border.input"
	| 	"border.card"
	| 	"border.reader"
	| 	"border.modal"
	| 	"border.selection"
	| 	"border.hover"
	| 	"button.primary.background"
	| 	"button.primary.background.hover"
	| 	"button.primary.background.pressed"
	| 	"button.primary.background.disabled"
	| 	"button.primary.foreground"
	| 	"button.primary.foreground.hover"
	| 	"button.primary.border"
	| 	"button.primary.shadow"
	| 	"button.primary.focus.ring"
	| 	"button.secondary.background"
	| 	"button.secondary.background.hover"
	| 	"button.secondary.foreground"
	| 	"button.ghost.background"
	| 	"button.ghost.background.hover"
	| 	"button.ghost.foreground"
	| 	"button.outlined.background"
	| 	"button.outlined.border"
	| 	"button.outlined.foreground"
	| 	"button.destructive.background"
	| 	"button.destructive.background.hover"
	| 	"button.destructive.foreground"
	| 	"button.success.background"
	| 	"button.success.background.hover"
	| 	"button.success.foreground"
	| 	"button.warning.background"
	| 	"button.warning.background.hover"
	| 	"button.warning.foreground"
	| 	"button.reader.background"
	| 	"button.reader.background.hover"
	| 	"button.reader.foreground"
	| 	"button.floating.background"
	| 	"button.floating.foreground"
	| 	"button.toolbar.background"
	| 	"button.toolbar.background.hover"
	| 	"button.toolbar.foreground"
	| 	"input.background"
	| 	"input.background.hover"
	| 	"input.background.focus"
	| 	"input.foreground"
	| 	"input.border"
	| 	"input.border.focus"
	| 	"input.placeholder"
	| 	"input.selection.background"
	| 	"input.selection.foreground"
	| 	"status.success.background"
	| 	"status.success.foreground"
	| 	"status.warning.background"
	| 	"status.warning.foreground"
	| 	"status.danger.background"
	| 	"status.danger.foreground"
	| 	"status.info.background"
	| 	"status.info.foreground"
	| 	"status.premium.background"
	| 	"status.premium.foreground"
	| 	"status.vip.background"
	| 	"status.vip.foreground"
	| 	"status.archived.background"
	| 	"status.archived.foreground"
	| 	"status.reading.background"
	| 	"status.reading.foreground"
	| 	"status.completed.background"
	| 	"status.completed.foreground"
	| 	"status.dropped.background"
	| 	"status.dropped.foreground"
	| 	"status.paused.background"
	| 	"status.paused.foreground"
	| 	"status.processing.background"
	| 	"status.processing.foreground"
	| 	"status.queued.background"
	| 	"status.queued.foreground"
	| 	"status.failed.background"
	| 	"status.failed.foreground"
	| 	"progress.track"
	| 	"progress.fill"
	| 	"progress.glow"
	| 	"progress.completed"
	| 	"progress.reader"
	| 	"progress.audio"
	| 	"progress.chapter"
	| 	"progress.loading"
	| 	"reader.background"
	| 	"reader.surface"
	| 	"reader.toolbar.background"
	| 	"reader.toolbar.foreground"
	| 	"reader.controls.background"
	| 	"reader.controls.foreground"
	| 	"reader.paragraph"
	| 	"reader.heading"
	| 	"reader.muted"
	| 	"reader.highlight"
	| 	"reader.accent"
	| 	"reader.accent.hover"
	| 	"reader.selection.background"
	| 	"reader.selection.foreground"
	| 	"reader.bookmark.background"
	| 	"reader.annotation.background"
	| 	"reader.search.highlight"
	| 	"reader.sentence"
	| 	"reader.word"
	| 	"reader.wordHighlight"
	| 	"reader.overlay"
	| 	"reader.popup.background"
	| 	"reader.translation.background"
	| 	"reader.tts.background"
	| 	"reader.floating.background"
	| 	"shadow.elevation-0"
	| 	"shadow.elevation-1"
	| 	"shadow.elevation-2"
	| 	"shadow.elevation-3"
	| 	"shadow.elevation-4"
	| 	"shadow.elevation-5"
	| 	"shadow.focus"
	| 	"overlay.modal"
	| 	"overlay.backdrop"
	| 	"overlay.glass"
	| 	"overlay.popover"
	| 	"overlay.tooltip"
	| 	"overlay.dropdown"
	| 	"overlay.sheet"
	| 	"overlay.drawer"
	| 	"overlay.dialog"
	| 	"overlay.hover-card";

export type ColorTheme = Record<ColorToken, string>;

/** Convert a dot-notation color token to a CSS custom property name. */
export function tokenToCssVariable(token: string): string {
	return `--${token.replace(/\./g, "-")}`;
}

export function isColorToken(token: string): token is ColorToken {
	return (colorTokenKeys as readonly string[]).includes(token);
}

const colorTokenKeys: readonly string[] = [
  "color.background.app",
  "color.background.reader",
  "color.background.canvas",
  "color.background.sidebar",
  "color.background.navigation",
  "color.background.modal",
  "color.background.popover",
  "color.background.tooltip",
  "color.background.sheet",
  "color.background.overlay",
  "color.background.dropdown",
  "color.background.selection",
  "color.background.scrim",
  "surface.base",
  "surface.raised",
  "surface.elevated",
  "surface.floating",
  "surface.sunken",
  "surface.hover",
  "surface.active",
  "surface.pressed",
  "surface.disabled",
  "surface.inverse",
  "card.default",
  "card.hover",
  "card.selected",
  "card.active",
  "card.disabled",
  "card.border",
  "card.shadow",
  "card.overlay",
  "text.primary",
  "text.secondary",
  "text.muted",
  "text.disabled",
  "text.inverse",
  "text.accent",
  "text.link",
  "text.visited",
  "text.selection",
  "text.success",
  "text.warning",
  "text.danger",
  "text.info",
  "text.premium",
  "text.metadata",
  "text.placeholder",
  "border.default",
  "border.subtle",
  "border.strong",
  "border.focus",
  "border.divider",
  "border.input",
  "border.card",
  "border.reader",
  "border.modal",
  "border.selection",
  "border.hover",
  "button.primary.background",
  "button.primary.background.hover",
  "button.primary.background.pressed",
  "button.primary.background.disabled",
  "button.primary.foreground",
  "button.primary.foreground.hover",
  "button.primary.border",
  "button.primary.shadow",
  "button.primary.focus.ring",
  "button.secondary.background",
  "button.secondary.background.hover",
  "button.secondary.foreground",
  "button.ghost.background",
  "button.ghost.background.hover",
  "button.ghost.foreground",
  "button.outlined.background",
  "button.outlined.border",
  "button.outlined.foreground",
  "button.destructive.background",
  "button.destructive.background.hover",
  "button.destructive.foreground",
  "button.success.background",
  "button.success.background.hover",
  "button.success.foreground",
  "button.warning.background",
  "button.warning.background.hover",
  "button.warning.foreground",
  "button.reader.background",
  "button.reader.background.hover",
  "button.reader.foreground",
  "button.floating.background",
  "button.floating.foreground",
  "button.toolbar.background",
  "button.toolbar.background.hover",
  "button.toolbar.foreground",
  "input.background",
  "input.background.hover",
  "input.background.focus",
  "input.foreground",
  "input.border",
  "input.border.focus",
  "input.placeholder",
  "input.selection.background",
  "input.selection.foreground",
  "status.success.background",
  "status.success.foreground",
  "status.warning.background",
  "status.warning.foreground",
  "status.danger.background",
  "status.danger.foreground",
  "status.info.background",
  "status.info.foreground",
  "status.premium.background",
  "status.premium.foreground",
  "status.vip.background",
  "status.vip.foreground",
  "status.archived.background",
  "status.archived.foreground",
  "status.reading.background",
  "status.reading.foreground",
  "status.completed.background",
  "status.completed.foreground",
  "status.dropped.background",
  "status.dropped.foreground",
  "status.paused.background",
  "status.paused.foreground",
  "status.processing.background",
  "status.processing.foreground",
  "status.queued.background",
  "status.queued.foreground",
  "status.failed.background",
  "status.failed.foreground",
  "progress.track",
  "progress.fill",
  "progress.glow",
  "progress.completed",
  "progress.reader",
  "progress.audio",
  "progress.chapter",
  "progress.loading",
  "reader.background",
  "reader.surface",
  "reader.toolbar.background",
  "reader.toolbar.foreground",
  "reader.controls.background",
  "reader.controls.foreground",
  "reader.paragraph",
  "reader.heading",
  "reader.highlight",
  "reader.selection.background",
  "reader.selection.foreground",
  "reader.bookmark.background",
  "reader.annotation.background",
  "reader.search.highlight",
  "reader.sentence",
  "reader.word",
  "reader.overlay",
  "reader.popup.background",
  "reader.translation.background",
  "reader.tts.background",
  "reader.floating.background",
  "shadow.elevation-0",
  "shadow.elevation-1",
  "shadow.elevation-2",
  "shadow.elevation-3",
  "shadow.elevation-4",
  "shadow.elevation-5",
  "shadow.focus",
  "overlay.modal",
  "overlay.backdrop",
  "overlay.glass",
  "overlay.popover",
  "overlay.tooltip",
  "overlay.dropdown",
  "overlay.sheet",
  "overlay.drawer",
  "overlay.dialog",
  "overlay.hover-card"
];
