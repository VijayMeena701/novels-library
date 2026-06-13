'use client';

import { use, useEffect, useState } from 'react';
import { api, Novel } from '../../../utils/api';
import { NovelCard } from '../../../components/NovelCard';

export default function GenrePage({ params }: { params: Promise<{ genre: string }> }) {
  const { genre: rawGenre } = use(params);
  const genre = decodeURIComponent(rawGenre);
  const [novels, setNovels] = useState<Novel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPublicCatalogNovels({ genre })
      .then(setNovels)
      .catch((err) => console.error('Failed to load genre novels:', err))
      .finally(() => setLoading(false));
  }, [genre]);

  return (
    <div className="container page-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">{genre}</h1>
          <p className="page-subtitle">Novels tagged with this genre.</p>
        </div>
      </div>

      {loading ? (
        <div className="spinner"></div>
      ) : novels.length === 0 ? (
        <div className="glass-card empty-state">
          No novels found for this genre.
        </div>
      ) : (
        <div className="novel-grid">
          {novels.map((novel) => <NovelCard key={novel._id} novel={novel} mode="catalog" />)}
        </div>
      )}
    </div>
  );
}
