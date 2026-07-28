export type MotionToken =
  | 'motion.fast'
  | 'motion.medium'
  | 'motion.slow'
  | 'motion.hover'
  | 'motion.modal'
  | 'motion.tooltip'
  | 'motion.dropdown'
  | 'motion.button'
  | 'motion.reader'
  | 'motion.progress'
  | 'motion.page';

export const MOTION_TOKENS: Record<MotionToken, string> = {
  'motion.fast': '100ms',
  'motion.medium': '160ms',
  'motion.slow': '250ms',
  'motion.hover': '150ms',
  'motion.modal': '220ms',
  'motion.tooltip': '120ms',
  'motion.dropdown': '160ms',
  'motion.button': '120ms',
  'motion.reader': '300ms',
  'motion.progress': '200ms',
  'motion.page': '280ms',
};
