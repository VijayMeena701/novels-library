'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, Novel, NovelStatus } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { NovelCard } from '../../components/NovelCard';
import { CAPABILITY } from '../../utils/permissions';

export default function Dashboard() {
  const { user, loading: authLoading, hasCapability } = useAuth();
  
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
      const created = await api.createNovel({
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
      window.location.href = `/novels/${created._id}`;
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
            Track reading status, personal notes, rereads, characters, and recall details.
          </p>
        </div>
        {hasCapability(CAPABILITY.NOVELS_CREATE) ? (
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            + Create Catalog Novel
          </button>
        ) : (
          <Link href="/" className="btn btn-primary">
            Browse Catalog
          </Link>
        )}
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
          {hasCapability(CAPABILITY.NOVELS_CREATE) ? (
            <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
              + Create Catalog Novel
            </button>
          ) : (
            <Link href="/" className="btn btn-primary">
              Browse Catalog
            </Link>
          )}
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
              <h2 style={{ fontSize: '1.5rem' }}>Create Catalog Novel</h2>
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

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.5fr_1fr]">
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

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  {submitting ? <span className="spinner"></span> : 'Create Catalog Novel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
