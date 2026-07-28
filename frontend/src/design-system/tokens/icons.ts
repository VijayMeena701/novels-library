export type IconsToken =
  | 'icon.stroke'
  | 'icon.stroke.sm'
  | 'icon.stroke.bold'
  | 'icon.size.xs'
  | 'icon.size.sm'
  | 'icon.size.md'
  | 'icon.size.lg'
  | 'icon.size.xl'
  | 'icon.primary'
  | 'icon.secondary'
  | 'icon.disabled'
  | 'icon.hover'
  | 'icon.accent';

export const ICONS_TOKENS: Record<IconsToken, string> = {
  'icon.stroke': '1.5px',
  'icon.stroke.sm': '1px',
  'icon.stroke.bold': '2px',
  'icon.size.xs': '12px',
  'icon.size.sm': '16px',
  'icon.size.md': '20px',
  'icon.size.lg': '24px',
  'icon.size.xl': '32px',
  'icon.primary': 'var(--text-primary)',
  'icon.secondary': 'var(--text-secondary)',
  'icon.disabled': 'var(--text-disabled)',
  'icon.hover': 'var(--text-accent)',
  'icon.accent': 'var(--text-accent)',
};
