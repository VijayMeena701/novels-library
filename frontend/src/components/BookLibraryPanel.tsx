'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, getBookCoverUrl, Book, ReadingSession, ChapterContent, ChapterVisit, BookStatus } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { Modal } from './ui/modal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input, Select, Textarea } from './ui/input';
import { Field } from './ui/field';
import { Badge } from './ui/badge';
import { Spinner } from './ui/spinner';
import { CAPABILITY, hasCapability } from '../utils/permissions';

function splitListInput(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDateTimeLocal(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function normalizeTitle(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function isGenericChapterTitle(value: string, bookTitle: string, chapterNumber: number): boolean {
  const normalized = normalizeTitle(value);
  return !normalized ||
    normalized === normalizeTitle(bookTitle) ||
    normalized === `chapter ${chapterNumber}` ||
    normalized === `ch ${chapterNumber}`;
}

function getStatusBadgeVariant(status?: BookStatus | string) {
  switch (status) {
    case 'reading':
      return 'reading';
    case 'completed':
      return 'completed';
    case 'on_hold':
      return 'hold';
    case 'dropped':
      return 'dropped';
    case 'planning':
      return 'planning';
    default:
      return 'default';
  }
}

export interface BookLibraryPanelProps {
  bookId: string;
  book: Book;
  chapters: Omit<ChapterContent, 'content'>[];
  onUpdate?: (book: Book) => void;
}

export function BookLibraryPanel({ bookId, book: bookProp, chapters: chaptersProp, onUpdate }: BookLibraryPanelProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const { user } = useAuth();
  const canRemoveLibrary = hasCapability(user, CAPABILITY.LIBRARY_DELETE);

  const [book, setBook] = useState<Book>(bookProp);
  const [chapters, setChapters] = useState<Omit<ChapterContent, 'content'>[]>(chaptersProp);
  const [chapterVisits, setChapterVisits] = useState<ChapterVisit[]>([]);
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [loading, setLoading] = useState(true);

  const [isEditing, setIsEditing] = useState(false);
  const [editStatus, setEditStatus] = useState<BookStatus>('reading');
  const [editChRead, setEditChRead] = useState(0);
  const [editCompletedAt, setEditCompletedAt] = useState('');
  const [editRating, setEditRating] = useState(0);
  const [editReview, setEditReview] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editRawLegacyEntry, setEditRawLegacyEntry] = useState('');
  const [editCharacterNotes, setEditCharacterNotes] = useState('');
  const [editRelationshipNotes, setEditRelationshipNotes] = useState('');
  const [editPersonalTags, setEditPersonalTags] = useState('');
  const [saving, setSaving] = useState(false);

  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [sessionNotes, setSessionNotes] = useState('');
  const [sessionChRead, setSessionChRead] = useState(0);

  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    setBook(bookProp);
    setChapters(chaptersProp);
  }, [bookProp, chaptersProp]);

  useEffect(() => {
    if (!book) return;
    setEditStatus(book.status ?? 'reading');
    setEditChRead(book.chaptersRead ?? 0);
    setEditCompletedAt(formatDateTimeLocal(book.completedAt));
    setEditRating(book.rating ?? 0);
    setEditReview(book.review || '');
    setEditNotes(book.personalNotes || '');
    setEditRawLegacyEntry(book.rawLegacyEntry || '');
    setEditCharacterNotes(book.characterNotes || '');
    setEditRelationshipNotes(book.relationshipNotes || '');
    setEditPersonalTags((book.personalTags || []).join(', '));
  }, [book]);

  useEffect(() => {
    if (!bookId) return;
    let cancelled = false;

    async function loadData() {
      try {
        const [chapterVisitsData, sessionsData] = await Promise.all([
          api.getChapterVisits(bookId),
          api.getSessions(bookId),
        ]);
        if (cancelled) return;

        setChapterVisits(chapterVisitsData);
        setSessions(sessionsData);
      } catch (err) {
        if (!cancelled) console.error('Error fetching library details:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadData();
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.updateBook(bookId, {
        status: editStatus,
        chaptersRead: editChRead,
        completedAt: editCompletedAt ? new Date(editCompletedAt).toISOString() : null,
        rating: editRating,
        review: editReview,
        personalNotes: editNotes,
        rawLegacyEntry: editRawLegacyEntry,
        characterNotes: editCharacterNotes,
        relationshipNotes: editRelationshipNotes,
        personalTags: splitListInput(editPersonalTags),
      });
      setBook(updated);
      onUpdate?.(updated);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update book:', err);
      showToast({ message: 'Error updating book details.', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveClick = () => {
    setIsRemoveModalOpen(true);
  };

  const handleConfirmRemove = async () => {
    setRemoving(true);
    try {
      await api.deleteBook(bookId);
      setIsRemoveModalOpen(false);
      router.push('/profile');
    } catch (err) {
      console.error('Delete failed:', err);
      showToast({ message: 'Failed to delete book.', variant: 'error' });
    } finally {
      setRemoving(false);
    }
  };

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.startSession(bookId, {
        notes: sessionNotes || 'Started new session.',
        chaptersRead: sessionChRead,
      });
      setIsSessionModalOpen(false);
      setSessionNotes('');
      setSessionChRead(0);

      const sessionsData = await api.getSessions(bookId);
      setSessions(sessionsData);
    } catch (err) {
      console.error('Failed to start reading session:', err);
    }
  };

  const handleUpdateSessionProgress = async (session: ReadingSession, increment: boolean) => {
    const nextCh = increment ? session.chaptersRead + 1 : Math.max(0, session.chaptersRead - 1);
    try {
      await api.updateSession(bookId, session._id, { chaptersRead: nextCh });
      const sessionsData = await api.getSessions(bookId);
      setSessions(sessionsData);
    } catch (err) {
      console.error('Failed to update session progress:', err);
    }
  };

  const handleCompleteSession = async (session: ReadingSession) => {
    try {
      await api.updateSession(bookId, session._id, { completed: true });
      const sessionsData = await api.getSessions(bookId);
      setSessions(sessionsData);
    } catch (err) {
      console.error('Failed to complete session:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" />
          <span className="text-sm text-muted-copy">Loading library details...</span>
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="max-w-[1520px] mx-auto px-4 py-12">
        <Card className="p-8 text-center max-w-md mx-auto">
          <CardTitle className="text-xl">Book Not Found</CardTitle>
          <CardDescription className="mt-2">
            The requested book entry could not be found or is unauthorized.
          </CardDescription>
          <Button asChild variant="secondary" className="mt-6">
            <Link href="/profile">Back to Library</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const displayAuthor = book.authorPenName || book.author || book.authorRealName || 'Unknown Author';
  const coverSrc = getBookCoverUrl(book);
  const resumeChapter = book.lastVisitedChapterNumber || book.chaptersRead || 1;
  const readPercent = book.translatedChaptersTotal > 0
    ? Math.min(100, Math.round(((book.chaptersRead ?? 0) / book.translatedChaptersTotal) * 100))
    : 0;
  const hasSourceMetadata = Boolean(
    book.authorRealName ||
    (book.alternativeNames || []).length > 0 ||
    (book.genres || []).length > 0 ||
    book.originalSource ||
    book.publicationStatus,
  );

  const chapterIndexByNumber = new Map((book.translatedChaptersList || []).map((chapter) => [chapter.chapterNumber, chapter]));

  const getChapterDisplayTitle = (chapter: Omit<ChapterContent, 'content'>) => {
    const indexedTitle = chapterIndexByNumber.get(chapter.chapterNumber)?.title?.trim() || '';
    const archivedTitle = chapter.title?.trim() || '';

    if (indexedTitle && isGenericChapterTitle(archivedTitle, book.title, chapter.chapterNumber)) {
      return indexedTitle;
    }

    return archivedTitle || indexedTitle || `Chapter ${chapter.chapterNumber}`;
  };

  const getVisitDisplayTitle = (visit: ChapterVisit) => {
    const indexedTitle = chapterIndexByNumber.get(visit.chapterNumber)?.title?.trim() || '';
    const visitTitle = visit.chapterTitle?.trim() || '';

    if (indexedTitle && isGenericChapterTitle(visitTitle, book.title, visit.chapterNumber)) {
      return indexedTitle;
    }

    return visitTitle || indexedTitle || `Chapter ${visit.chapterNumber}`;
  };

  const chapterVisitsBySession = chapterVisits.reduce<Record<string, ChapterVisit[]>>((groups, visit) => {
    if (!visit.sessionId) return groups;
    groups[visit.sessionId] = groups[visit.sessionId] || [];
    groups[visit.sessionId].push(visit);
    return groups;
  }, {});

  const standaloneChapterVisits = chapterVisits.filter((visit) => !visit.sessionId);

  const hasNotes = Boolean(
    book.review ||
    book.personalNotes ||
    book.characterNotes ||
    book.relationshipNotes ||
    book.rawLegacyEntry,
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
      <div className="flex flex-col gap-6">
        {/* Header / Quick Actions */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
              <Button asChild variant="secondary" size="sm">
                <Link href="/profile">← Back to Library</Link>
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
                  Edit My Details
                </Button>
                <Button variant="danger" size="sm" onClick={handleRemoveClick} disabled={!canRemoveLibrary}>
                  Remove from Library
                </Button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mt-4">
              <div className="w-[120px] h-[170px] shrink-0 rounded-md border border-border bg-surface-muted overflow-hidden">
                {coverSrc ? (
                  <img src={coverSrc} alt={book.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-2xl font-black text-primary/50">
                    {book.title.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <h1 className="text-2xl font-extrabold leading-tight text-foreground">{book.title}</h1>
                <p className="text-sm text-copy font-semibold">By {displayAuthor}</p>

                <div className="flex flex-wrap gap-2 items-center">
                  <Badge variant={getStatusBadgeVariant(book.status)}>
                    {(book.status ?? 'unknown').replace('_', ' ')}
                  </Badge>
                  {book.rating > 0 && (
                    <span className="text-sm text-warning font-bold">
                      {'★'.repeat(book.rating)}
                      <span className="text-xs text-muted-copy ml-1">({book.rating}/5)</span>
                    </span>
                  )}
                  {book.completedAt && (
                    <span className="text-xs text-muted-copy">
                      Completed {new Date(book.completedAt).toLocaleString()}
                    </span>
                  )}
                </div>

                {(book.personalTags || []).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {book.personalTags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-[0.62rem]">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="mt-1">
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-copy">Reading progress</span>
                    <span className="text-primary">
                      {book.chaptersRead ?? 0} / {book.translatedChaptersTotal || '?'} chapters ({readPercent}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-surface-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${readPercent}%` }}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-1">
                  <Button asChild size="sm" className="bg-primary text-background hover:bg-primary-hover">
                    <Link href={`/books/${bookId}/reader/${resumeChapter}`}>Continue Reading</Link>
                  </Button>
                  {book.sourceUrl && (
                    <Button asChild variant="ghost" size="sm">
                      <a href={book.sourceUrl} target="_blank" rel="noreferrer" className="text-primary hover:text-primary-hover">
                        Original Website
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Source Metadata */}
        {hasSourceMetadata && (
          <Card>
            <CardHeader>
              <CardTitle>Source Metadata</CardTitle>
              <CardDescription>Catalog details for this book.</CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {book.authorRealName && (
                  <Field label="Author Real Name" className="sm:col-span-2">
                    <span className="text-sm font-semibold text-foreground">{book.authorRealName}</span>
                  </Field>
                )}
                {(book.alternativeNames || []).length > 0 && (
                  <Field label="Alternative Names" className="sm:col-span-2">
                    <span className="text-sm text-copy">{book.alternativeNames.join(', ')}</span>
                  </Field>
                )}
                {(book.genres || []).length > 0 && (
                  <Field label="Genres" className="sm:col-span-2">
                    <div className="flex flex-wrap gap-1">
                      {book.genres.map((genre) => (
                        <Badge key={genre} variant="outline" className="text-[0.62rem]">
                          {genre}
                        </Badge>
                      ))}
                    </div>
                  </Field>
                )}
                <Field label="Book Source">
                  <span className="text-sm text-copy">
                    {book.originalSource || '—'}
                  </span>
                </Field>
                <Field label="Publication Status">
                  <span className="text-sm font-semibold text-foreground">
                    {book.publicationStatus || '—'}
                  </span>
                </Field>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Synopsis */}
        <Card>
          <CardHeader>
            <CardTitle>Synopsis</CardTitle>
            <CardDescription>A summary of the story.</CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <p className="text-sm text-copy leading-relaxed whitespace-pre-line">
              {book.description || 'No description scraped yet.'}
            </p>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>My Notes</CardTitle>
            <CardDescription>Review, notes, and legacy entry.</CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            {hasNotes ? (
              <div className="space-y-4">
                {book.review && (
                  <div className="border-t border-border first:border-t-0 pt-4 first:pt-0">
                    <h4 className="text-sm font-extrabold text-foreground mb-1">My Review</h4>
                    <p className="text-sm text-copy italic whitespace-pre-line">&ldquo;{book.review}&rdquo;</p>
                  </div>
                )}
                {book.personalNotes && (
                  <div className="border-t border-border first:border-t-0 pt-4 first:pt-0">
                    <h4 className="text-sm font-extrabold text-foreground mb-1">Personal Reading Notes</h4>
                    <p className="text-sm text-copy whitespace-pre-line">{book.personalNotes}</p>
                  </div>
                )}
                {book.characterNotes && (
                  <div className="border-t border-border first:border-t-0 pt-4 first:pt-0">
                    <h4 className="text-sm font-extrabold text-foreground mb-1">Character Notes</h4>
                    <p className="text-sm text-copy whitespace-pre-line">{book.characterNotes}</p>
                  </div>
                )}
                {book.relationshipNotes && (
                  <div className="border-t border-border first:border-t-0 pt-4 first:pt-0">
                    <h4 className="text-sm font-extrabold text-foreground mb-1">Relationship Notes</h4>
                    <p className="text-sm text-copy whitespace-pre-line">{book.relationshipNotes}</p>
                  </div>
                )}
                {book.rawLegacyEntry && (
                  <div className="border-t border-border first:border-t-0 pt-4 first:pt-0">
                    <h4 className="text-sm font-extrabold text-foreground mb-1">Original Legacy Entry</h4>
                    <p className="text-sm text-copy whitespace-pre-line">{book.rawLegacyEntry}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-copy italic">No custom notes stored yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Re-reading Logs */}
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Re-reading Logs</CardTitle>
              <CardDescription>Track focused re-reads of this book.</CardDescription>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setIsSessionModalOpen(true)}>
              + Log Session
            </Button>
          </CardHeader>
          <CardContent className="p-4">
            {sessions.length === 0 && standaloneChapterVisits.length === 0 && (
              <p className="text-sm text-muted-copy italic">No re-read logs or standalone visits exist for this book yet.</p>
            )}

            {sessions.length > 0 && (
              <div className="flex flex-col gap-3">
                {sessions.map((sess) => (
                  <Card key={sess._id} className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant={sess.completed ? 'completed' : 'reading'}>
                        {sess.completed ? 'Completed' : 'Active Re-read'}
                      </Badge>
                      <span className="text-xs text-muted-copy">
                        {new Date(sess.startDate).toLocaleDateString()}
                        {sess.endDate ? ` - ${new Date(sess.endDate).toLocaleDateString()}` : ''}
                      </span>
                    </div>

                    {sess.notes && (
                      <p className="text-sm text-copy mt-2">
                        <span className="font-semibold">Notes:</span> {sess.notes}
                      </p>
                    )}

                    {(chapterVisitsBySession[sess._id] || []).length > 0 && (
                      <div className="flex flex-col gap-1 mt-2">
                        <span className="text-xs font-extrabold uppercase text-muted-copy">Chapter Opens</span>
                        {(chapterVisitsBySession[sess._id] || []).slice(0, 5).map((visit) => (
                          <Link
                            key={visit._id}
                            href={`/books/${bookId}/reader/${visit.chapterNumber}`}
                            className="text-xs text-copy hover:text-primary transition-colors"
                          >
                            Ch. {visit.chapterNumber}: {getVisitDisplayTitle(visit)}
                            <span className="text-muted-copy"> · {new Date(visit.openedAt).toLocaleString()}</span>
                          </Link>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between border-t border-border pt-2 mt-2">
                      <span className="text-xs text-muted-copy">
                        Chapters Read: <strong className="text-foreground">{sess.chaptersRead}</strong>
                      </span>
                      {!sess.completed && (
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => handleUpdateSessionProgress(sess, false)}
                          >
                            -
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => handleUpdateSessionProgress(sess, true)}
                          >
                            +
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 bg-success hover:bg-success/90 text-white"
                            onClick={() => handleCompleteSession(sess)}
                          >
                            Complete
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {standaloneChapterVisits.length > 0 && (
              <div className={sessions.length > 0 ? 'border-t border-border pt-4 mt-4' : ''}>
                <h4 className="text-sm font-extrabold text-foreground mb-2">Recent Standalone Revisits</h4>
                <div className="flex flex-col gap-1">
                  {standaloneChapterVisits.slice(0, 8).map((visit) => (
                    <Link
                      key={visit._id}
                      href={`/books/${bookId}/reader/${visit.chapterNumber}`}
                      className="text-xs text-copy hover:text-primary transition-colors"
                    >
                      Ch. {visit.chapterNumber}: {getVisitDisplayTitle(visit)}
                      <span className="text-muted-copy"> · {new Date(visit.openedAt).toLocaleString()}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Table of Contents */}
      <div className="flex flex-col gap-6 lg:sticky lg:top-24">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Table of Contents</CardTitle>
            <CardDescription>
              Archived: {chapters.length} / {book.translatedChaptersTotal || '?'} chapters.
            </CardDescription>
          </CardHeader>
          {chapters.length === 0 ? (
            <CardContent className="p-8 text-center">
              <p className="text-sm text-muted-copy mb-4">No chapters have been archived locally yet.</p>
              <Button asChild variant="secondary" size="sm">
                <Link href={`/books/${bookId}`}>View Catalog Page</Link>
              </Button>
            </CardContent>
          ) : (
            <CardContent className="p-0">
              <div className="max-h-[520px] overflow-y-auto">
                {chapters.map((ch) => {
                  const isRead = ch.chapterNumber <= (book.chaptersRead ?? 0);
                  const chapterTitle = getChapterDisplayTitle(ch);
                  return (
                    <Link
                      key={ch._id}
                      href={`/books/${bookId}/reader/${ch.chapterNumber}`}
                      className="block"
                    >
                      <div
                        className={`flex items-center justify-between gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-surface-muted transition-colors ${
                          isRead ? 'bg-surface-muted text-copy' : 'bg-card text-foreground'
                        }`}
                      >
                        <span className={`min-w-0 truncate text-sm ${isRead ? 'font-medium' : 'font-semibold'}`}>
                          {chapterTitle}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-copy">
                            {new Date(ch.scrapedAt).toLocaleDateString()}
                          </span>
                          <span className={`w-2 h-2 rounded-full ${isRead ? 'bg-muted-copy' : 'bg-primary'}`} />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Edit Details Modal */}
      <Modal
        open={isEditing}
        onClose={() => setIsEditing(false)}
        title="Edit My Reading Details"
        size="full"
        contentClassName="max-w-4xl"
      >
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Reading Status">
              <Select value={editStatus} onChange={(e) => setEditStatus(e.target.value as BookStatus)}>
                <option value="reading">Reading</option>
                <option value="completed">Completed</option>
                <option value="on_hold">On Hold</option>
                <option value="dropped">Dropped</option>
                <option value="planning">Planning</option>
              </Select>
            </Field>
            <Field label="Chapters Read">
              <Input
                type="number"
                min={0}
                value={editChRead}
                onChange={(e) => setEditChRead(parseInt(e.target.value, 10) || 0)}
              />
            </Field>
            <Field label="Completed At">
              <Input
                type="datetime-local"
                value={editCompletedAt}
                onChange={(e) => setEditCompletedAt(e.target.value)}
              />
            </Field>
            <Field label="Personal Rating">
              <Select value={String(editRating)} onChange={(e) => setEditRating(parseInt(e.target.value, 10))}>
                <option value="0">Unrated</option>
                <option value="1">1 - Poor</option>
                <option value="2">2 - Average</option>
                <option value="3">3 - Good</option>
                <option value="4">4 - Excellent</option>
                <option value="5">5 - Masterpiece</option>
              </Select>
            </Field>
            <Field label="Personal Tags" className="sm:col-span-2">
              <Input
                type="text"
                value={editPersonalTags}
                onChange={(e) => setEditPersonalTags(e.target.value)}
                placeholder="Comma-separated recall/filter tags"
              />
            </Field>
            <Field label="What did you like? (Review)" className="sm:col-span-2">
              <Textarea
                rows={3}
                value={editReview}
                onChange={(e) => setEditReview(e.target.value)}
              />
            </Field>
            <Field label="Detailed Notes" className="sm:col-span-2">
              <Textarea
                rows={4}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </Field>
            <Field label="Original Legacy Entry" className="sm:col-span-2">
              <Textarea
                rows={3}
                value={editRawLegacyEntry}
                onChange={(e) => setEditRawLegacyEntry(e.target.value)}
                placeholder="Paste the old full record here so nothing is lost."
              />
            </Field>
            <Field label="Character Notes" className="sm:col-span-2">
              <Textarea
                rows={4}
                value={editCharacterNotes}
                onChange={(e) => setEditCharacterNotes(e.target.value)}
                placeholder="Names, aliases, role, powers, important memory hooks..."
              />
            </Field>
            <Field label="Relationship Notes" className="sm:col-span-2">
              <Textarea
                rows={4}
                value={editRelationshipNotes}
                onChange={(e) => setEditRelationshipNotes(e.target.value)}
                placeholder="Character relationships, romance, factions, family, enemies..."
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button type="button" variant="secondary" onClick={() => setIsEditing(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Spinner size="sm" />
                  Saving...
                </>
              ) : (
                'Save Updates'
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Log Session Modal */}
      <Modal
        open={isSessionModalOpen}
        onClose={() => setIsSessionModalOpen(false)}
        title="Log Re-reading Session"
        size="sm"
      >
        <form onSubmit={handleStartSession} className="flex flex-col gap-4">
          <Field label="Starting Chapter Progress">
            <Input
              type="number"
              min={0}
              value={sessionChRead}
              onChange={(e) => setSessionChRead(Math.max(0, parseInt(e.target.value, 10) || 0))}
            />
          </Field>
          <Field label="Initial Session Notes">
            <Textarea
              rows={3}
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              placeholder="e.g. Re-reading my favorite arc starting at volume 3."
              required
            />
          </Field>
          <div className="flex justify-end gap-2 mt-2">
            <Button type="button" variant="secondary" onClick={() => setIsSessionModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Start Session</Button>
          </div>
        </form>
      </Modal>

      {/* Remove Modal */}
      <Modal
        open={isRemoveModalOpen}
        onClose={() => setIsRemoveModalOpen(false)}
        title="Remove from library?"
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-copy">
            Remove this book from your profile library? The shared catalog and archived chapters will stay in the system.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsRemoveModalOpen(false)} disabled={removing}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmRemove} disabled={removing}>
              {removing ? 'Removing...' : 'Remove'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
