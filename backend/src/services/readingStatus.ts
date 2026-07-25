import { BookStatus } from '../models/Book';

export const VALID_BOOK_STATUSES: BookStatus[] = ['reading', 'completed', 'on_hold', 'dropped', 'planning'];

// Allowed manual transitions between user reading statuses.
// Self-transitions are always permitted and treated as no-ops.
export const READING_STATUS_TRANSITIONS: Record<BookStatus, BookStatus[]> = {
  planning: ['planning', 'reading', 'dropped'],
  reading: ['reading', 'completed', 'on_hold', 'dropped'],
  on_hold: ['on_hold', 'reading', 'dropped', 'planning', 'completed'],
  dropped: ['dropped', 'reading', 'planning'],
  completed: ['completed', 'reading', 'planning', 'on_hold', 'dropped'],
};

export function isStatusTransitionAllowed(currentStatus: BookStatus | string | undefined, nextStatus: BookStatus | string): boolean {
  const current = (currentStatus as BookStatus) || 'planning';
  if (current === nextStatus) return true;
  return READING_STATUS_TRANSITIONS[current]?.includes(nextStatus as BookStatus) ?? false;
}

export interface DeriveStatusInput {
  currentStatus?: BookStatus | string | null;
  chaptersRead: number;
  totalChapters: number;
  /**
   * - add: book was added/re-added to the user's library
   * - visit: user opened a chapter (implies active reading)
   * - read: chaptersRead was updated explicitly (e.g. profile +1 or edit)
   * - manual: user explicitly requested a status change (must be validated separately via isStatusTransitionAllowed)
   */
  action: 'add' | 'visit' | 'read' | 'manual';
  requestedStatus?: BookStatus | string | null;
}

export function deriveUserBookStatus(input: DeriveStatusInput): BookStatus {
  const current = (input.currentStatus as BookStatus) || 'planning';
  const chaptersRead = Math.max(0, Number(input.chaptersRead) || 0);
  const totalChapters = Math.max(0, Number(input.totalChapters) || 0);

  // Completion is the strongest state and always wins when progress is full.
  if (totalChapters > 0 && chaptersRead >= totalChapters) {
    return 'completed';
  }

  if (input.action === 'add') {
    // Re-adding a previously removed book preserves its prior status,
    // unless it was marked completed while not actually fully read.
    if (current === 'completed' && chaptersRead < totalChapters) {
      return 'reading';
    }
    return current || 'planning';
  }

  if (input.action === 'visit' || input.action === 'read') {
    // Active reading moves paused/planned/dropped/new states into reading.
    if (['planning', 'on_hold', 'dropped'].includes(current)) {
      return 'reading';
    }
    if (!current) return 'reading';
    return current;
  }

  if (input.action === 'manual' && input.requestedStatus) {
    if (input.requestedStatus === 'completed' && !(totalChapters > 0 && chaptersRead >= totalChapters)) {
      // Cannot manually mark completed without full progress.
      return current || 'planning';
    }
    if (isStatusTransitionAllowed(current, input.requestedStatus as BookStatus)) {
      return input.requestedStatus as BookStatus;
    }
  }

  return current || 'planning';
}
