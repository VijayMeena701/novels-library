'use client';

import Link from 'next/link';
import { use, useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, getNovelCoverUrl, type BackgroundJob, type ChapterContent, type JobType, type Novel, type SourceKind } from '../../../utils/api';
import { useAuth } from '../../../context/AuthContext';
import { NovelCard } from '../../../components/NovelCard';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';

function getAuthor(novel: Novel): string {
  return novel.authorPenName || novel.author || novel.authorRealName || 'Unknown Author';
}

function normalizeTitle(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function isGenericChapterTitle(value: string, novelTitle: string, chapterNumber: number): boolean {
  const normalized = normalizeTitle(value);
  return !normalized ||
    normalized === normalizeTitle(novelTitle) ||
    normalized === `chapter ${chapterNumber}` ||
    normalized === `ch ${chapterNumber}`;
}

export default function PublicNovelDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const [novel, setNovel] = useState<Novel | null>(null);
  const [chapters, setChapters] = useState<Omit<ChapterContent, 'content'>[]>([]);
  const [rawChapters, setRawChapters] = useState<Omit<ChapterContent, 'content'>[]>([]);
  const [authorNovels, setAuthorNovels] = useState<Novel[]>([]);
  const [jobs, setJobs] = useState<BackgroundJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [queueing, setQueueing] = useState<JobType | null>(null);
  const [runningNow, setRunningNow] = useState<JobType | null>(null);
  const [addMessage, setAddMessage] = useState('');
  const [adminMessage, setAdminMessage] = useState('');
  const [isIndexHtmlModalOpen, setIsIndexHtmlModalOpen] = useState(false);
  const [indexHtmlSourceKind, setIndexHtmlSourceKind] = useState<SourceKind>('raw');
  const [indexHtmlPageUrl, setIndexHtmlPageUrl] = useState('');
  const [indexHtmlContent, setIndexHtmlContent] = useState('');
  const [importingIndexHtml, setImportingIndexHtml] = useState(false);

  const fetchNovelJobs = async () => {
    if (user?.role !== 'admin') return;

    setJobsLoading(true);
    try {
      const jobData = await api.getNovelJobs(id);
      setJobs(jobData);
    } catch (err) {
      console.error('Failed to load novel jobs:', err);
    } finally {
      setJobsLoading(false);
    }
  };

  const refreshChapterLists = async () => {
    const [chapterData, rawChapterData] = await Promise.all([
      api.getPublicChapters(id).catch(() => []),
      api.getPublicRawChapters(id).catch(() => []),
    ]);
    setChapters(chapterData);
    setRawChapters(rawChapterData);
  };

  useEffect(() => {
    async function loadNovel() {
      setLoading(true);
      try {
        const novelData = await api.getPublicNovel(id);
        const [chapterData, rawChapterData, authorData] = await Promise.all([
          api.getPublicChapters(id).catch(() => []),
          api.getPublicRawChapters(id).catch(() => []),
          novelData.authorId ? api.getPublicAuthor(novelData.authorId).catch(() => null) : Promise.resolve(null),
        ]);
        setNovel(novelData);
        setChapters(chapterData);
        setRawChapters(rawChapterData);
        setAuthorNovels((authorData?.novels || []).filter((item) => item._id !== novelData._id).slice(0, 6));
      } catch (err) {
        console.error('Failed to load public novel:', err);
      } finally {
        setLoading(false);
      }
    }

    loadNovel();
  }, [id]);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchNovelJobs();
    } else {
      setJobs([]);
    }
  }, [id, user?.role]);

  const firstReadableChapter = useMemo(() => {
    return chapters[0]?.chapterNumber || 1;
  }, [chapters]);

  const rawCatalogItems = useMemo(() => {
    if (!novel) return [];

    const archivedByNumber = new Map(rawChapters.map((chapter) => [chapter.chapterNumber, chapter]));
    const seen = new Set<number>();
    const indexedItems = (novel.rawChaptersList || [])
      .filter((chapter) => Number.isFinite(chapter.number) && !seen.has(chapter.number))
      .map((chapter) => {
        seen.add(chapter.number);
        const archived = archivedByNumber.get(chapter.number);
        const archivedTitle = archived?.title?.trim() || '';
        const indexedTitle = chapter.title?.trim() || '';
        return {
          number: chapter.number,
          title: archivedTitle && !isGenericChapterTitle(archivedTitle, novel.title, chapter.number)
            ? archivedTitle
            : indexedTitle || archivedTitle || `Raw Chapter ${chapter.number}`,
          archived: Boolean(archived),
          sourceUrl: archived?.sourceUrl || chapter.url,
          scrapedAt: archived?.scrapedAt,
        };
      });

    const archivedOnlyItems = rawChapters
      .filter((chapter) => !seen.has(chapter.chapterNumber))
      .map((chapter) => ({
        number: chapter.chapterNumber,
        title: chapter.title || `Raw Chapter ${chapter.chapterNumber}`,
        archived: true,
        sourceUrl: chapter.sourceUrl,
        scrapedAt: chapter.scrapedAt,
      }));

    return [...indexedItems, ...archivedOnlyItems].sort((a, b) => a.number - b.number);
  }, [novel, rawChapters]);

  const translatedCatalogItems = useMemo(() => {
    if (!novel) return [];

    const archivedByNumber = new Map(chapters.map((chapter) => [chapter.chapterNumber, chapter]));
    const seen = new Set<number>();
    const indexedItems = (novel.chaptersList || [])
      .filter((chapter) => Number.isFinite(chapter.number) && !seen.has(chapter.number))
      .map((chapter) => {
        seen.add(chapter.number);
        const archived = archivedByNumber.get(chapter.number);
        const archivedTitle = archived?.title?.trim() || '';
        const indexedTitle = chapter.title?.trim() || '';
        return {
          number: chapter.number,
          title: archivedTitle && !isGenericChapterTitle(archivedTitle, novel.title, chapter.number)
            ? archivedTitle
            : indexedTitle || archivedTitle || `Chapter ${chapter.number}`,
          archived: Boolean(archived),
          sourceUrl: archived?.sourceUrl || chapter.url,
          scrapedAt: archived?.scrapedAt,
        };
      });

    const archivedOnlyItems = chapters
      .filter((chapter) => !seen.has(chapter.chapterNumber))
      .map((chapter) => ({
        number: chapter.chapterNumber,
        title: chapter.title || `Chapter ${chapter.chapterNumber}`,
        archived: true,
        sourceUrl: chapter.sourceUrl,
        scrapedAt: chapter.scrapedAt,
      }));

    return [...indexedItems, ...archivedOnlyItems].sort((a, b) => a.number - b.number);
  }, [novel, chapters]);

  const firstReadableRawChapter = useMemo(() => {
    return rawCatalogItems[0]?.number || rawChapters[0]?.chapterNumber || 1;
  }, [rawCatalogItems, rawChapters]);

  const similarGenres = novel?.genres || [];
  const coverSrc = novel ? getNovelCoverUrl(novel) : '';
  const activeJobTypes = useMemo(
    () => new Set(jobs.filter((job) => job.status === 'pending' || job.status === 'processing').map((job) => job.type)),
    [jobs],
  );
  const recentJobs = jobs.slice(0, 4);

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

  const handleTriggerScrape = async (type: JobType) => {
    if (!novel) return;

    setQueueing(type);
    setAdminMessage('');
    try {
      const result = await api.triggerScrape(novel._id, type);
      setAdminMessage(result.message || 'Scraper job queued.');
      await fetchNovelJobs();
    } catch (err: any) {
      setAdminMessage(err.message || 'Could not queue scraper job.');
    } finally {
      setQueueing(null);
    }
  };

  const handleRunScrapeNow = async (type: JobType) => {
    if (!novel) return;

    setRunningNow(type);
    setAdminMessage('');
    try {
      const result = await api.runScrapeNow(novel._id, type, { limit: 5 });
      setNovel(result.novel);
      await refreshChapterLists();
      setAdminMessage(result.message || 'Direct scraper run completed.');
      await fetchNovelJobs();
    } catch (err: any) {
      setAdminMessage(err.message || 'Direct scraper run failed.');
      await fetchNovelJobs();
    } finally {
      setRunningNow(null);
    }
  };

  const openIndexHtmlImport = (sourceKind: SourceKind) => {
    if (!novel) return;
    setIndexHtmlSourceKind(sourceKind);
    setIndexHtmlPageUrl(sourceKind === 'raw' ? novel.rawSourceUrl || '' : novel.sourceUrl || '');
    setIndexHtmlContent('');
    setIsIndexHtmlModalOpen(true);
  };

  const handleImportIndexHtml = async (event: FormEvent) => {
    event.preventDefault();
    if (!novel) return;

    setImportingIndexHtml(true);
    setAdminMessage('');
    try {
      const result = await api.importHtmlIndex(novel._id, {
        sourceKind: indexHtmlSourceKind,
        html: indexHtmlContent,
        pageUrl: indexHtmlPageUrl || (indexHtmlSourceKind === 'raw' ? novel.rawSourceUrl : novel.sourceUrl),
      });
      setNovel(result.novel);
      await refreshChapterLists();
      setAdminMessage(result.message);
      setIsIndexHtmlModalOpen(false);
      setIndexHtmlContent('');
      setIndexHtmlPageUrl('');
      await fetchNovelJobs();
    } catch (err: any) {
      setAdminMessage(err.message || 'Could not import catalogue HTML.');
    } finally {
      setImportingIndexHtml(false);
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
            {chapters.length > 0 ? (
              <Button asChild>
                <Link href={`/novels/${novel._id}/reader/${firstReadableChapter}`}>Start Reading</Link>
              </Button>
            ) : novel.sourceUrl ? (
              <Button asChild>
                <a href={novel.sourceUrl} target="_blank" rel="noreferrer">Open Source</a>
              </Button>
            ) : null}
            {rawCatalogItems.some((item) => item.archived) && (
              <Button asChild variant="secondary">
                <Link href={`/novels/${novel._id}/reader/${firstReadableRawChapter}?source=raw`}>Open Raw</Link>
              </Button>
            )}
            {novel.rawSourceUrl && rawChapters.length === 0 && (
              <Button asChild variant="secondary">
                <a href={novel.rawSourceUrl} target="_blank" rel="noreferrer">Open Raw Source</a>
              </Button>
            )}
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

      {user?.role === 'admin' && (
        <Card className="public-section">
          <div className="flex-between" style={{ alignItems: 'flex-start', gap: '1rem' }}>
            <div>
              <h2>Catalog Admin</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.3rem' }}>
                Queue or directly run indexing and archiving tasks for this shared novel record.
              </p>
            </div>
            <Button asChild variant="secondary" size="sm">
              <Link href="/scraper">Scraper Dashboard</Link>
            </Button>
          </div>

          <div className="public-detail-actions" style={{ marginTop: '1rem' }}>
            {novel.sourceUrl && (
              <Button asChild variant="ghost" size="sm">
                <a href={novel.sourceUrl} target="_blank" rel="noreferrer">Open Translated Source</a>
              </Button>
            )}
            {novel.rawSourceUrl && (
              <Button asChild variant="ghost" size="sm">
                <a href={novel.rawSourceUrl} target="_blank" rel="noreferrer">Open Raw Source</a>
              </Button>
            )}
          </div>

          <div className="public-detail-actions" style={{ marginTop: '1rem' }}>
            {([
              ['scrape_metadata', 'Index Translated', Boolean(novel.sourceUrl)],
              ['scrape_chapters', 'Archive Translated', (novel.chaptersList || []).length > 0],
              ['scrape_raw_metadata', 'Index Raw', Boolean(novel.rawSourceUrl)],
              ['scrape_raw_chapters', 'Archive Raw', rawCatalogItems.length > 0],
            ] as [JobType, string, boolean][]).map(([type, label, canRun]) => (
              <Button
                key={type}
                variant="secondary"
                size="sm"
                onClick={() => handleTriggerScrape(type)}
                disabled={!canRun || Boolean(queueing) || activeJobTypes.has(type)}
              >
                {queueing === type ? 'Queueing...' : activeJobTypes.has(type) ? 'Running' : label}
              </Button>
            ))}
          </div>

          <div className="public-detail-actions" style={{ marginTop: '0.75rem' }}>
            {([
              ['scrape_metadata', 'Index Translated Now', Boolean(novel.sourceUrl)],
              ['scrape_chapters', 'Archive 5 Translated Now', translatedCatalogItems.length > 0],
              ['scrape_raw_metadata', 'Index Raw Now', Boolean(novel.rawSourceUrl)],
              ['scrape_raw_chapters', 'Archive 5 Raw Now', rawCatalogItems.length > 0],
            ] as [JobType, string, boolean][]).map(([type, label, canRun]) => (
              <Button
                key={type}
                variant="secondary"
                size="sm"
                onClick={() => handleRunScrapeNow(type)}
                disabled={!canRun || Boolean(runningNow)}
              >
                {runningNow === type ? 'Running...' : label}
              </Button>
            ))}
          </div>

          <div className="public-detail-actions" style={{ marginTop: '0.75rem' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => openIndexHtmlImport('translated')}
              disabled={!novel.sourceUrl}
            >
              Import Translated Index HTML
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => openIndexHtmlImport('raw')}
              disabled={!novel.rawSourceUrl}
            >
              Import Raw Index HTML
            </Button>
            <Button variant="ghost" size="sm" onClick={fetchNovelJobs} disabled={jobsLoading}>
              {jobsLoading ? 'Refreshing...' : 'Refresh Jobs'}
            </Button>
          </div>

          {adminMessage && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.8rem' }}>{adminMessage}</p>
          )}

          {recentJobs.length > 0 && (
            <div className="compact-list" style={{ marginTop: '1rem' }}>
              {recentJobs.map((job) => (
                <div key={job._id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', padding: '0.65rem 0' }}>
                  <span>
                    <strong style={{ textTransform: 'capitalize' }}>{job.type.replace(/_/g, ' ')}</strong>
                    <small style={{ display: 'block', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                      {job.progress?.message || 'Queued'}
                    </small>
                  </span>
                  <Badge>{job.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

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
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Archived translated: {chapters.length} / {novel.chaptersTotal || translatedCatalogItems.length || '?'} chapters.
            </p>
            {translatedCatalogItems.length === 0 ? (
              <p style={{ marginTop: '1rem' }}>
                No translated chapters have been indexed yet.
                {novel.sourceUrl && (
                  <>
                    {' '}
                    <a href={novel.sourceUrl} target="_blank" rel="noreferrer">Open source page</a>.
                  </>
                )}
              </p>
            ) : (
              <div className="toc-grid" style={{ marginTop: '1rem' }}>
                {translatedCatalogItems.slice(0, 120).map((chapterItem) => (
                  chapterItem.archived ? (
                    <Link key={chapterItem.number} href={`/novels/${novel._id}/reader/${chapterItem.number}`}>
                      <span>Chapter {chapterItem.number}</span>
                      <strong>{chapterItem.title}</strong>
                    </Link>
                  ) : (
                    <Link key={chapterItem.number} className="toc-indexed-only" href={`/novels/${novel._id}/reader/${chapterItem.number}`}>
                      <span>Chapter {chapterItem.number}</span>
                      <strong>{chapterItem.title}</strong>
                      <small>Indexed only</small>
                    </Link>
                  )
                ))}
              </div>
            )}
          </Card>

          {(novel.rawChaptersTotal > 0 || rawCatalogItems.length > 0) && (
            <Card className="public-section">
              <div className="flex-between" style={{ gap: '1rem', alignItems: 'flex-start' }}>
                <div>
                  <h2>Raw Table of Contents</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    Archived raw: {rawChapters.length} / {novel.rawChaptersTotal || rawCatalogItems.length} chapters.
                  </p>
                </div>
                {rawCatalogItems.length > 0 && (
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/novels/${novel._id}/reader/${firstReadableRawChapter}?source=raw`}>Open Raw Reader</Link>
                  </Button>
                )}
              </div>

              {rawCatalogItems.length === 0 ? (
                <p>No raw chapters have been indexed yet.</p>
              ) : (
                <div className="toc-grid">
                  {rawCatalogItems.slice(0, 120).map((chapterItem) => (
                    chapterItem.archived ? (
                      <Link key={chapterItem.number} href={`/novels/${novel._id}/reader/${chapterItem.number}?source=raw`}>
                        <span>Raw {chapterItem.number}</span>
                        <strong>{chapterItem.title}</strong>
                      </Link>
                    ) : (
                      <Link key={chapterItem.number} className="toc-indexed-only" href={`/novels/${novel._id}/reader/${chapterItem.number}?source=raw`}>
                        <span>Raw {chapterItem.number}</span>
                        <strong>{chapterItem.title}</strong>
                        <small>Indexed only</small>
                      </Link>
                    )
                  ))}
                </div>
              )}
            </Card>
          )}
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

      {isIndexHtmlModalOpen && user?.role === 'admin' && (
        <div className="modal-backdrop">
          <Card className="modal-panel" style={{ maxWidth: '760px' }}>
            <div className="flex-between">
              <h2 style={{ fontSize: '1.35rem' }}>
                Import {indexHtmlSourceKind === 'raw' ? 'Raw' : 'Translated'} Catalogue HTML
              </h2>
              <button
                onClick={() => setIsIndexHtmlModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleImportIndexHtml} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Catalogue Page URL</label>
                <input
                  type="url"
                  className="form-input"
                  value={indexHtmlPageUrl}
                  onChange={(event) => setIndexHtmlPageUrl(event.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Saved HTML</label>
                <textarea
                  className="form-textarea"
                  rows={14}
                  value={indexHtmlContent}
                  onChange={(event) => setIndexHtmlContent(event.target.value)}
                  placeholder="<html>..."
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <Button type="button" variant="secondary" onClick={() => setIsIndexHtmlModalOpen(false)} disabled={importingIndexHtml}>
                  Cancel
                </Button>
                <Button type="submit" disabled={importingIndexHtml}>
                  {importingIndexHtml ? 'Importing...' : 'Import Index'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

    </div>
  );
}
