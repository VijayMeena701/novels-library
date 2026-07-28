export type RadiusToken =
  'radius.xs' | 'radius.sm' | 'radius.md' | 'radius.lg' | 'radius.xl' | 'radius.2xl' | 'radius.pill' | 'radius.circle';

export const RADIUS_TOKENS: Record<RadiusToken, string> = {
  'radius.xs': '4px',
  'radius.sm': '6px',
  'radius.md': '8px',
  'radius.lg': '12px',
  'radius.xl': '16px',
  'radius.2xl': '24px',
  'radius.pill': '999px',
  'radius.circle': '50%',
};
