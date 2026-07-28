/**
 * Breakpoint tokens.
 *
 * Used for responsive design and Tailwind screen definitions.
 */

export type BreakpointToken = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export const BREAKPOINTS: Record<BreakpointToken, string> = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};
