'use client';
import { cn } from '../../lib/utils';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, Book, BookStatus } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { BookCard } from '../../components/BookCard';
import { CAPABILITY } from '../../utils/permissions';
import { Button } from '../../components/ui/button';
import { Input, Select } from '../../components/ui/input';
import { Spinner } from '../../components/ui/spinner';

export default function Dashboard() {
  const { user, loading: authLoading, hasCapability } = useAuth();
  
  // Library state
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newCoverUrl, setNewCoverUrl] = useState('');
  const [newRawSourceUrl, setNewRawSourceUrl] = useState('');
  const [newRawOriginalLanguage, setNewRawOriginalLanguage] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch books list
  const fetchBooks = async () => {
    try {
      const data = await api.getBooks();
      setBooks(data);
    } catch (err) {
      console.error('Failed to load books:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function loadBooks() {
      try {
        const data = await api.getBooks();
        if (!cancelled) setBooks(data);
      } catch (err) {
        if (!cancelled) console.error('Failed to load books:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadBooks();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Quick increment chaptersRead
  const handleQuickIncrement = async (e: React.MouseEvent, book: Book) => {
    e.preventDefault(); // Prevent navigating to details link
    e.stopPropagation();
    
    const nextCh = book.chaptersRead + 1;
    // Optimistic UI update
    setBooks(prev => prev.map(n => {
      if (n._id === book._id) {
        let updatedStatus = n.status;
        if (n.translatedChaptersTotal > 0 && nextCh >= n.translatedChaptersTotal) {
          updatedStatus = 'completed';
        }
        return { ...n, chaptersRead: nextCh, status: updatedStatus as BookStatus };
      }
      return n;
    }));

    try {
      await api.updateBook(book._id, { chaptersRead: nextCh });
    } catch (err) {
      console.error('Failed to update chapters read:', err);
      // Rollback on error
      fetchBooks();
    }
  };

  // Create book submit
  const handleCreateBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    
    if (newUrl && !newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
      setSubmitError('Please enter a valid HTTP/HTTPS URL.');
      return;
    }
    if (newCoverUrl && !newCoverUrl.startsWith('http://') && !newCoverUrl.startsWith('https://')) {
      setSubmitError('Please enter a valid HTTP/HTTPS cover URL.');
      return;
    }
    if (newRawSourceUrl && !newRawSourceUrl.startsWith('http://') && !newRawSourceUrl.startsWith('https://')) {
      setSubmitError('Please enter a valid HTTP/HTTPS raw source URL.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await api.createBook({
        title: newTitle,
        author: newAuthor,
        sourceUrl: newUrl,
        coverUrl: newCoverUrl,
        rawSourceUrl: newRawSourceUrl,
        rawOriginalLanguage: newRawOriginalLanguage,
      });

      // Reset form & reload
      setNewTitle('');
      setNewAuthor('');
      setNewUrl('');
      setNewCoverUrl('');
      setNewRawSourceUrl('');
      setNewRawOriginalLanguage('');
      setIsModalOpen(false);
      window.location.href = `/books/${created._id}`;
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create book entry.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filters logic
  const filteredBooks = books.filter((book) => {
    const query = search.toLowerCase();
    const matchQuery = book.title.toLowerCase().includes(search.toLowerCase()) || 
                       (book.authorPenName || book.author || book.authorRealName || 'Unknown Author').toLowerCase().includes(query) ||
                       (book.alternativeNames || []).some((name) => name.toLowerCase().includes(query)) ||
                       (book.genres || []).some((genre) => genre.toLowerCase().includes(query)) ||
                       (book.personalTags || []).some((tag) => tag.toLowerCase().includes(query)) ||
                       (book.characterNotes || '').toLowerCase().includes(query) ||
                       (book.relationshipNotes || '').toLowerCase().includes(query);
    const matchStatus = statusFilter === 'all' || book.status === statusFilter;
    return matchQuery && matchStatus;
  });
  const stats = {
    total: books.length,
    reading: books.filter((book) => book.status === 'reading').length,
    completed: books.filter((book) => book.status === 'completed').length,
    rawReady: books.filter((book) => Boolean(book.rawSourceUrl || book.rawChaptersTotal > 0)).length,
  };

  if (authLoading || loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <Spinner size="xl" />
          <span style={{ color: 'var(--text-secondary)' }}>Loading library database...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("mx-auto w-full max-w-[1520px] px-5 pt-6 pb-12", "flex flex-col gap-5")}>
      <div className="flex items-end justify-between gap-4 py-1">
        <div>
          <h1 className="text-[clamp(1.55rem,3vw,2.2rem)] leading-tight mb-1">Personal Library</h1>
          <p className="text-copy max-w-[720px]">
            Track reading status, personal notes, rereads, characters, and recall details.
          </p>
        </div>
        {hasCapability(CAPABILITY.BOOKS_CREATE) ? (
          <Button onClick={() => setIsModalOpen(true)}>
            + Create Catalog Book
          </Button>
        ) : (
          <Button asChild>
            <Link href="/">Browse Catalog</Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
        <div className="rounded-lg border border-border bg-card shadow-card transition hover:border-border-hover hover:bg-card-hover hover:shadow-elevated p-4">
          <div className="text-xs font-bold uppercase tracking-normal text-muted-copy mb-1">Total</div>
          <div className="text-2xl font-extrabold">{stats.total}</div>
        </div>
        <div className="rounded-lg border border-border bg-card shadow-card transition hover:border-border-hover hover:bg-card-hover hover:shadow-elevated p-4">
          <div className="text-xs font-bold uppercase tracking-normal text-muted-copy mb-1">Reading</div>
          <div className="text-2xl font-extrabold">{stats.reading}</div>
        </div>
        <div className="rounded-lg border border-border bg-card shadow-card transition hover:border-border-hover hover:bg-card-hover hover:shadow-elevated p-4">
          <div className="text-xs font-bold uppercase tracking-normal text-muted-copy mb-1">Completed</div>
          <div className="text-2xl font-extrabold">{stats.completed}</div>
        </div>
        <div className="rounded-lg border border-border bg-card shadow-card transition hover:border-border-hover hover:bg-card-hover hover:shadow-elevated p-4">
          <div className="text-xs font-bold uppercase tracking-normal text-muted-copy mb-1">Raw Sources</div>
          <div className="text-2xl font-extrabold">{stats.rawReady}</div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card shadow-card transition hover:border-border-hover hover:bg-card-hover hover:shadow-elevated flex flex-wrap items-center gap-4 p-3.5">
        <div style={{ flex: 1, minWidth: '280px' }}>
          <Input type="text" 
             
            placeholder="Search title, author, genre, notes, characters..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
         />
        </div>
        <div style={{ minWidth: '180px' }}>
          <Select value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="reading">📖 Reading</option>
            <option value="completed">✅ Completed</option>
            <option value="on_hold">⏳ On Hold</option>
            <option value="dropped">🛑 Dropped</option>
            <option value="planning">📋 Planning</option>
          </Select>
        </div>
      </div>

      {filteredBooks.length === 0 ? (
        <div className="rounded-lg border border-border bg-card shadow-card transition hover:border-border-hover hover:bg-card-hover hover:shadow-elevated p-12 text-center text-copy">
          <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            {search || statusFilter !== 'all' ? 'No books match your filter query.' : 'Your reading library is empty.'}
          </p>
          {hasCapability(CAPABILITY.BOOKS_CREATE) ? (
            <Button onClick={() => setIsModalOpen(true)}>
              + Create Catalog Book
            </Button>
          ) : (
            <Button asChild>
              <Link href="/">Browse Catalog</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,250px))] gap-3.5">
          {filteredBooks.map((book) => (
            <BookCard key={book._id}
              book={book}
              href={`/books/${book._id}`}
              action={
                <Button variant="secondary"
                  size="sm"
                  className="h-[30px] min-h-0 px-2 py-1 text-[0.75rem]"
                  onClick={(e) => handleQuickIncrement(e, book)}
                >
                  +1
                </Button>
              }
           />
          ))}
        </div>
      )}

      {/* Add Book Dialog Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[8px]">
          <div className="flex w-full max-w-[640px] max-h-[90vh] flex-col gap-5 overflow-auto rounded-lg border border-border bg-card p-5 shadow-lg">
            <div className="flex items-center justify-between gap-4">
              <h2 style={{ fontSize: '1.5rem' }}>Create Catalog Book</h2>
              <button onClick={() => { setIsModalOpen(false); setSubmitError(''); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            {submitError && (
              <div style={{ 
                backgroundColor: 'rgba(239, 68, 68, 0.12)', 
                border: '1px solid rgba(239, 68, 68, 0.25)', 
                color: 'var(--danger)', 
                padding: '0.75rem 1.25rem', 
                borderRadius: 'var(--radius-md)', 
                fontSize: '0.875rem' 
              }}>
                {submitError}
              </div>
            )}

            <form onSubmit={handleCreateBook} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }} noValidate>
              
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-copy">Book Web Link (Optional - for automated background scraping)</label>
                <Input type="url" 
                   
                  placeholder="https://example.com/book/title"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
               />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                  If provided, our background crawler will download and archive metadata & chapters automatically.
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-copy">Cover Image URL (Optional)</label>
                <Input type="url"
                  
                  placeholder="https://example.com/covers/title.jpg"
                  value={newCoverUrl}
                  onChange={(e) => setNewCoverUrl(e.target.value)}
               />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                  Add this for manual entries, then use Sync Cover from the book page to cache it locally.
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.5fr_1fr]">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-copy">Raw Source URL (Optional)</label>
                  <Input type="url"
                    
                    placeholder="Original-language source URL"
                    value={newRawSourceUrl}
                    onChange={(e) => setNewRawSourceUrl(e.target.value)}
                 />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-copy">Raw Language</label>
                  <Input type="text"
                    
                    placeholder="Chinese"
                    value={newRawOriginalLanguage}
                    onChange={(e) => setNewRawOriginalLanguage(e.target.value)}
                 />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-copy">Title {newUrl ? '(Optional)' : '(Required)'}</label>
                  <Input type="text" 
                     
                    placeholder={newUrl ? 'Fetched automatically' : 'e.g. Lord of the Mysteries'}
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required={!newUrl}
                 />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-copy">Author (Optional)</label>
                  <Input type="text" 
                     
                    placeholder={newUrl ? 'Fetched automatically' : 'e.g. Cuttlefish'}
                    value={newAuthor}
                    onChange={(e) => setNewAuthor(e.target.value)}
                 />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                <Button type="button"
                  variant="secondary"
                  onClick={() => { setIsModalOpen(false); setSubmitError(''); }}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit"
                  disabled={submitting}
                >
                  {submitting ? <Spinner size="sm" /> : 'Create Catalog Book'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
