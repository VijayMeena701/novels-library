/**
 * Opacity tokens.
 *
 * Applied consistently for disabled, hover, pressed, and backdrop states.
 */

export type OpacityToken = 'disabled' | 'hover' | 'pressed' | 'backdrop' | 'scrim' | 'subtle' | 'placeholder';

export const OPACITY: Record<OpacityToken, number> = {
  disabled: 0.5,
  hover: 0.8,
  pressed: 0.9,
  backdrop: 0.48,
  scrim: 0.72,
  subtle: 0.12,
  placeholder: 0.65,
};
