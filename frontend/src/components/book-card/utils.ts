import type { CSSProperties } from 'react';
import {
  BookOpen,
  Bookmark,
  CheckCircle2,
  Clock,
  Flame,
  X,
} from 'lucide-react';
import type { Book } from '@/utils/api';
import type { StatusConfig } from './types';

const COVER_PALETTES = [
  { main: '#1e1b4b', accent: '#6366f1', glow: '#a5b4fc', texture: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)' },
  { main: '#14532d', accent: '#22c55e', glow: '#86efac', texture: 'linear-gradient(135deg, #064e3b 0%, #047857 50%, #059669 100%)' },
  { main: '#701a75', accent: '#d946ef', glow: '#f0abfc', texture: 'linear-gradient(135deg, #581c87 0%, #7e22ce 50%, #9333ea 100%)' },
  { main: '#7c2d12', accent: '#f97316', glow: '#fdba74', texture: 'linear-gradient(135deg, #7c2d12 0%, #c2410c 50%, #ea580c 100%)' },
  { main: '#0f172a', accent: '#38bdf8', glow: '#7dd3fc', texture: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)' },
  { main: '#881337', accent: '#f43f5e', glow: '#fda4af', texture: 'linear-gradient(135deg, #881337 0%, #be123c 50%, #e11d48 100%)' },
  { main: '#312e81', accent: '#818cf8', glow: '#c7d2fe', texture: 'linear-gradient(135deg, #312e81 0%, #4f46e5 50%, #6366f1 100%)' },
  { main: '#365314', accent: '#84cc16', glow: '#bef264', texture: 'linear-gradient(135deg, #1a2e05 0%, #3f6212 50%, #4d7c0f 100%)' },
] as const;

export function getCoverStyle(book: Book): CSSProperties {
  const seed = `${book._id}${book.title}`;
  const hash = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const palette = COVER_PALETTES[hash % COVER_PALETTES.length];

  return {
    background: palette.texture,
    '--accent-color': palette.accent,
    '--glow-color': palette.glow,
  } as CSSProperties;
}

export function getAuthorName(book: Book): string {
  return book.authorPenName || book.author || book.authorRealName || 'Unknown Author';
}

export function getTotalChapters(book: Book): number {
  return book.translatedChaptersTotal || book.translatedChaptersList?.length || 0;
}

export function getProgressPercent(book: Book): number {
  const totalChapters = getTotalChapters(book);
  return totalChapters > 0
    ? Math.min(100, Math.round((book.chaptersRead / totalChapters) * 100))
    : 0;
}

export function getStatusConfig(status = ''): StatusConfig {
  const normalized = status.toLowerCase().replace(/\s+/g, '_');

  switch (normalized) {
    case 'completed':
      return {
        label: 'Completed',
        badgeClass: 'bg-success text-inverse border-success',
        dotClass: 'bg-current',
        icon: CheckCircle2,
      };
    case 'reading':
      return {
        label: 'Reading',
        badgeClass: 'bg-accent text-inverse border-accent',
        dotClass: 'bg-current animate-pulse',
        icon: Flame,
      };
    case 'on_hold':
    case 'hold':
    case 'pending':
      return {
        label: 'On Hold',
        badgeClass: 'bg-warning text-inverse border-warning',
        dotClass: 'bg-current',
        icon: Clock,
      };
    case 'dropped':
    case 'failed':
      return {
        label: 'Dropped',
        badgeClass: 'bg-danger text-inverse border-danger',
        dotClass: 'bg-current',
        icon: X,
      };
    case 'planning':
      return {
        label: 'Plan to Read',
        badgeClass: 'bg-premium text-inverse border-premium',
        dotClass: 'bg-current',
        icon: Bookmark,
      };
    default:
      return {
        label: status || 'Unknown',
        badgeClass: 'bg-muted text-inverse border-muted',
        dotClass: 'bg-current',
        icon: BookOpen,
      };
  }
}
