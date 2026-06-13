'use client';

import Link from 'next/link';
import { use, useEffect, useMemo, useState } from 'react';
import { api, getNovelCoverUrl, Novel, ChapterContent } from '../../../utils/api';
import { useAuth } from '../../../context/AuthContext';
import { NovelCard } from '../../../components/NovelCard';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';

function getAuthor(novel: Novel): string {
  return novel.authorPenName || novel.author || novel.authorRealName || 'Unknown Author';
}

export default function PublicNovelDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const [novel, setNovel] = useState<Novel | null>(null);
  const [chapters, setChapters] = useState<Omit<ChapterContent, 'content'>[]>([]);
  const [authorNovels, setAuthorNovels] = useState<Novel[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [addMessage, setAddMessage] = useState('');

  useEffect(() => {
    async function loadNovel() {
      setLoading(true);
      try {
        const novelData = await api.getPublicNovel(id);
        const [chapterData, authorData] = await Promise.all([
          api.getPublicChapters(id).catch(() => []),
          novelData.authorId ? api.getPublicAuthor(novelData.authorId).catch(() => null) : Promise.resolve(null),
        ]);
        setNovel(novelData);
        setChapters(chapterData);
        setAuthorNovels((authorData?.novels || []).filter((item) => item._id !== novelData._id).slice(0, 6));
      } catch (err) {
        console.error('Failed to load public novel:', err);
      } finally {
        setLoading(false);
      }
    }

    loadNovel();
  }, [id]);

  const firstReadableChapter = useMemo(() => {
    return chapters[0]?.chapterNumber || novel?.chaptersList?.[0]?.number || 1;
  }, [chapters, novel]);

  const similarGenres = novel?.genres || [];
  const coverSrc = novel ? getNovelCoverUrl(novel) : '';

  const handleAddToLibrary = async () => {
    if (!novel || !user) return;
    setAdding(true);
    setAddMessage('');
    try {
      const created = await api.addNovelToLibrary(novel._id);
      setAddMessage('Added to your profile library.');
      window.setTimeout(() => {
        window.location.href = `/profile/novels/${created._id}`;
      }, 700);
    } catch (err: any) {
      setAddMessage(err.message || 'Could not add this novel.');
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <Card className="empty-state"><div className="spinner"></div></Card>
      </div>
    );
  }

  if (!novel) {
    return (
      <div className="container">
        <Card className="empty-state">
          <h1>Novel Not Found</h1>
          <Button asChild variant="secondary" className="mt-4">
            <Link href="/">Back Home</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container public-detail">
      <Card className="public-detail-hero">
        <div className="public-cover">
          {coverSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverSrc} alt={novel.title} />
          ) : (
            <span>{novel.title.slice(0, 2).toUpperCase()}</span>
          )}
        </div>

        <div className="public-detail-main">
          <div>
            <h1 className="page-title">{novel.title}</h1>
            {(novel.alternativeNames || []).length > 0 && (
              <p className="page-subtitle">{novel.alternativeNames.slice(0, 3).join(' · ')}</p>
            )}
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
              By {novel.authorId ? (
                <Link href={`/authors/${novel.authorId}`} className="text-primary">{getAuthor(novel)}</Link>
              ) : getAuthor(novel)}
            </p>
          </div>

          <div className="public-stat-grid">
            <div><span>Status</span><strong>{novel.publicationStatus || 'Unknown'}</strong></div>
            <div><span>Chapters</span><strong>{novel.chaptersTotal || chapters.length || '?'}</strong></div>
            <div><span>Archived</span><strong>{chapters.length}</strong></div>
            <div><span>Raw</span><strong>{novel.rawChaptersTotal || 0}</strong></div>
          </div>

          <div className="public-detail-actions">
            {user ? (
              <Button variant="secondary" onClick={handleAddToLibrary} disabled={adding}>
                {adding ? <span className="spinner"></span> : 'Add to Profile Library'}
              </Button>
            ) : (
              <Button asChild variant="secondary">
                <Link href="/login">Login to Track</Link>
              </Button>
            )}
            <Button asChild>
              <Link href={`/novels/${novel._id}/reader/${firstReadableChapter}`}>Start Reading</Link>
            </Button>
          </div>
          {addMessage && <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{addMessage}</p>}

          <div className="novel-card-badges">
            {(novel.genres || []).map((genre) => (
              <Link key={genre} href={`/genres/${encodeURIComponent(genre)}`} className="no-underline">
                <Badge>{genre}</Badge>
              </Link>
            ))}
          </div>
        </div>
      </Card>

      <Card className="public-unlock">
        <div>
          <strong>Archive Progress</strong>
          <span>{chapters.length} / {novel.chaptersTotal || chapters.length || '?'}</span>
        </div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${novel.chaptersTotal ? Math.min(100, Math.round((chapters.length / novel.chaptersTotal) * 100)) : 100}%` }}
          ></div>
        </div>
      </Card>

      <div className="public-detail-grid">
        <main className="page-stack">
          <Card className="public-section">
            <h2>Novel Summary</h2>
            <p>{novel.description || 'No summary has been indexed for this novel yet.'}</p>
          </Card>

          {authorNovels.length > 0 && (
            <Card className="public-section">
              <h2>Author&apos;s Other Novels</h2>
              <div className="compact-list">
                {authorNovels.map((item, index) => (
                  <Link key={item._id} href={`/novels/${item._id}`}>
                    <span>{index + 1}</span>
                    <strong>{item.title}</strong>
                    <small>{item.chaptersTotal || 0} ch</small>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          <Card className="public-section">
            <h2>Table of Contents</h2>
            {chapters.length === 0 ? (
              <p>No archived chapters are available yet.</p>
            ) : (
              <div className="toc-grid">
                {chapters.slice(0, 120).map((chapterItem) => (
                  <Link key={chapterItem._id} href={`/novels/${novel._id}/reader/${chapterItem.chapterNumber}`}>
                    <span>Chapter {chapterItem.chapterNumber}</span>
                    <strong>{chapterItem.title}</strong>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </main>

        <aside className="page-stack">
          <Card className="public-section">
            <h2>Details</h2>
            <dl className="detail-list">
              <div><dt>Title</dt><dd>{novel.title}</dd></div>
              <div><dt>Author</dt><dd>{getAuthor(novel)}</dd></div>
              <div><dt>Source</dt><dd>{novel.originalSource || 'Unknown'}</dd></div>
              <div><dt>Language</dt><dd>{novel.rawOriginalLanguage || 'Translated'}</dd></div>
            </dl>
          </Card>

          <Card className="public-section">
            <h2>Genres</h2>
            <div className="novel-card-badges">
              {similarGenres.length === 0 ? (
                <span style={{ color: 'var(--text-secondary)' }}>No genres indexed.</span>
              ) : similarGenres.map((genre) => (
                <Link key={genre} href={`/genres/${encodeURIComponent(genre)}`} className="no-underline">
                  <Badge>{genre}</Badge>
                </Link>
              ))}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
