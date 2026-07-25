import { designSystemPlugin } from "./plugin";
import { BREAKPOINTS } from "../tokens/breakpoints";
import { FONT_FAMILY, FONT_SIZE, FONT_WEIGHT, LINE_HEIGHT, LETTER_SPACING } from "../tokens/typography";
import { Z_INDEX } from "../tokens/zIndex";
import { RADIUS_TOKENS } from "../tokens/radius";
import { MOTION_TOKENS } from "../tokens/motion";

const content = [
	"./src/app/**/*.{js,ts,jsx,tsx,mdx}",
	"./src/components/**/*.{js,ts,jsx,tsx,mdx}",
	"./src/context/**/*.{js,ts,jsx,tsx,mdx}",
	"./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
	"./src/utils/**/*.{js,ts,jsx,tsx,mdx}",
	"./src/design-system/**/*.{js,ts,jsx,tsx,mdx}",
];

const screens = {
	sm: BREAKPOINTS.sm,
	md: BREAKPOINTS.md,
	lg: BREAKPOINTS.lg,
	xl: BREAKPOINTS.xl,
	"2xl": BREAKPOINTS["2xl"],
};

const transitionDuration = {
	fast: MOTION_TOKENS["motion.fast"],
	medium: MOTION_TOKENS["motion.medium"],
	slow: MOTION_TOKENS["motion.slow"],
	hover: MOTION_TOKENS["motion.hover"],
	modal: MOTION_TOKENS["motion.modal"],
	tooltip: MOTION_TOKENS["motion.tooltip"],
	dropdown: MOTION_TOKENS["motion.dropdown"],
	button: MOTION_TOKENS["motion.button"],
	reader: MOTION_TOKENS["motion.reader"],
	progress: MOTION_TOKENS["motion.progress"],
	page: MOTION_TOKENS["motion.page"],
};

const borderRadius = {
	xs: RADIUS_TOKENS["radius.xs"],
	sm: RADIUS_TOKENS["radius.sm"],
	md: RADIUS_TOKENS["radius.md"],
	lg: RADIUS_TOKENS["radius.lg"],
	xl: RADIUS_TOKENS["radius.xl"],
	"2xl": RADIUS_TOKENS["radius.2xl"],
	pill: RADIUS_TOKENS["radius.pill"],
	circle: RADIUS_TOKENS["radius.circle"],
};

const fontFamily = {
	sans: FONT_FAMILY.sans,
	serif: FONT_FAMILY.serif,
};

const fontSize = {
	display: FONT_SIZE.display,
	h1: FONT_SIZE.h1,
	h2: FONT_SIZE.h2,
	h3: FONT_SIZE.h3,
	title: FONT_SIZE.title,
	subtitle: FONT_SIZE.subtitle,
	body: FONT_SIZE.body,
	small: FONT_SIZE.small,
	caption: FONT_SIZE.caption,
	metadata: FONT_SIZE.metadata,
};

const fontWeight = {
	regular: FONT_WEIGHT.regular,
	medium: FONT_WEIGHT.medium,
	semibold: FONT_WEIGHT.semibold,
	bold: FONT_WEIGHT.bold,
	extrabold: FONT_WEIGHT.extrabold,
};

const lineHeight = {
	tight: LINE_HEIGHT.tight,
	snug: LINE_HEIGHT.snug,
	normal: LINE_HEIGHT.normal,
	relaxed: LINE_HEIGHT.relaxed,
	loose: LINE_HEIGHT.loose,
};

const letterSpacing = {
	tighter: LETTER_SPACING.tighter,
	tight: LETTER_SPACING.tight,
	normal: LETTER_SPACING.normal,
	wide: LETTER_SPACING.wide,
	wider: LETTER_SPACING.wider,
};

const zIndex = {
	base: Z_INDEX.base,
	sticky: Z_INDEX.sticky,
	header: Z_INDEX.header,
	dropdown: Z_INDEX.dropdown,
	popover: Z_INDEX.popover,
	drawer: Z_INDEX.drawer,
	modal: Z_INDEX.modal,
	toast: Z_INDEX.toast,
	tooltip: Z_INDEX.tooltip,
};

const backgroundColor = {
	app: "var(--color-background-app)",
	canvas: "var(--color-background-canvas)",
	sidebar: "var(--color-background-sidebar)",
	nav: "var(--color-background-navigation)",
	modal: "var(--color-background-modal)",
	popover: "var(--color-background-popover)",
	tooltip: "var(--color-background-tooltip)",
	sheet: "var(--color-background-sheet)",
	overlay: "var(--color-background-overlay)",
	dropdown: "var(--color-background-dropdown)",
	selection: "var(--color-background-selection)",
	scrim: "var(--color-background-scrim)",
	surface: "var(--surface-base)",
	"surface-raised": "var(--surface-raised)",
	"surface-elevated": "var(--surface-elevated)",
	"surface-floating": "var(--surface-floating)",
	"surface-sunken": "var(--surface-sunken)",
	"surface-hover": "var(--surface-hover)",
	"surface-active": "var(--surface-active)",
	"surface-pressed": "var(--surface-pressed)",
	"surface-disabled": "var(--surface-disabled)",
	"surface-inverse": "var(--surface-inverse)",
	card: "var(--card-default)",
	"card-hover": "var(--card-hover)",
	"card-selected": "var(--card-selected)",
	"card-active": "var(--card-active)",
	"card-disabled": "var(--card-disabled)",
	reader: "var(--reader-background)",
	"reader-surface": "var(--reader-surface)",
	"reader-toolbar": "var(--reader-toolbar-background)",
	"reader-controls": "var(--reader-controls-background)",
	"reader-accent": "var(--reader-accent)",
	"reader-accent-hover": "var(--reader-accent-hover)",
	"reader-muted": "var(--reader-muted)",
	"reader-overlay": "var(--reader-overlay)",
	accent: "var(--button-primary-background)",
	"accent-hover": "var(--button-primary-background-hover)",
	"accent-pressed": "var(--button-primary-background-pressed)",
	"accent-disabled": "var(--button-primary-background-disabled)",
	"accent-subtle": "color-mix(in srgb, var(--button-primary-background) 12%, var(--surface-base))",
	muted: "var(--text-muted)",
	success: "var(--status-success-foreground)",
	warning: "var(--status-warning-foreground)",
	danger: "var(--status-danger-foreground)",
	info: "var(--status-info-foreground)",
	premium: "var(--status-premium-foreground)",
	reading: "var(--status-reading-foreground)",
	completed: "var(--status-completed-foreground)",
	dropped: "var(--status-dropped-foreground)",
	paused: "var(--status-paused-foreground)",
	processing: "var(--status-processing-foreground)",
	queued: "var(--status-queued-foreground)",
	failed: "var(--status-failed-foreground)",
	archived: "var(--status-archived-foreground)",
	"input-bg": "var(--input-background)",
	"input-bg-hover": "var(--input-background-hover)",
	"input-bg-focus": "var(--input-background-focus)",
};

const textColor = {
	primary: "var(--text-primary)",
	secondary: "var(--text-secondary)",
	muted: "var(--text-muted)",
	disabled: "var(--text-disabled)",
	inverse: "var(--text-inverse)",
	accent: "var(--button-primary-background)",
	"accent-hover": "var(--button-primary-background-hover)",
	link: "var(--text-link)",
	visited: "var(--text-visited)",
	selection: "var(--text-selection)",
	success: "var(--status-success-foreground)",
	warning: "var(--status-warning-foreground)",
	danger: "var(--status-danger-foreground)",
	info: "var(--status-info-foreground)",
	premium: "var(--status-premium-foreground)",
	metadata: "var(--text-metadata)",
	placeholder: "var(--input-placeholder)",
	"on-accent": "var(--button-primary-foreground)",
	"reader-paragraph": "var(--reader-paragraph)",
	"reader-heading": "var(--reader-heading)",
	"reader-muted": "var(--reader-muted)",
	"reader-surface": "var(--reader-surface)",
	"reader-controls": "var(--reader-controls-foreground)",
	"reader-accent": "var(--reader-accent)",
	"reader-accent-hover": "var(--reader-accent-hover)",
};

const borderColor = {
	default: "var(--border-default)",
	subtle: "var(--border-subtle)",
	strong: "var(--border-strong)",
	focus: "var(--border-focus)",
	divider: "var(--border-divider)",
	input: "var(--border-input)",
	card: "var(--border-card)",
	reader: "var(--border-reader)",
	"reader-accent": "var(--reader-accent)",
	"reader-accent-hover": "var(--reader-accent-hover)",
	"reader-bg": "var(--reader-background)",
	modal: "var(--border-modal)",
	selection: "var(--border-selection)",
	hover: "var(--border-hover)",
	accent: "var(--button-primary-background)",
	muted: "var(--text-muted)",
	success: "var(--status-success-foreground)",
	warning: "var(--status-warning-foreground)",
	danger: "var(--status-danger-foreground)",
	info: "var(--status-info-foreground)",
	premium: "var(--status-premium-foreground)",
};

const boxShadow = {
	"elevation-0": "var(--shadow-elevation-0)",
	"elevation-1": "var(--shadow-elevation-1)",
	"elevation-2": "var(--shadow-elevation-2)",
	"elevation-3": "var(--shadow-elevation-3)",
	"elevation-4": "var(--shadow-elevation-4)",
	"elevation-5": "var(--shadow-elevation-5)",
	focus: "var(--shadow-focus)",
};

const ringColor = {
	accent: "var(--button-primary-focus-ring)",
	focus: "var(--button-primary-focus-ring)",
	"reader-accent": "var(--reader-accent)",
};

const accentColor = {
	DEFAULT: "var(--button-primary-background)",
	"reader-accent": "var(--reader-accent)",
	"reader-muted": "var(--reader-muted)",
};

const ringOffsetColor = {
	DEFAULT: "var(--color-background-app)",
	reader: "var(--reader-background)",
	"reader-surface": "var(--reader-surface)",
	"reader-bg": "var(--reader-background)",
	"reader-accent": "var(--reader-accent)",
};

const config = {
	content,
	theme: {
		screens,
		extend: {
			backgroundColor,
			textColor,
			borderColor,
			accentColor,
			boxShadow,
			ringColor,
			ringOffsetColor,
			borderRadius,
			transitionDuration,
			fontFamily,
			fontSize,
			fontWeight,
			lineHeight,
			letterSpacing,
			zIndex,
		},
	},
	plugins: [designSystemPlugin],
};

export default config;
