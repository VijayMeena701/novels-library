/**
 * Z-index tokens.
 *
 * A small, intentional stacking scale.
 */

export type ZIndexToken =
  'base' | 'sticky' | 'header' | 'dropdown' | 'popover' | 'drawer' | 'modal' | 'toast' | 'tooltip';

export const Z_INDEX: Record<ZIndexToken, number> = {
  base: 0,
  sticky: 10,
  header: 50,
  dropdown: 100,
  popover: 110,
  drawer: 120,
  modal: 130,
  toast: 140,
  tooltip: 150,
};
