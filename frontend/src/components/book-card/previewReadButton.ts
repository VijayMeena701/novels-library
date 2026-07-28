import { BookOpen, Play, RotateCcw } from 'lucide-react';
import type { Book, User } from '@/utils/api';
import type { PreviewReadButtonConfig } from './types';

interface GetPreviewReadButtonOptions {
  book: Book;
  user: User | null;
  isLibraryMode: boolean;
  totalChapters: number;
}

export function getPreviewReadButton({
  book,
  user,
  isLibraryMode,
  totalChapters,
}: GetPreviewReadButtonOptions): PreviewReadButtonConfig {
  const firstChapter = book.translatedChaptersList?.[0]?.chapterNumber ?? (totalChapters > 0 ? 1 : 0);
  const hasChapters = totalChapters > 0 && firstChapter > 0;

  const isUserBook = Boolean(user && (isLibraryMode || book.userBookCreatedAt));
  const savedChapter = isUserBook && hasChapters ? book.lastVisitedChapterNumber || book.chaptersRead || 0 : 0;
  const resumeChapter = savedChapter > 0 ? savedChapter : firstChapter;
  const hasResume = savedChapter > 0 && savedChapter !== firstChapter;

  const readHref = hasChapters ? `/books/${book._id}/reader/${resumeChapter}` : book.sourceUrl || null;

  if (!hasChapters) {
    return book.sourceUrl
      ? { label: 'Open Source', icon: BookOpen, href: book.sourceUrl, external: true, iconClass: '' }
      : { label: 'No Chapters', icon: BookOpen, href: null, external: false, disabled: true, iconClass: '' };
  }

  const status = book.status;

  if (!user || !status) {
    return { label: 'Read Now', icon: Play, href: readHref, external: false, iconClass: 'fill-current' };
  }

  switch (status) {
    case 'reading':
      return hasResume
        ? { label: 'Continue Reading', icon: BookOpen, href: readHref, external: false, iconClass: '' }
        : { label: 'Start Reading', icon: Play, href: readHref, external: false, iconClass: 'fill-current' };
    case 'completed':
      return { label: 'Read Again', icon: RotateCcw, href: readHref, external: false, iconClass: '' };
    case 'on_hold':
    case 'dropped':
      return hasResume
        ? { label: 'Resume Reading', icon: BookOpen, href: readHref, external: false, iconClass: '' }
        : { label: 'Start Reading', icon: Play, href: readHref, external: false, iconClass: 'fill-current' };
    case 'planning':
      return { label: 'Start Reading', icon: Play, href: readHref, external: false, iconClass: 'fill-current' };
    default:
      return { label: 'Read Now', icon: Play, href: readHref, external: false, iconClass: 'fill-current' };
  }
}
