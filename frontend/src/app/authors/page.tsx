'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, Author } from '../../utils/api';

export default function AuthorsPage() {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPublicAuthors()
      .then(setAuthors)
      .catch((err) => console.error('Failed to load authors:', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container page-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Authors</h1>
          <p className="page-subtitle">Browse novels by pen name, real name, and aliases.</p>
        </div>
      </div>

      {loading ? (
        <div className="spinner"></div>
      ) : authors.length === 0 ? (
        <div className="glass-card empty-state">
          No authors have been linked yet. Scrape metadata or edit a novel author to create author records.
        </div>
      ) : (
        <div className="novel-grid">
          {authors.map((author) => (
            <Link key={author._id} href={`/authors/${author._id}`} style={{ textDecoration: 'none' }}>
              <div className="glass-card" style={{ padding: '1.25rem', minHeight: '150px', height: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <h3 style={{ fontSize: '1.1rem' }}>{author.displayName}</h3>
                {author.realName && <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Real name: {author.realName}</p>}
                {author.alternativeNames.length > 0 && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{author.alternativeNames.slice(0, 3).join(', ')}</p>
                )}
                <span style={{ marginTop: 'auto', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  {author.novelCount || 0} linked novel{author.novelCount === 1 ? '' : 's'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
