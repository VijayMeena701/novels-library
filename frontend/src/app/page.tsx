'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { BookOpen, BookText, Headphones, Library, Search, Sparkles, TrendingUp, ArrowRight } from 'lucide-react';
import { api, type Book, type HomeResponse } from '../utils/api';
import { BookCard } from '../components/BookCard';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';

function byNewest(a: Book, b: Book) {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

function byChapterCount(a: Book, b: Book) {
  const aTotal = a.translatedChaptersTotal || a.translatedChaptersList?.length || 0;
  const bTotal = b.translatedChaptersTotal || b.translatedChaptersList?.length || 0;
  return bTotal - aTotal;
}

function byRating(a: Book, b: Book) {
  return (b.rating || 0) - (a.rating || 0);
}

function getAuthor(book: Book): string {
  return book.authorPenName || book.author || book.authorRealName || 'Unknown Author';
}

function getChapterCount(book: Book): number {
  return book.translatedChaptersTotal || book.translatedChaptersList?.length || 0;
}

function stableBookOrder(book: Book): number {
  return book._id.split("").reduce((hash, character) => ((hash << 5) - hash + character.charCodeAt(0)) | 0, 0);
}

const FEATURES = [
  {
    icon: BookOpen,
    title: 'Track Progress',
    description: 'Keep tabs on every book you are reading, rereading, or planning to finish.',
  },
  {
    icon: BookText,
    title: 'Clean Reader',
    description: 'A distraction-free chapter reader with custom fonts and themes.',
  },
  {
    icon: Headphones,
    title: 'Text-to-Speech',
    description: 'Listen to chapters with built-in TTS, pronunciation rules, and skip lists.',
  },
  {
    icon: Library,
    title: 'Auto Archive',
    description: 'Background jobs scrape and archive chapters so they are available offline.',
  },
];

export default function PublicHomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [libraryBooks, setLibraryBooks] = useState<Book[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [home, setHome] = useState<HomeResponse | null>(null);
  const [homeLoading, setHomeLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      try {
        const data = await api.getPublicCatalogBooksPaginated({ pageSize: 100 });
        if (!cancelled) setBooks(Array.isArray(data) ? data : data.books || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function loadLibrary() {
      setLibraryLoading(true);
      try {
        const data = await api.getBooks();
        if (!cancelled) setLibraryBooks(data || []);
      } finally {
        if (!cancelled) setLibraryLoading(false);
      }
    }

    void loadLibrary();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    async function loadHome() {
      setHomeLoading(true);
      try {
        const data = await api.getHome();
        if (!cancelled) setHome(data);
      } finally {
        if (!cancelled) setHomeLoading(false);
      }
    }

    void loadHome();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const sections = useMemo(() => {
    const newest = [...books].sort(byNewest);
    const ranked = [...books].sort(byRating);
    const longReads = [...books].sort(byChapterCount);
    const completed = books.filter((book) => {
      const publicationStatusKey = (book.publicationStatus || '').toLowerCase().replace(/\s+/g, '_');
      return publicationStatusKey === 'completed' || (book.publicationStatus || '').toLowerCase() === 'completed';
    });
    const recent = newest.slice(0, 12);
    const random = [...books].sort((a, b) => stableBookOrder(a) - stableBookOrder(b));
    const genres = Array.from(new Set(books.flatMap((book) => book.genres || []).filter(Boolean)));
    const totalChapters = books.reduce((sum, book) => sum + getChapterCount(book), 0);

    return {
      newest: newest.slice(0, 6),
      ranked: ranked.slice(0, 5),
      longReads: longReads.slice(0, 5),
      completed: completed.slice(0, 5),
      recent,
      random: random.slice(0, 5),
      genres: genres.slice(0, 12),
      totalChapters,
    };
  }, [books]);

  const spotlightBook = useMemo(() => {
    return sections.ranked[0] || sections.newest[0];
  }, [sections.ranked, sections.newest]);

  const userSections = useMemo(() => {
    const byUpdated = [...libraryBooks].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const byRating = [...libraryBooks].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    return {
      continueReading: home?.continueReading.length ? home.continueReading : byUpdated.filter((n) => n.status === 'reading' && n.chaptersRead > 0 && n.chaptersRead < (n.translatedChaptersTotal || n.translatedChaptersList?.length || 0)).slice(0, 6),
      planning: byUpdated.filter((n) => n.status === 'planning').slice(0, 6),
      completed: byUpdated.filter((n) => n.status === 'completed').slice(0, 6),
      topRated: byRating.filter((n) => (n.rating || 0) > 0).slice(0, 6),
    };
  }, [libraryBooks, home]);

  const showLongReads = books.length > 4;

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    const query = search.trim();
    if (query) {
      router.push(`/books?search=${encodeURIComponent(query)}`);
    }
  };

  if (loading) {
    return (
      <div className="container flex flex-1 items-center justify-center py-24">
        <div className="flex flex-col items-center gap-4">
          <div className="spinner" style={{ width: 40, height: 40 }} />
          <span className="text-sm text-muted-copy">Loading the library...</span>
        </div>
      </div>
    );
  }

  if (!books.length) {
    return (
      <div className="container py-12">
        <Card className="mx-auto max-w-2xl p-8 text-center">
          <h1 className="font-serif text-3xl font-medium text-foreground">Books Library</h1>
          <p className="mt-2 text-base text-muted-copy">The catalog is empty right now.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/books">Browse Catalog</Link>
            </Button>
            {user?.role === 'admin' && (
              <Button asChild size="lg" variant="secondary">
                <Link href="/profile">Add a Book</Link>
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="grid gap-6 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_340px] items-start">
      <main className="flex flex-col gap-6">
        <Card className="relative overflow-hidden p-6 lg:p-8">
          <div className="relative z-10 flex max-w-3xl flex-col gap-5 text-center sm:text-left">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-copy">Personal Web Book Library</span>
            <h1 className="font-serif text-3xl font-medium leading-tight text-foreground lg:text-4xl">
              Read, track, and archive web books in one place.
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-copy">
              Discover translated and raw web books, keep your reading progress, and let the background crawler archive chapters automatically.
            </p>
            <form className="flex w-full max-w-xl flex-col gap-2 sm:flex-row" onSubmit={handleSearch}>
              <Input
                type="text"
                placeholder="Search books, authors, or genres..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Button type="submit" className="shrink-0 gap-2">
                <Search className="size-4" />
                <span>Search</span>
              </Button>
            </form>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/books">Browse Catalog</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href={user ? '/profile' : '/login'}>{user ? 'Open Library' : 'Login to Track'}</Link>
              </Button>
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <div className="min-w-[80px] rounded-md border border-border bg-surface px-3 py-2 text-center">
                <strong className="block text-lg font-semibold leading-none text-foreground">{home?.stats.totalBooks ?? books.length}</strong>
                <span className="mt-1 block text-[0.65rem] font-bold uppercase tracking-wider text-muted-copy">Books</span>
              </div>
              <div className="min-w-[80px] rounded-md border border-border bg-surface px-3 py-2 text-center">
                <strong className="block text-lg font-semibold leading-none text-foreground">{home?.stats.totalChapters ?? sections.totalChapters}</strong>
                <span className="mt-1 block text-[0.65rem] font-bold uppercase tracking-wider text-muted-copy">Chapters</span>
              </div>
              <div className="min-w-[80px] rounded-md border border-border bg-surface px-3 py-2 text-center">
                <strong className="block text-lg font-semibold leading-none text-foreground">{sections.completed.length}</strong>
                <span className="mt-1 block text-[0.65rem] font-bold uppercase tracking-wider text-muted-copy">Completed</span>
              </div>
            </div>
          </div>
        </Card>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <Card key={feature.title} className="p-5 transition-shadow hover:shadow-elevated">
              <feature.icon className="size-8 text-primary/70" />
              <h3 className="mt-3 text-sm font-semibold text-foreground">{feature.title}</h3>
              <p className="mt-1 text-sm text-muted-copy leading-relaxed">{feature.description}</p>
            </Card>
          ))}
        </section>

        {user && !libraryLoading && (
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-serif text-xl font-medium text-foreground">Your Library</h2>
              <div className="flex items-center gap-4">
                <Link href="/history" className="text-sm font-semibold text-primary hover:underline">
                  History
                </Link>
                <Link href="/profile" className="text-sm font-semibold text-primary hover:underline">
                  Open Library <ArrowRight className="inline size-4" />
                </Link>
              </div>
            </div>
            <Card className="p-5">
              <div className="flex flex-col gap-6">
                {userSections.continueReading.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-copy">Continue Reading</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {userSections.continueReading.map((book) => (
                        <BookCard key={book._id} book={book} mode="profile" href={`/books/${book._id}`} />
                      ))}
                    </div>
                  </div>
                )}
                {userSections.planning.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-copy">Plan to Read</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {userSections.planning.map((book) => (
                        <BookCard key={book._id} book={book} mode="profile" href={`/books/${book._id}`} />
                      ))}
                    </div>
                  </div>
                )}
                {userSections.completed.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-copy">Completed</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {userSections.completed.map((book) => (
                        <BookCard key={book._id} book={book} mode="profile" href={`/books/${book._id}`} />
                      ))}
                    </div>
                  </div>
                )}
                {userSections.topRated.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-copy">Top Rated</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {userSections.topRated.map((book) => (
                        <BookCard key={book._id} book={book} mode="profile" href={`/books/${book._id}`} />
                      ))}
                    </div>
                  </div>
                )}
                {libraryBooks.length === 0 && (
                  <p className="text-sm text-muted-copy">Your library is empty. Browse the catalog to add books.</p>
                )}
              </div>
            </Card>
          </section>
        )}

        {spotlightBook && (
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-serif text-xl font-medium text-foreground">Featured Pick</h2>
            </div>
            <Card className="overflow-hidden p-0">
              <div className="grid md:grid-cols-[180px_1fr]">
                <div className="relative min-h-[240px] bg-gradient-to-br from-surface to-surface-muted">
                  <Link href={`/books/${spotlightBook._id}`} className="absolute inset-0">
                    <Image
                      src={spotlightBook.coverUrl || '/placeholder.svg'}
                      alt={spotlightBook.title}
                      width={180}
                      height={240}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                  </Link>
                </div>
                <div className="flex flex-col gap-3 p-6">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-copy">
                    <Sparkles className="size-3.5" /> Featured Pick
                  </span>
                  <h3 className="font-serif text-2xl font-medium text-foreground">
                    <Link href={`/books/${spotlightBook._id}`}>{spotlightBook.title}</Link>
                  </h3>
                  <p className="text-sm text-muted-copy">by {getAuthor(spotlightBook)}</p>
                  <p className="line-clamp-3 text-sm leading-relaxed text-copy">
                    {spotlightBook.description || 'No summary available yet.'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {spotlightBook.publicationStatus && <Badge variant="outline">{spotlightBook.publicationStatus}</Badge>}
                    {(spotlightBook.genres || []).slice(0, 3).map((genre) => (
                      <Badge key={genre} variant="outline">{genre}</Badge>
                    ))}
                  </div>
                  <div className="mt-auto">
                    <Button asChild variant="secondary">
                      <Link href={`/books/${spotlightBook._id}`}>View Book</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </section>
        )}

        {sections.newest.length > 0 && (
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-serif text-xl font-medium text-foreground">New Arrivals</h2>
              <Link href="/books" className="text-sm font-semibold text-primary hover:underline">
                View all <ArrowRight className="inline size-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {sections.newest.map((book) => (
                <BookCard key={book._id} book={book} mode="catalog" />
              ))}
            </div>
          </section>
        )}

        {showLongReads && sections.longReads.length > 0 && (
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-serif text-xl font-medium text-foreground">Long Reads</h2>
              <Link href="/books?sort=translatedChaptersTotal" className="text-sm font-semibold text-primary hover:underline">
                View all <ArrowRight className="inline size-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {sections.longReads.map((book) => (
                <BookCard key={book._id} book={book} mode="catalog" />
              ))}
            </div>
          </section>
        )}

        {home?.topVoted && home.topVoted.length > 0 && (
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-serif text-xl font-medium text-foreground">Top Voted</h2>
              <Link href="/books?sort=votes" className="text-sm font-semibold text-primary hover:underline">
                View all <ArrowRight className="inline size-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {home.topVoted.map((book) => (
                <BookCard key={book._id} book={book} mode="catalog" />
              ))}
            </div>
          </section>
        )}

        {home?.mostVisited && home.mostVisited.length > 0 && (
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-serif text-xl font-medium text-foreground">Most Visited</h2>
              <Link href="/books?sort=visits" className="text-sm font-semibold text-primary hover:underline">
                View all <ArrowRight className="inline size-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {home.mostVisited.map((book) => (
                <BookCard key={book._id} book={book} mode="catalog" />
              ))}
            </div>
          </section>
        )}

        {sections.recent.length > 0 && (
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-serif text-xl font-medium text-foreground">Recent Updates</h2>
            </div>
            <Card className="divide-y divide-border overflow-hidden">
              {sections.recent.map((book) => (
                <Link key={book._id} href={`/books/${book._id}`} className="group flex items-center justify-between gap-4 px-4 py-3 transition hover:bg-surface-muted">
                  <div className="min-w-0">
                    <strong className="block truncate text-sm font-semibold text-foreground group-hover:text-primary">{book.title}</strong>
                    <span className="text-xs text-muted-copy">{getAuthor(book)}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-4 text-xs text-muted-copy">
                    <span className="hidden sm:inline">{new Date(book.updatedAt).toLocaleDateString()}</span>
                    <span>{getChapterCount(book)} chapters</span>
                  </div>
                </Link>
              ))}
            </Card>
          </section>
        )}
      </main>

      <aside className="sticky top-24 self-start flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2 font-serif text-base font-medium">
              <TrendingUp className="size-4" /> Trending
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-0">
            {sections.ranked.map((book, index) => (
              <Link key={book._id} href={`/books/${book._id}`} className="group flex items-center gap-3 border-b border-border py-2.5 transition last:border-b-0 hover:pl-1">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-surface text-xs font-bold text-muted-copy">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <strong className="block truncate text-sm font-semibold text-foreground group-hover:text-primary">{book.title}</strong>
                  <small className="text-xs text-muted-copy">{getAuthor(book)}</small>
                </div>
                <small className="text-xs font-semibold text-muted-copy">{(book.rating || 0).toFixed(1)}</small>
              </Link>
            ))}
          </CardContent>
        </Card>

        {sections.genres.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-base font-medium">Genres</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {sections.genres.map((genre) => (
                <Link key={genre} href={`/genres/${encodeURIComponent(genre)}`}>
                  <Badge variant="outline">{genre}</Badge>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

        {sections.completed.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-base font-medium">Completed</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-0">
              {sections.completed.map((book) => (
                <Link key={book._id} href={`/books/${book._id}`} className="group flex flex-col gap-0.5 border-b border-border py-2.5 transition last:border-b-0 hover:pl-1">
                  <strong className="truncate text-sm font-semibold text-foreground group-hover:text-primary">{book.title}</strong>
                  <small className="text-xs text-muted-copy">{getAuthor(book)}</small>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

        {sections.random.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-base font-medium">Random</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-0">
              {sections.random.map((book) => (
                <Link key={book._id} href={`/books/${book._id}`} className="group flex flex-col gap-0.5 border-b border-border py-2.5 transition last:border-b-0 hover:pl-1">
                  <strong className="truncate text-sm font-semibold text-foreground group-hover:text-primary">{book.title}</strong>
                  <small className="text-xs text-muted-copy">{getAuthor(book)}</small>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}
      </aside>
      </div>
    </div>
  );
}
