'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { api, Author, Novel } from '../../../utils/api';
import { NovelCard } from '../../../components/NovelCard';

export default function AuthorDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [author, setAuthor] = useState<Author | null>(null);
  const [novels, setNovels] = useState<Novel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPublicAuthor(id)
      .then((data) => {
        setAuthor(data.author);
        setNovels(data.novels);
      })
      .catch((err) => console.error('Failed to load author:', err))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="container"><div className="spinner"></div></div>;
  }

  if (!author) {
    return (
      <div className="container">
        <h1>Author Not Found</h1>
        <Link href="/authors" className="btn btn-secondary" style={{ marginTop: '1rem' }}>Back to Authors</Link>
      </div>
    );
  }

  return (
    <div className="container page-stack">
      <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
        <Link href="/authors" className="nav-link">Back to Authors</Link>
        <h1 className="page-title">{author.displayName}</h1>
        {author.realName && <p style={{ color: 'var(--text-secondary)' }}>Real name: {author.realName}</p>}
        {author.originalLanguage && <p style={{ color: 'var(--text-secondary)' }}>Original language: {author.originalLanguage}</p>}
        {author.alternativeNames.length > 0 && (
          <p style={{ color: 'var(--text-muted)' }}>Also known as: {author.alternativeNames.join(', ')}</p>
        )}
      </div>

      <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h2 style={{ fontSize: '1.35rem' }}>Novels by {author.displayName}</h2>
        {novels.length === 0 ? (
          <div className="glass-card empty-state">No linked novels yet.</div>
        ) : (
          <div className="novel-grid">
            {novels.map((novel) => <NovelCard key={novel._id} novel={novel} mode="catalog" />)}
          </div>
        )}
      </section>
    </div>
  );
}
