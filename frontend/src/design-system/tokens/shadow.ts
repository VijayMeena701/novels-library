/**
 * Shadow token helpers.
 *
 * Shadow color/values are defined per-theme as `shadow.elevation-*` and
 * `shadow.focus` color tokens. This module exposes the canonical names.
 */

export type ShadowToken =
  | 'shadow.elevation-0'
  | 'shadow.elevation-1'
  | 'shadow.elevation-2'
  | 'shadow.elevation-3'
  | 'shadow.elevation-4'
  | 'shadow.elevation-5'
  | 'shadow.focus';

export const SHADOW_TOKENS: readonly ShadowToken[] = [
  'shadow.elevation-0',
  'shadow.elevation-1',
  'shadow.elevation-2',
  'shadow.elevation-3',
  'shadow.elevation-4',
  'shadow.elevation-5',
  'shadow.focus',
];

export function elevationShadowToken(level: 0 | 1 | 2 | 3 | 4 | 5): ShadowToken {
  return `shadow.elevation-${level}`;
}
