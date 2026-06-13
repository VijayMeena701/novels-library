'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, getNovelCoverUrl, Novel, ReadingSession, ChapterContent, ChapterVisit, NovelStatus } from '../../../../utils/api';
import { useAuth } from '../../../../context/AuthContext';

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

function isGenericChapterTitle(value: string, novelTitle: string, chapterNumber: number): boolean {
  const normalized = normalizeTitle(value);
  return !normalized ||
    normalized === normalizeTitle(novelTitle) ||
    normalized === `chapter ${chapterNumber}` ||
    normalized === `ch ${chapterNumber}`;
}

export default function NovelDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id: novelId } = use(params);
  const router = useRouter();
  const { user } = useAuth();

  // Page state
  const [novel, setNovel] = useState<Novel | null>(null);
  const [chapters, setChapters] = useState<Omit<ChapterContent, 'content'>[]>([]);
  const [chapterVisits, setChapterVisits] = useState<ChapterVisit[]>([]);
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit form state
  const [isEditing, setIsEditing] = useState(false);
  const [editStatus, setEditStatus] = useState<NovelStatus>('reading');
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

  // Active re-read state
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [sessionNotes, setSessionNotes] = useState('');
  const [sessionChRead, setSessionChRead] = useState(0);

  // Load all novel-related data
  const loadData = async () => {
    try {
      const [novelData, chaptersData, chapterVisitsData, sessionsData] = await Promise.all([
        api.getNovel(novelId),
        api.getChapters(novelId),
        api.getChapterVisits(novelId),
        api.getSessions(novelId)
      ]);
      setNovel(novelData);
      setChapters(chaptersData);
      setChapterVisits(chapterVisitsData);
      setSessions(sessionsData);

      // Populate edit form
      setEditStatus(novelData.status);
      setEditChRead(novelData.chaptersRead);
      setEditCompletedAt(formatDateTimeLocal(novelData.completedAt));
      setEditRating(novelData.rating);
      setEditReview(novelData.review);
      setEditNotes(novelData.personalNotes);
      setEditRawLegacyEntry(novelData.rawLegacyEntry || '');
      setEditCharacterNotes(novelData.characterNotes || '');
      setEditRelationshipNotes(novelData.relationshipNotes || '');
      setEditPersonalTags((novelData.personalTags || []).join(', '));
    } catch (err) {
      console.error('Error fetching novel details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && novelId) {
      loadData();
    }
  }, [user, novelId]);

  // Handle Edit Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.updateNovel(novelId, {
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
      setNovel(updated);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update novel:', err);
      alert('Error updating novel details.');
    } finally {
      setSaving(false);
    }
  };

  // Delete Novel Cascade
  const handleDeleteNovel = async () => {
    if (!confirm('Remove this novel from your profile library? The shared catalog and archived chapters will stay in the system.')) {
      return;
    }

    try {
      await api.deleteNovel(novelId);
      router.push('/');
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Failed to delete novel.');
    }
  };

  // Re-read Log Actions
  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.startSession(novelId, {
        notes: sessionNotes || 'Started new session.',
        chaptersRead: sessionChRead
      });
      setIsSessionModalOpen(false);
      setSessionNotes('');
      setSessionChRead(0);
      
      // Update local sessions state
      const sessionsData = await api.getSessions(novelId);
      setSessions(sessionsData);
    } catch (err) {
      console.error('Failed to start reading session:', err);
    }
  };

  const handleUpdateSessionProgress = async (session: ReadingSession, increment: boolean) => {
    const nextCh = increment ? session.chaptersRead + 1 : Math.max(0, session.chaptersRead - 1);
    try {
      await api.updateSession(novelId, session._id, { chaptersRead: nextCh });
      const sessionsData = await api.getSessions(novelId);
      setSessions(sessionsData);
    } catch (err) {
      console.error('Failed to update session progress:', err);
    }
  };

  const handleCompleteSession = async (session: ReadingSession) => {
    try {
      await api.updateSession(novelId, session._id, { completed: true });
      const sessionsData = await api.getSessions(novelId);
      setSessions(sessionsData);
    } catch (err) {
      console.error('Failed to complete session:', err);
    }
  };

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div className="spinner" style={{ width: '40px', height: '40px' }}></div>
          <span style={{ color: 'var(--text-secondary)' }}>Loading novel details...</span>
        </div>
      </div>
    );
  }

  if (!novel) {
    return (
      <div className="container">
        <div className="glass-card empty-state">
        <h2>Novel Not Found</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>The requested novel entry could not be found or is unauthorized.</p>
        <Link href="/profile" className="btn btn-primary" style={{ marginTop: '1.5rem' }}>Back to Library</Link>
        </div>
      </div>
    );
  }

  const displayAuthor = novel.authorPenName || novel.author || novel.authorRealName || 'Unknown Author';
  const coverSrc = getNovelCoverUrl(novel);
  const hasSourceMetadata = Boolean(
    novel.authorRealName ||
    (novel.alternativeNames || []).length > 0 ||
    (novel.genres || []).length > 0 ||
    novel.originalSource ||
    novel.publicationStatus
  );
  const chapterIndexByNumber = new Map((novel.chaptersList || []).map((chapter) => [chapter.number, chapter]));
  const getChapterDisplayTitle = (chapter: Omit<ChapterContent, 'content'>) => {
    const indexedTitle = chapterIndexByNumber.get(chapter.chapterNumber)?.title?.trim() || '';
    const archivedTitle = chapter.title?.trim() || '';

    if (indexedTitle && isGenericChapterTitle(archivedTitle, novel.title, chapter.chapterNumber)) {
      return indexedTitle;
    }

    return archivedTitle || indexedTitle || `Chapter ${chapter.chapterNumber}`;
  };
  const getVisitDisplayTitle = (visit: ChapterVisit) => {
    const indexedTitle = chapterIndexByNumber.get(visit.chapterNumber)?.title?.trim() || '';
    const visitTitle = visit.chapterTitle?.trim() || '';

    if (indexedTitle && isGenericChapterTitle(visitTitle, novel.title, visit.chapterNumber)) {
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

  return (
    <div className="container page-stack">
      
      {/* Navigation & Header Actions */}
      <div className="flex-between">
        <Link href="/profile" className="nav-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          ← Back to Library
        </Link>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => setIsEditing(!isEditing)}>
            {isEditing ? 'Cancel Edit' : 'Edit My Details'}
          </button>
          <button className="btn btn-danger" onClick={handleDeleteNovel}>
            Remove from Library
          </button>
        </div>
      </div>

      <div className="detail-grid">
        
        {/* LEFT COLUMN: Book Cover, Specs, Notes, Re-reads */}
        <div className="detail-column">
          
          {/* Main Info Box */}
          <div className="glass-card detail-summary">
            <div className="detail-cover">
              {coverSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverSrc} alt={novel.title} />
              ) : (
                <span style={{ fontSize: '2rem', opacity: 0.15, fontWeight: 'bold' }}>{novel.title.substring(0, 2).toUpperCase()}</span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'center' }}>
              <h2 style={{ fontSize: '1.5rem' }} className="text-gradient">{novel.title}</h2>
              <p style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>By {displayAuthor}</p>
              
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                <span className={`badge badge-${novel.status.replace('_', '-')}`}>
                  {novel.status.replace('_', ' ')}
                </span>
                {novel.rating > 0 && (
                  <span style={{ fontSize: '0.85rem', color: 'var(--warning)', fontWeight: 'bold' }}>
                    ★ {novel.rating}/5
                  </span>
                )}
              </div>

              {novel.completedAt && (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Completed: {new Date(novel.completedAt).toLocaleString()}
                </p>
              )}

              {(novel.personalTags || []).length > 0 && (
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {novel.personalTags.map((tag) => (
                    <span key={tag} className="badge" style={{ fontSize: '0.68rem' }}>{tag}</span>
                  ))}
                </div>
              )}
              
              {novel.sourceUrl && (
                <a 
                  href={novel.sourceUrl} 
                  target="_blank" 
                  rel="noreferrer" 
                  style={{ fontSize: '0.8rem', color: 'var(--primary)', textDecoration: 'underline', marginTop: '0.25rem', wordBreak: 'break-all' }}
                >
                  Original Website Link
                </a>
              )}
            </div>
          </div>

          {/* EDIT FORM (Conditionally Rendered) */}
          {isEditing ? (
            <div className="glass-card" style={{ padding: '2rem' }}>
              <h3 style={{ marginBottom: '1.25rem', fontSize: '1.2rem' }}>Edit My Reading Details</h3>
              <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Reading Status</label>
                    <select className="form-select" value={editStatus} onChange={(e) => setEditStatus(e.target.value as NovelStatus)}>
                      <option value="reading">📖 Reading</option>
                      <option value="completed">✅ Completed</option>
                      <option value="on_hold">⏳ On Hold</option>
                      <option value="dropped">🛑 Dropped</option>
                      <option value="planning">📋 Planning</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Chapters Read</label>
                    <input type="number" className="form-input" min="0" value={editChRead} onChange={(e) => setEditChRead(parseInt(e.target.value) || 0)} />
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Completed At</label>
                  <input type="datetime-local" className="form-input" value={editCompletedAt} onChange={(e) => setEditCompletedAt(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Personal Rating</label>
                  <select className="form-select" value={editRating} onChange={(e) => setEditRating(parseInt(e.target.value))}>
                    <option value="0">Unrated</option>
                    <option value="1">⭐ (Poor)</option>
                    <option value="2">⭐⭐ (Average)</option>
                    <option value="3">⭐⭐⭐ (Good)</option>
                    <option value="4">⭐⭐⭐⭐ (Excellent)</option>
                    <option value="5">⭐⭐⭐⭐⭐ (Masterpiece)</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">What did you like? (Review)</label>
                  <textarea className="form-textarea" rows={3} value={editReview} onChange={(e) => setEditReview(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Detailed Notes</label>
                  <textarea className="form-textarea" rows={4} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Personal Tags</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editPersonalTags}
                    onChange={(e) => setEditPersonalTags(e.target.value)}
                    placeholder="Comma-separated recall/filter tags"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Original Legacy Entry</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    value={editRawLegacyEntry}
                    onChange={(e) => setEditRawLegacyEntry(e.target.value)}
                    placeholder="Paste the old full record here so nothing is lost."
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Character Notes</label>
                  <textarea
                    className="form-textarea"
                    rows={4}
                    value={editCharacterNotes}
                    onChange={(e) => setEditCharacterNotes(e.target.value)}
                    placeholder="Names, aliases, role, cultivation/powers, important memory hooks..."
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Relationship Notes</label>
                  <textarea
                    className="form-textarea"
                    rows={4}
                    value={editRelationshipNotes}
                    onChange={(e) => setEditRelationshipNotes(e.target.value)}
                    placeholder="Character relationships, romance, factions, family, enemies..."
                  />
                </div>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <span className="spinner"></span> : 'Save Updates'}
                </button>
              </form>
            </div>
          ) : (
            <>
              {/* Synopsis / Description */}
              {hasSourceMetadata && (
                <div className="glass-card" style={{ padding: '2rem' }}>
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Source Metadata</h3>
                  <div style={{ display: 'grid', gap: '0.85rem', fontSize: '0.9rem' }}>
                    {novel.authorRealName && (
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', marginBottom: '0.2rem' }}>Author Real Name</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{novel.authorRealName}</span>
                      </div>
                    )}
                    {(novel.alternativeNames || []).length > 0 && (
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', marginBottom: '0.2rem' }}>Alternative Names</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{novel.alternativeNames.join(', ')}</span>
                      </div>
                    )}
                    {(novel.genres || []).length > 0 && (
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', marginBottom: '0.35rem' }}>Genres</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                          {novel.genres.map((genre) => (
                            <span key={genre} className="badge" style={{ fontSize: '0.72rem' }}>{genre}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {(novel.originalSource || novel.publicationStatus) && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        {novel.originalSource && (
                          <div>
                            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', marginBottom: '0.2rem' }}>Novel Source</span>
                            <span style={{ color: 'var(--text-secondary)' }}>{novel.originalSource}</span>
                          </div>
                        )}
                        {novel.publicationStatus && (
                          <div>
                            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', marginBottom: '0.2rem' }}>Publication Status</span>
                            <span style={{ color: 'var(--text-secondary)' }}>{novel.publicationStatus}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Synopsis / Description */}
              <div className="glass-card" style={{ padding: '2rem' }}>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem' }}>Synopsis</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', whiteSpace: 'pre-line', lineHeight: '1.6' }}>
                  {novel.description || 'No description scraped yet.'}
                </p>
              </div>

              {/* Review & Personal Notes */}
              <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>My Review</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', fontStyle: 'italic' }}>
                    {novel.review ? `"${novel.review}"` : 'No review notes written yet.'}
                  </p>
                </div>
                
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Personal Reading Notes</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', whiteSpace: 'pre-line' }}>
                    {novel.personalNotes || 'No custom reading notes stored.'}
                  </p>
                </div>

                {novel.rawLegacyEntry && (
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Original Legacy Entry</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', whiteSpace: 'pre-line' }}>
                      {novel.rawLegacyEntry}
                    </p>
                  </div>
                )}

                {novel.characterNotes && (
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Character Notes</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', whiteSpace: 'pre-line' }}>
                      {novel.characterNotes}
                    </p>
                  </div>
                )}

                {novel.relationshipNotes && (
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Relationship Notes</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', whiteSpace: 'pre-line' }}>
                      {novel.relationshipNotes}
                    </p>
                  </div>
                )}
              </div>

              {/* Re-read Log Manager */}
              <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="flex-between">
                  <h3 style={{ fontSize: '1.2rem' }}>Re-reading Logs</h3>
                  <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setIsSessionModalOpen(true)}>
                    + Log Session
                  </button>
                </div>

                {sessions.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center', padding: '1rem 0' }}>
                    No re-read logs exist for this novel yet.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {sessions.map((sess) => (
                      <div key={sess._id} style={{ 
                        backgroundColor: 'var(--surface-2)', 
                        padding: '1rem', 
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem'
                      }}>
                        <div className="flex-between">
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: sess.completed ? 'var(--success)' : 'var(--info)' }}>
                            {sess.completed ? '✅ Completed Re-read' : '📖 Active Re-read'}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {new Date(sess.startDate).toLocaleDateString()}
                            {sess.endDate ? ` - ${new Date(sess.endDate).toLocaleDateString()}` : ''}
                          </span>
                        </div>
                        
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          <strong>Notes:</strong> {sess.notes}
                        </p>

                        {(chapterVisitsBySession[sess._id] || []).length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                              Chapter Opens
                            </span>
                            {(chapterVisitsBySession[sess._id] || []).slice(0, 5).map((visit) => (
                              <Link
                                key={visit._id}
                                href={`/novels/${novelId}/reader/${visit.chapterNumber}`}
                                style={{ textDecoration: 'none', color: 'var(--text-secondary)', fontSize: '0.8rem' }}
                              >
                                Ch. {visit.chapterNumber}: {getVisitDisplayTitle(visit)}
                                <span style={{ color: 'var(--text-muted)' }}> · {new Date(visit.openedAt).toLocaleString()}</span>
                              </Link>
                            ))}
                          </div>
                        )}

                        <div className="flex-between" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Chapters Read: <strong>{sess.chaptersRead}</strong>
                          </span>
                          
                          {!sess.completed && (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={() => handleUpdateSessionProgress(sess, false)}>-</button>
                              <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={() => handleUpdateSessionProgress(sess, true)}>+</button>
                              <button className="btn btn-primary" style={{ padding: '2px 8px', fontSize: '0.75rem', backgroundColor: 'var(--success)' }} onClick={() => handleCompleteSession(sess)}>Complete</button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {standaloneChapterVisits.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <h4 style={{ fontSize: '0.95rem' }}>Recent Standalone Revisits</h4>
                    {standaloneChapterVisits.slice(0, 8).map((visit) => (
                      <Link
                        key={visit._id}
                        href={`/novels/${novelId}/reader/${visit.chapterNumber}`}
                        style={{ textDecoration: 'none', color: 'var(--text-secondary)', fontSize: '0.82rem' }}
                      >
                        Ch. {visit.chapterNumber}: {getVisitDisplayTitle(visit)}
                        <span style={{ color: 'var(--text-muted)' }}> · {new Date(visit.openedAt).toLocaleString()}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

        </div>

        {/* RIGHT COLUMN: Personal reading table of contents */}
        <div className="detail-column">
          {/* Table of Contents / Scraped Chapters List */}
          <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>Table of Contents</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Archived: <strong>{chapters.length}</strong> / <strong>{novel.chaptersTotal || '?'}</strong> chapters.
              </p>
            </div>

            {chapters.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem 1rem', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                  No chapters have been archived locally yet.
                </p>
                <Link href={`/novels/${novelId}`} className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                  View Catalog Page
                </Link>
              </div>
            ) : (
              <div className="chapter-list">
                {chapters.map((ch) => {
                  const isRead = ch.chapterNumber <= novel.chaptersRead;
                  const chapterTitle = getChapterDisplayTitle(ch);
                  return (
                    <Link key={ch._id} href={`/novels/${novelId}/reader/${ch.chapterNumber}`} style={{ textDecoration: 'none' }}>
                      <div className={`chapter-row ${isRead ? 'chapter-row-read' : ''}`}>
                        <span className="chapter-title">
                          {chapterTitle}
                        </span>
                        <div className="chapter-meta">
                          <span>
                            {new Date(ch.scrapedAt).toLocaleDateString()}
                          </span>
                          <span className={`status-dot ${isRead ? 'status-dot-muted' : ''}`}></span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Log Reading Session Modal */}
      {isSessionModalOpen && (
        <div className="modal-backdrop">
          <div className="glass-card modal-panel" style={{ maxWidth: '440px' }}>
            <div className="flex-between">
              <h2 style={{ fontSize: '1.4rem' }}>Log Re-reading Session</h2>
              <button 
                onClick={() => setIsSessionModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleStartSession} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Starting Chapter Progress</label>
                <input 
                  type="number" 
                  className="form-input" 
                  min="0"
                  value={sessionChRead}
                  onChange={(e) => setSessionChRead(Math.max(0, parseInt(e.target.value) || 0))}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Initial Session Notes</label>
                <textarea 
                  className="form-textarea" 
                  rows={3}
                  placeholder="e.g. Re-reading my favorite arc starting at volume 3."
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setIsSessionModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Start Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
