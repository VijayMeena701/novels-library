'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api, Novel } from '../utils/api';
import { NovelCard } from '../components/NovelCard';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';

function byNewest(a: Novel, b: Novel) {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

function byChapterCount(a: Novel, b: Novel) {
  return (b.chaptersTotal || b.chaptersList?.length || 0) - (a.chaptersTotal || a.chaptersList?.length || 0);
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

export default function PublicHomePage() {
  const { user } = useAuth();
  const [novels, setNovels] = useState<Novel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPublicCatalogNovels()
      .then(setNovels)
      .catch((err) => console.error('Failed to load public catalogue:', err))
      .finally(() => setLoading(false));
  }, []);

  const sections = useMemo(() => {
    const newest = [...novels].sort(byNewest);
    const ranked = [...novels].sort(byRating);
    const longReads = [...novels].sort(byChapterCount);
    const completed = novels.filter((novel) => novel.publicationStatusKey === 'completed' || novel.publicationStatus.toLowerCase() === 'completed');
    const genres = Array.from(new Set(novels.flatMap((novel) => novel.genres || []).filter(Boolean))).slice(0, 12);
    const totalChapters = novels.reduce((sum, novel) => sum + getChapterCount(novel), 0);

    return {
      newest: newest.slice(0, 6),
      ranked: ranked.slice(0, 6),
      longReads: longReads.slice(0, 6),
      completed: completed.slice(0, 8),
      recent: newest.slice(0, 12),
      random: [...novels].sort(() => 0.5 - Math.random()).slice(0, 5),
      genres,
      totalChapters,
    };
  }, [novels]);

  const spotlightNovel = sections.ranked[0] || sections.newest[0] || null;
  const completedCount = sections.completed.length;
  const showLongReads = novels.length > 4;

  return (
    <div className="container public-home">
      <section className="public-main">
        <div className="public-hero">
          <div className="public-hero-copy">
            <span className="eyebrow">Archived web novel catalogue</span>
            <h1 className="page-title">Novel Catalogue</h1>
            <p className="page-subtitle">
              Browse indexed novels, author pages, chapter lists, and reader-ready archives from one clean library.
            </p>
            <div className="public-hero-stats">
              <div><strong>{novels.length}</strong><span>Novels</span></div>
              <div><strong>{sections.totalChapters}</strong><span>Chapters</span></div>
              <div><strong>{completedCount}</strong><span>Completed</span></div>
            </div>
          </div>
          <div className="public-hero-actions">
            <Button asChild>
              <Link href={user ? '/profile' : '/login'}>
                {user ? 'Open Profile Library' : 'Login to Track Reading'}
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/authors">Browse Authors</Link>
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="glass-card empty-state"><div className="spinner"></div></div>
        ) : novels.length === 0 ? (
          <div className="glass-card empty-state">
            No public novels are indexed yet.
          </div>
        ) : (
          <>
            <section className="catalog-section">
              <div className="section-heading">
                <h2>New Novels</h2>
                <Link href="/authors">See Authors</Link>
              </div>
              <div className="catalog-card-grid">
                {sections.newest.map((novel) => (
                  <NovelCard key={novel._id} novel={novel} mode="catalog" />
                ))}
              </div>
            </section>

            {spotlightNovel && (
              <section className="featured-novel">
                <div className="featured-cover-art">
                  <span>{(spotlightNovel.genres || [])[0] || 'Featured'}</span>
                  <strong>{spotlightNovel.title}</strong>
                  <small>{getAuthor(spotlightNovel)}</small>
                </div>
                <div className="featured-copy">
                  <Badge>Trending</Badge>
                  <h2>{spotlightNovel.title}</h2>
                  <p>By {getAuthor(spotlightNovel)}</p>
                  <div className="novel-card-badges">
                    {(spotlightNovel.genres || []).slice(0, 5).map((genre) => (
                      <Link key={genre} href={`/genres/${encodeURIComponent(genre)}`} className="no-underline">
                        <Badge>{genre}</Badge>
                      </Link>
                    ))}
                  </div>
                  <p className="featured-description">
                    {spotlightNovel.description || 'No summary has been indexed for this novel yet.'}
                  </p>
                  <Button asChild>
                    <Link href={`/novels/${spotlightNovel._id}`}>Start Reading</Link>
                  </Button>
                </div>
              </section>
            )}

            {showLongReads && (
              <section className="catalog-section">
                <div className="section-heading">
                  <h2>Long Reads</h2>
                </div>
                <div className="catalog-card-grid">
                  {sections.longReads.map((novel) => (
                    <NovelCard key={novel._id} novel={novel} mode="catalog" />
                  ))}
                </div>
              </section>
            )}

            <section className="catalog-section">
              <div className="section-heading">
                <h2>Recent Updates</h2>
              </div>
              <Card className="recent-list">
                {sections.recent.map((novel) => (
                  <Link key={novel._id} href={`/novels/${novel._id}`} className="recent-row">
                    <strong>{novel.title}</strong>
                    <span>{getAuthor(novel)}</span>
                    <small>{getChapterCount(novel)} chapters · {new Date(novel.updatedAt).toLocaleString()}</small>
                  </Link>
                ))}
              </Card>
            </section>
          </>
        )}
      </section>

      <aside className="public-sidebar">
        <Card className="sidebar-panel">
          <div className="section-heading">
            <h2>Ranking</h2>
          </div>
          {sections.ranked.map((novel, index) => (
            <Link key={novel._id} href={`/novels/${novel._id}`} className="rank-row">
              <span>#{index + 1}</span>
              <strong>{novel.title}</strong>
              <small>{novel.rating ? `${novel.rating}/5` : `${getChapterCount(novel)} ch`}</small>
            </Link>
          ))}
        </Card>

        {sections.genres.length > 0 && (
          <Card className="sidebar-panel">
            <div className="section-heading">
              <h2>Genres</h2>
            </div>
            <div className="sidebar-tags">
              {sections.genres.map((genre) => (
                <Link key={genre} href={`/genres/${encodeURIComponent(genre)}`} className="no-underline">
                  <Badge>{genre}</Badge>
                </Link>
              ))}
            </div>
          </Card>
        )}

        <Card className="sidebar-panel">
          <div className="section-heading">
            <h2>Random Novels</h2>
          </div>
          <div className="sidebar-list">
            {sections.random.map((novel) => (
              <Link key={novel._id} href={`/novels/${novel._id}`} className="sidebar-novel-row">
                <strong>{novel.title}</strong>
                <small>{(novel.genres || [])[0] || 'Novel'} · {getChapterCount(novel)} ch</small>
              </Link>
            ))}
          </div>
        </Card>
      </aside>
    </div>
  );
}
