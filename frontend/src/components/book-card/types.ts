import type { Book } from '@/utils/api';

export type BookCardMode = 'profile' | 'catalog';

export interface BookCardProps {
  book: Book;
  href?: string;
  mode?: BookCardMode;
}

export interface StatusConfig {
  label: string;
  badgeClass: string;
  dotClass: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface PreviewReadButtonConfig {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string | null;
  external: boolean;
  disabled?: boolean;
  iconClass?: string;
}

export interface LibraryToggleState {
  isBookmarked: boolean;
  isToggling: boolean;
  handleBookmarkClick: (e?: React.MouseEvent) => Promise<void>;
}
