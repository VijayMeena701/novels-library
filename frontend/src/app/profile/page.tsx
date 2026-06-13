'use client';

import React, { useEffect, useState } from 'react';
import { api, Novel, NovelStatus } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { NovelCard } from '../../components/NovelCard';

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  
  // Library state
  const [novels, setNovels] = useState<Novel[]>([]);
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
  const [newStatus, setNewStatus] = useState<NovelStatus>('reading');
  const [newChRead, setNewChRead] = useState(0);
  const [newCompletedAt, setNewCompletedAt] = useState('');
  const [newRating, setNewRating] = useState(0);
  const [newReview, setNewReview] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newRawLegacyEntry, setNewRawLegacyEntry] = useState('');
  const [newCharacterNotes, setNewCharacterNotes] = useState('');
  const [newRelationshipNotes, setNewRelationshipNotes] = useState('');
  const [newPersonalTags, setNewPersonalTags] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch novels list
  const fetchNovels = async () => {
    try {
      const data = await api.getNovels();
      setNovels(data);
    } catch (err) {
      console.error('Failed to load novels:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNovels();
    }
  }, [user]);

  // Quick increment chaptersRead
  const handleQuickIncrement = async (e: React.MouseEvent, novel: Novel) => {
    e.preventDefault(); // Prevent navigating to details link
    e.stopPropagation();
    
    const nextCh = novel.chaptersRead + 1;
    // Optimistic UI update
    setNovels(prev => prev.map(n => {
      if (n._id === novel._id) {
        let updatedStatus = n.status;
        if (n.chaptersTotal > 0 && nextCh >= n.chaptersTotal) {
          updatedStatus = 'completed';
        }
        return { ...n, chaptersRead: nextCh, status: updatedStatus as NovelStatus };
      }
      return n;
    }));

    try {
      await api.updateNovel(novel._id, { chaptersRead: nextCh });
    } catch (err) {
      console.error('Failed to update chapters read:', err);
      // Rollback on error
      fetchNovels();
    }
  };

  // Create novel submit
  const handleCreateNovel = async (e: React.FormEvent) => {
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
      await api.createNovel({
        title: newTitle,
        author: newAuthor,
        sourceUrl: newUrl,
        coverUrl: newCoverUrl,
        rawSourceUrl: newRawSourceUrl,
        rawOriginalLanguage: newRawOriginalLanguage,
        status: newStatus,
        chaptersRead: newChRead,
        completedAt: newCompletedAt ? new Date(newCompletedAt).toISOString() : null,
        rating: newRating,
        review: newReview,
        personalNotes: newNotes,
        rawLegacyEntry: newRawLegacyEntry,
        characterNotes: newCharacterNotes,
        relationshipNotes: newRelationshipNotes,
        personalTags: newPersonalTags.split(',').map((tag) => tag.trim()).filter(Boolean),
      });

      // Reset form & reload
      setNewTitle('');
      setNewAuthor('');
      setNewUrl('');
      setNewCoverUrl('');
      setNewRawSourceUrl('');
      setNewRawOriginalLanguage('');
      setNewStatus('reading');
      setNewChRead(0);
      setNewCompletedAt('');
      setNewRating(0);
      setNewReview('');
      setNewNotes('');
      setNewRawLegacyEntry('');
      setNewCharacterNotes('');
      setNewRelationshipNotes('');
      setNewPersonalTags('');
      setIsModalOpen(false);
      await fetchNovels();
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to create novel entry.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filters logic
  const filteredNovels = novels.filter((novel) => {
    const query = search.toLowerCase();
    const matchQuery = novel.title.toLowerCase().includes(search.toLowerCase()) || 
                       (novel.authorPenName || novel.author || novel.authorRealName || 'Unknown Author').toLowerCase().includes(query) ||
                       (novel.alternativeNames || []).some((name) => name.toLowerCase().includes(query)) ||
                       (novel.genres || []).some((genre) => genre.toLowerCase().includes(query)) ||
                       (novel.personalTags || []).some((tag) => tag.toLowerCase().includes(query)) ||
                       (novel.characterNotes || '').toLowerCase().includes(query) ||
                       (novel.relationshipNotes || '').toLowerCase().includes(query);
    const matchStatus = statusFilter === 'all' || novel.status === statusFilter;
    return matchQuery && matchStatus;
  });
  const stats = {
    total: novels.length,
    reading: novels.filter((novel) => novel.status === 'reading').length,
    completed: novels.filter((novel) => novel.status === 'completed').length,
    rawReady: novels.filter((novel) => Boolean(novel.rawSourceUrl || novel.rawChaptersTotal > 0)).length,
  };

  if (authLoading || loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div className="spinner" style={{ width: '40px', height: '40px' }}></div>
          <span style={{ color: 'var(--text-secondary)' }}>Loading library database...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container page-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Personal Library</h1>
          <p className="page-subtitle">
            Track reading logs, archive online chapters, and manage offline access.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          + Add New Novel
        </button>
      </div>

      <div className="stat-grid">
        <div className="glass-card stat-card">
          <div className="stat-label">Total</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-label">Reading</div>
          <div className="stat-value">{stats.reading}</div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-label">Completed</div>
          <div className="stat-value">{stats.completed}</div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-label">Raw Sources</div>
          <div className="stat-value">{stats.rawReady}</div>
        </div>
      </div>

      <div className="glass-card toolbar">
        <div style={{ flex: 1, minWidth: '280px' }}>
          <input 
            type="text" 
            className="form-input" 
            placeholder="Search title, author, genre, notes, characters..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ minWidth: '180px' }}>
          <select 
            className="form-select" 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="reading">📖 Reading</option>
            <option value="completed">✅ Completed</option>
            <option value="on_hold">⏳ On Hold</option>
            <option value="dropped">🛑 Dropped</option>
            <option value="planning">📋 Planning</option>
          </select>
        </div>
      </div>

      {filteredNovels.length === 0 ? (
        <div className="glass-card empty-state">
          <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            {search || statusFilter !== 'all' ? 'No novels match your filter query.' : 'Your reading library is empty.'}
          </p>
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            + Add Your First Novel
          </button>
        </div>
      ) : (
        <div className="novel-grid">
          {filteredNovels.map((novel) => (
            <NovelCard
              key={novel._id}
              novel={novel}
              href={`/profile/novels/${novel._id}`}
              action={
                <button
                  onClick={(e) => handleQuickIncrement(e, novel)}
                  className="btn btn-secondary"
                  style={{ minHeight: '30px', padding: '0.25rem 0.55rem', fontSize: '0.75rem' }}
                >
                  +1
                </button>
              }
            />
          ))}
        </div>
      )}

      {/* Add Novel Dialog Modal */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="glass-card modal-panel">
            <div className="flex-between">
              <h2 style={{ fontSize: '1.5rem' }}>Add New Novel</h2>
              <button 
                onClick={() => { setIsModalOpen(false); setSubmitError(''); }}
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

            <form onSubmit={handleCreateNovel} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Novel Web Link (Optional - for automated background scraping)</label>
                <input 
                  type="url" 
                  className="form-input" 
                  placeholder="https://example.com/novel/title"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                  If provided, our background crawler will download and archive metadata & chapters automatically.
                </span>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Cover Image URL (Optional)</label>
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://example.com/covers/title.jpg"
                  value={newCoverUrl}
                  onChange={(e) => setNewCoverUrl(e.target.value)}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                  Add this for manual entries, then use Sync Cover from the novel page to cache it locally.
                </span>
              </div>

              <div className="grid-cols-2" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Raw Source URL (Optional)</label>
                  <input
                    type="url"
                    className="form-input"
                    placeholder="Original-language source URL"
                    value={newRawSourceUrl}
                    onChange={(e) => setNewRawSourceUrl(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Raw Language</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Chinese"
                    value={newRawOriginalLanguage}
                    onChange={(e) => setNewRawOriginalLanguage(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid-cols-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Title {newUrl ? '(Optional)' : '(Required)'}</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder={newUrl ? 'Fetched automatically' : 'e.g. Lord of the Mysteries'}
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required={!newUrl}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Author (Optional)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder={newUrl ? 'Fetched automatically' : 'e.g. Cuttlefish'}
                    value={newAuthor}
                    onChange={(e) => setNewAuthor(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid-cols-3" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '1rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Status</label>
                  <select 
                    className="form-select"
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as NovelStatus)}
                  >
                    <option value="reading">📖 Reading</option>
                    <option value="completed">✅ Completed</option>
                    <option value="on_hold">⏳ On Hold</option>
                    <option value="dropped">🛑 Dropped</option>
                    <option value="planning">📋 Planning</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Chapters Read</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    min="0"
                    value={newChRead}
                    onChange={(e) => setNewChRead(Math.max(0, parseInt(e.target.value) || 0))}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Rating (1-5)</label>
                  <select 
                    className="form-select"
                    value={newRating}
                    onChange={(e) => setNewRating(parseInt(e.target.value))}
                  >
                    <option value="0">Unrated</option>
                    <option value="1">⭐ (Poor)</option>
                    <option value="2">⭐⭐ (Average)</option>
                    <option value="3">⭐⭐⭐ (Good)</option>
                    <option value="4">⭐⭐⭐⭐ (Excellent)</option>
                    <option value="5">⭐⭐⭐⭐⭐ (Masterpiece)</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Completed At (Optional)</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={newCompletedAt}
                  onChange={(e) => setNewCompletedAt(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">What did you like? Review notes (Optional)</label>
                <textarea 
                  className="form-textarea" 
                  rows={2}
                  placeholder="Summarize your opinion..."
                  value={newReview}
                  onChange={(e) => setNewReview(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Personal Reading Details (Optional)</label>
                <textarea 
                  className="form-textarea" 
                  rows={3}
                  placeholder="Where did you find it? Important elements, characters, settings..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Personal Tags (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Comma-separated recall/filter tags"
                  value={newPersonalTags}
                  onChange={(e) => setNewPersonalTags(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Original Legacy Entry (Optional)</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="Paste the old full record here so nothing is lost."
                  value={newRawLegacyEntry}
                  onChange={(e) => setNewRawLegacyEntry(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Character Notes (Optional)</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="Names, aliases, powers, roles, memory hooks..."
                  value={newCharacterNotes}
                  onChange={(e) => setNewCharacterNotes(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Relationship Notes (Optional)</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="Romance, family, factions, enemies, mentors..."
                  value={newRelationshipNotes}
                  onChange={(e) => setNewRelationshipNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => { setIsModalOpen(false); setSubmitError(''); }}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? <span className="spinner"></span> : 'Add Novel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
