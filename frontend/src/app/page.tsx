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
import { Card } from '../components/ui/card';

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
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getPublicCatalogNovelsPaginated({ pageSize: 100 })
      .then((data) => {
        if (!cancelled) {
          setNovels(data.novels || []);
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
          <span className="text-sm text-copy">Loading the library...</span>
        </div>
      </div>
    );
  }

  if (!novels.length) {
    return (
      <div className="container page-stack">
        <div className="glass-card empty-state">
          <h1 className="page-title">Novels Library</h1>
          <p className="page-subtitle">Your personal web novel catalogue is empty right now.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/novels">Browse Catalog</Link>
            </Button>
            {user?.role === 'admin' && (
              <Button asChild size="lg" variant="secondary">
                <Link href="/profile">Add a Novel</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container public-home">
      <section className="public-main">
        <section className="public-hero">
          <div className="public-hero-copy text-center sm:text-left">
            <span className="eyebrow">Personal Web Novel Library</span>
            <h1 className="page-title">Read, track, and archive web novels in one place.</h1>
            <p className="page-subtitle">
              Discover translated and raw web novels, keep your reading progress, and let the background crawler archive chapters automatically.
            </p>
            <form className="flex w-full max-w-xl flex-col gap-2 sm:flex-row" onSubmit={handleSearch}>
              <input
                type="text"
                className="form-input flex-1"
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
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href="/novels">Browse Catalog</Link>
              </Button>
              <Button asChild size="lg" variant="secondary" className="w-full sm:w-auto">
                <Link href={user ? '/profile' : '/login'}>{user ? 'Open Library' : 'Login to Track'}</Link>
              </Button>
            </div>
            <div className="public-hero-stats">
              <div>
                <strong>{novels.length}</strong>
                <span>Novels</span>
              </div>
              <div>
                <strong>{sections.totalChapters}</strong>
                <span>Chapters</span>
              </div>
              <div>
                <strong>{sections.completed.length}</strong>
                <span>Completed</span>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <Card key={feature.title} className="flex flex-col gap-3 p-4">
              <feature.icon className="size-10 text-primary" />
              <h3 className="text-base font-extrabold">{feature.title}</h3>
              <p className="text-sm text-copy leading-relaxed">{feature.description}</p>
            </Card>
          ))}
        </section>

        {spotlightNovel && (
          <section className="featured-novel">
            <div className="featured-cover-art">
              <Link href={`/novels/${spotlightNovel._id}`}>
                <img
                  src={spotlightNovel.coverUrl || '/placeholder.svg'}
                  alt={spotlightNovel.title}
                  className="h-full w-full object-cover"
                />
              </Link>
            </div>
            <div className="featured-novel-info">
              <span className="eyebrow">
                <Sparkles className="size-4" /> Featured Pick
              </span>
              <h2 className="section-title">
                <Link href={`/novels/${spotlightNovel._id}`}>{spotlightNovel.title}</Link>
              </h2>
              <p className="text-sm text-copy">by {getAuthor(spotlightNovel)}</p>
              <p className="line-clamp-3 text-sm text-copy">
                {spotlightNovel.description || 'No summary available yet.'}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {spotlightNovel.publicationStatus && <Badge>{spotlightNovel.publicationStatus}</Badge>}
                {(spotlightNovel.genres || []).slice(0, 3).map((genre) => (
                  <Badge key={genre}>{genre}</Badge>
                ))}
              </div>
              <Button asChild>
                <Link href={`/novels/${spotlightNovel._id}`}>View Novel</Link>
              </Button>
            </div>
          </section>
        )}

        {sections.newest.length > 0 && (
          <section className="catalog-section">
            <div className="section-heading">
              <h2 className="section-title">New Arrivals</h2>
              <Link href="/novels" className="text-sm font-bold text-primary hover:underline">
                View all <ArrowRight className="inline size-4" />
              </Link>
            </div>
            <div className="catalog-card-grid">
              {sections.newest.map((novel) => (
                <NovelCard key={novel._id} novel={novel} mode="catalog" />
              ))}
            </div>
          </section>
        )}

        {showLongReads && sections.longReads.length > 0 && (
          <section className="catalog-section">
            <div className="section-heading">
              <h2 className="section-title">Long Reads</h2>
              <Link href="/novels?sort=chaptersTotal" className="text-sm font-bold text-primary hover:underline">
                View all <ArrowRight className="inline size-4" />
              </Link>
            </div>
            <div className="catalog-card-grid">
              {sections.longReads.map((novel) => (
                <NovelCard key={novel._id} novel={novel} mode="catalog" />
              ))}
            </div>
          </section>
        )}

        {sections.recent.length > 0 && (
          <section className="catalog-section">
            <div className="section-heading">
              <h2 className="section-title">Recent Updates</h2>
            </div>
            <Card className="divide-y divide-border">
              {sections.recent.map((novel) => (
                <Link key={novel._id} href={`/novels/${novel._id}`} className="recent-row">
                  <div>
                    <strong>{novel.title}</strong>
                    <span>{getAuthor(novel)}</span>
                  </div>
                  <small>{new Date(novel.updatedAt).toLocaleDateString()}</small>
                  <small>{getChapterCount(novel)} chapters</small>
                </Link>
              ))}
            </Card>
          </section>
        )}
      </section>

      <aside className="public-sidebar">
        <Card className="sidebar-panel">
          <div className="section-heading">
            <h2 className="section-title">
              <TrendingUp className="inline size-4" /> Trending
            </h2>
          </div>
          <div className="sidebar-list">
            {sections.ranked.map((novel, index) => (
              <Link key={novel._id} href={`/novels/${novel._id}`} className="rank-row">
                <span className="rank-number">{index + 1}</span>
                <div>
                  <strong>{novel.title}</strong>
                  <small>{getAuthor(novel)}</small>
                </div>
                <small>{(novel.rating || 0).toFixed(1)}</small>
              </Link>
            ))}
          </div>
        </Card>

        {sections.genres.length > 0 && (
          <Card className="sidebar-panel">
            <div className="section-heading">
              <h2 className="section-title">Genres</h2>
            </div>
            <div className="sidebar-tags">
              {sections.genres.map((genre) => (
                <Link key={genre} href={`/genres/${encodeURIComponent(genre)}`} className="sidebar-tag">
                  {genre}
                </Link>
              ))}
            </div>
          </Card>
        )}

        {sections.completed.length > 0 && (
          <Card className="sidebar-panel">
            <div className="section-heading">
              <h2 className="section-title">Completed</h2>
            </div>
            <div className="sidebar-list">
              {sections.completed.map((novel) => (
                <Link key={novel._id} href={`/novels/${novel._id}`} className="mini-novel">
                  <strong>{novel.title}</strong>
                  <small>{getAuthor(novel)}</small>
                </Link>
              ))}
            </div>
          </Card>
        )}

        {sections.random.length > 0 && (
          <Card className="sidebar-panel">
            <div className="section-heading">
              <h2 className="section-title">Random</h2>
            </div>
            <div className="sidebar-list">
              {sections.random.map((novel) => (
                <Link key={novel._id} href={`/novels/${novel._id}`} className="mini-novel">
                  <strong>{novel.title}</strong>
                  <small>{getAuthor(novel)}</small>
                </Link>
              ))}
            </div>
          </Card>
        )}
      </aside>
    </div>
  );
}
