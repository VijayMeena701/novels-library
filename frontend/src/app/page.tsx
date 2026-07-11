'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { BookOpen, BookText, Headphones, Library, Search, Sparkles, TrendingUp, ArrowRight } from 'lucide-react';
import { api, type Novel } from '../utils/api';
import { NovelCard } from '../components/NovelCard';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';

function byNewest(a: Novel, b: Novel) {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

function byChapterCount(a: Novel, b: Novel) {
  const aTotal = a.chaptersTotal || a.chaptersList?.length || 0;
  const bTotal = b.chaptersTotal || b.chaptersList?.length || 0;
  return bTotal - aTotal;
}

function byRating(a: Novel, b: Novel) {
  return (b.rating || 0) - (a.rating || 0);
}

function getAuthor(novel: Novel): string {
  return novel.authorPenName || novel.author || novel.authorRealName || 'Unknown Author';
}

function getChapterCount(novel: Novel): number {
  return novel.chaptersTotal || novel.chaptersList?.length || 0;
}

const FEATURES = [
  {
    icon: BookOpen,
    title: 'Track Progress',
    description: 'Keep tabs on every novel you are reading, rereading, or planning to finish.',
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
  const [novels, setNovels] = useState<Novel[]>([]);
  const [loading, setLoading] = useState(true);
  const [libraryNovels, setLibraryNovels] = useState<Novel[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getPublicCatalogNovelsPaginated({ pageSize: 100 })
      .then((data) => {
        if (!cancelled) {
          setNovels(Array.isArray(data) ? data : data.novels || []);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setLibraryNovels([]);
      return;
    }
    setLibraryLoading(true);
    api.getNovels()
      .then((data) => {
        if (!cancelled) {
          setLibraryNovels(data || []);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLibraryLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const sections = useMemo(() => {
    const newest = [...novels].sort(byNewest);
    const ranked = [...novels].sort(byRating);
    const longReads = [...novels].sort(byChapterCount);
    const completed = novels.filter((novel) => {
      const publicationStatusKey = (novel.publicationStatus || '').toLowerCase().replace(/\s+/g, '_');
      return publicationStatusKey === 'completed' || (novel.publicationStatus || '').toLowerCase() === 'completed';
    });
    const recent = newest.slice(0, 12);
    const random = [...novels].sort(() => 0.5 - Math.random());
    const genres = Array.from(new Set(novels.flatMap((novel) => novel.genres || []).filter(Boolean)));
    const totalChapters = novels.reduce((sum, novel) => sum + getChapterCount(novel), 0);

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
  }, [novels]);

  const spotlightNovel = useMemo(() => {
    return sections.ranked[0] || sections.newest[0];
  }, [sections.ranked, sections.newest]);

  const userSections = useMemo(() => {
    const byUpdated = [...libraryNovels].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const byRating = [...libraryNovels].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    return {
      continueReading: byUpdated.filter((n) => n.status === 'reading' && n.chaptersRead > 0 && n.chaptersRead < (n.chaptersTotal || n.chaptersList?.length || 0)).slice(0, 6),
      planning: byUpdated.filter((n) => n.status === 'planning').slice(0, 6),
      completed: byUpdated.filter((n) => n.status === 'completed').slice(0, 6),
      topRated: byRating.filter((n) => (n.rating || 0) > 0).slice(0, 6),
    };
  }, [libraryNovels]);

  const showLongReads = novels.length > 4;

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    const query = search.trim();
    if (query) {
      router.push(`/novels?search=${encodeURIComponent(query)}`);
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

  if (!novels.length) {
    return (
      <div className="container py-12">
        <Card className="mx-auto max-w-2xl p-8 text-center">
          <h1 className="font-serif text-3xl font-medium text-foreground">Novels Library</h1>
          <p className="mt-2 text-base text-muted-copy">The catalog is empty right now.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/novels">Browse Catalog</Link>
            </Button>
            {user?.role === 'admin' && (
              <Button asChild size="lg" variant="secondary">
                <Link href="/profile">Add a Novel</Link>
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
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-copy">Personal Web Novel Library</span>
            <h1 className="font-serif text-3xl font-medium leading-tight text-foreground lg:text-4xl">
              Read, track, and archive web novels in one place.
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-copy">
              Discover translated and raw web novels, keep your reading progress, and let the background crawler archive chapters automatically.
            </p>
            <form className="flex w-full max-w-xl flex-col gap-2 sm:flex-row" onSubmit={handleSearch}>
              <Input
                type="text"
                placeholder="Search novels, authors, or genres..."
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
                <Link href="/novels">Browse Catalog</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href={user ? '/profile' : '/login'}>{user ? 'Open Library' : 'Login to Track'}</Link>
              </Button>
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <div className="min-w-[80px] rounded-md border border-border bg-surface px-3 py-2 text-center">
                <strong className="block text-lg font-semibold leading-none text-foreground">{novels.length}</strong>
                <span className="mt-1 block text-[0.65rem] font-bold uppercase tracking-wider text-muted-copy">Novels</span>
              </div>
              <div className="min-w-[80px] rounded-md border border-border bg-surface px-3 py-2 text-center">
                <strong className="block text-lg font-semibold leading-none text-foreground">{sections.totalChapters}</strong>
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
              <Link href="/profile" className="text-sm font-semibold text-primary hover:underline">
                Open Library <ArrowRight className="inline size-4" />
              </Link>
            </div>
            <Card className="p-5">
              <div className="flex flex-col gap-6">
                {userSections.continueReading.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-copy">Continue Reading</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {userSections.continueReading.map((novel) => (
                        <NovelCard key={novel._id} novel={novel} mode="profile" href={`/profile/novels/${novel._id}`} />
                      ))}
                    </div>
                  </div>
                )}
                {userSections.planning.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-copy">Plan to Read</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {userSections.planning.map((novel) => (
                        <NovelCard key={novel._id} novel={novel} mode="profile" href={`/profile/novels/${novel._id}`} />
                      ))}
                    </div>
                  </div>
                )}
                {userSections.completed.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-copy">Completed</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {userSections.completed.map((novel) => (
                        <NovelCard key={novel._id} novel={novel} mode="profile" href={`/profile/novels/${novel._id}`} />
                      ))}
                    </div>
                  </div>
                )}
                {userSections.topRated.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-copy">Top Rated</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {userSections.topRated.map((novel) => (
                        <NovelCard key={novel._id} novel={novel} mode="profile" href={`/profile/novels/${novel._id}`} />
                      ))}
                    </div>
                  </div>
                )}
                {libraryNovels.length === 0 && (
                  <p className="text-sm text-muted-copy">Your library is empty. Browse the catalog to add novels.</p>
                )}
              </div>
            </Card>
          </section>
        )}

        {spotlightNovel && (
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-serif text-xl font-medium text-foreground">Featured Pick</h2>
            </div>
            <Card className="overflow-hidden p-0">
              <div className="grid md:grid-cols-[180px_1fr]">
                <div className="relative min-h-[240px] bg-gradient-to-br from-surface to-surface-muted">
                  <Link href={`/novels/${spotlightNovel._id}`} className="absolute inset-0">
                    <img
                      src={spotlightNovel.coverUrl || '/placeholder.svg'}
                      alt={spotlightNovel.title}
                      className="h-full w-full object-cover"
                    />
                  </Link>
                </div>
                <div className="flex flex-col gap-3 p-6">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-copy">
                    <Sparkles className="size-3.5" /> Featured Pick
                  </span>
                  <h3 className="font-serif text-2xl font-medium text-foreground">
                    <Link href={`/novels/${spotlightNovel._id}`}>{spotlightNovel.title}</Link>
                  </h3>
                  <p className="text-sm text-muted-copy">by {getAuthor(spotlightNovel)}</p>
                  <p className="line-clamp-3 text-sm leading-relaxed text-copy">
                    {spotlightNovel.description || 'No summary available yet.'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {spotlightNovel.publicationStatus && <Badge variant="outline">{spotlightNovel.publicationStatus}</Badge>}
                    {(spotlightNovel.genres || []).slice(0, 3).map((genre) => (
                      <Badge key={genre} variant="outline">{genre}</Badge>
                    ))}
                  </div>
                  <div className="mt-auto">
                    <Button asChild variant="secondary">
                      <Link href={`/novels/${spotlightNovel._id}`}>View Novel</Link>
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
              <Link href="/novels" className="text-sm font-semibold text-primary hover:underline">
                View all <ArrowRight className="inline size-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {sections.newest.map((novel) => (
                <NovelCard key={novel._id} novel={novel} mode="catalog" />
              ))}
            </div>
          </section>
        )}

        {showLongReads && sections.longReads.length > 0 && (
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-serif text-xl font-medium text-foreground">Long Reads</h2>
              <Link href="/novels?sort=chaptersTotal" className="text-sm font-semibold text-primary hover:underline">
                View all <ArrowRight className="inline size-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {sections.longReads.map((novel) => (
                <NovelCard key={novel._id} novel={novel} mode="catalog" />
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
              {sections.recent.map((novel) => (
                <Link key={novel._id} href={`/novels/${novel._id}`} className="group flex items-center justify-between gap-4 px-4 py-3 transition hover:bg-surface-muted">
                  <div className="min-w-0">
                    <strong className="block truncate text-sm font-semibold text-foreground group-hover:text-primary">{novel.title}</strong>
                    <span className="text-xs text-muted-copy">{getAuthor(novel)}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-4 text-xs text-muted-copy">
                    <span className="hidden sm:inline">{new Date(novel.updatedAt).toLocaleDateString()}</span>
                    <span>{getChapterCount(novel)} chapters</span>
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
            {sections.ranked.map((novel, index) => (
              <Link key={novel._id} href={`/novels/${novel._id}`} className="group flex items-center gap-3 border-b border-border py-2.5 transition last:border-b-0 hover:pl-1">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-surface text-xs font-bold text-muted-copy">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <strong className="block truncate text-sm font-semibold text-foreground group-hover:text-primary">{novel.title}</strong>
                  <small className="text-xs text-muted-copy">{getAuthor(novel)}</small>
                </div>
                <small className="text-xs font-semibold text-muted-copy">{(novel.rating || 0).toFixed(1)}</small>
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
              {sections.completed.map((novel) => (
                <Link key={novel._id} href={`/novels/${novel._id}`} className="group flex flex-col gap-0.5 border-b border-border py-2.5 transition last:border-b-0 hover:pl-1">
                  <strong className="truncate text-sm font-semibold text-foreground group-hover:text-primary">{novel.title}</strong>
                  <small className="text-xs text-muted-copy">{getAuthor(novel)}</small>
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
              {sections.random.map((novel) => (
                <Link key={novel._id} href={`/novels/${novel._id}`} className="group flex flex-col gap-0.5 border-b border-border py-2.5 transition last:border-b-0 hover:pl-1">
                  <strong className="truncate text-sm font-semibold text-foreground group-hover:text-primary">{novel.title}</strong>
                  <small className="text-xs text-muted-copy">{getAuthor(novel)}</small>
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
