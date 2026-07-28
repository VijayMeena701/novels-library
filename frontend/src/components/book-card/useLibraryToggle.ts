'use client';

import { useState, useCallback } from 'react';
import { api } from '@/utils/api';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { CAPABILITY } from '@/utils/permissions';

interface UseLibraryToggleOptions {
  bookId: string;
  inLibrary: boolean;
}

export function useLibraryToggle({ bookId, inLibrary }: UseLibraryToggleOptions) {
  const { user, hasCapability } = useAuth();
  const { showToast } = useToast();

  const canAddToLibrary = Boolean(user && hasCapability(CAPABILITY.LIBRARY_ADD));
  const canRemoveFromLibrary = Boolean(user && hasCapability(CAPABILITY.LIBRARY_DELETE));

  const [optimisticAdded, setOptimisticAdded] = useState(false);
  const [optimisticRemoved, setOptimisticRemoved] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const isBookmarked = (inLibrary && !optimisticRemoved) || optimisticAdded;

  const handleBookmarkClick = useCallback(
    async (e?: React.MouseEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      if (isToggling) return;

      if (isBookmarked) {
        if (!canRemoveFromLibrary) return;
        setIsToggling(true);
        try {
          await api.deleteBook(bookId);
          setOptimisticRemoved(true);
          setOptimisticAdded(false);
          showToast({ message: 'Removed from library', variant: 'success' });
        } catch (err) {
          console.error('Failed to remove book from library:', err);
          showToast({ message: 'Failed to remove from library', variant: 'error' });
        } finally {
          setIsToggling(false);
        }
      } else {
        if (!canAddToLibrary) return;
        setIsToggling(true);
        try {
          await api.addBookToLibrary(bookId);
          setOptimisticAdded(true);
          setOptimisticRemoved(false);
          showToast({ message: 'Added to your library', variant: 'success' });
        } catch (err) {
          console.error('Failed to add book to library:', err);
          showToast({ message: 'Failed to add to library', variant: 'error' });
        } finally {
          setIsToggling(false);
        }
      }
    },
    [isBookmarked, canAddToLibrary, canRemoveFromLibrary, bookId, isToggling, showToast],
  );

  return {
    isBookmarked,
    isToggling,
    canToggleBookmark: (isBookmarked && canRemoveFromLibrary) || (!isBookmarked && canAddToLibrary),
    handleBookmarkClick,
  };
}
