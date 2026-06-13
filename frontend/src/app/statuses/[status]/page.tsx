'use client';

import { use, useEffect, useState } from 'react';
import { api, Novel, NovelStatus } from '../../../utils/api';
import { NovelCard } from '../../../components/NovelCard';

const statusLabels: Record<string, string> = {
  reading: 'Reading',
  completed: 'Completed',
  on_hold: 'On Hold',
  dropped: 'Dropped',
  planning: 'Planning',
};

export default function StatusPage({ params }: { params: Promise<{ status: string }> }) {
  const { status } = use(params);
  const [novels, setNovels] = useState<Novel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPublicCatalogNovels({ status: status as NovelStatus })
      .then(setNovels)
      .catch((err) => console.error('Failed to load status novels:', err))
      .finally(() => setLoading(false));
  }, [status]);

  return (
    <div className="container page-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">{statusLabels[status] || status}</h1>
          <p className="page-subtitle">Novels with this reading status.</p>
        </div>
      </div>

      {loading ? (
        <div className="spinner"></div>
      ) : novels.length === 0 ? (
        <div className="glass-card empty-state">
          No novels found for this status.
        </div>
      ) : (
        <div className="novel-grid">
          {novels.map((novel) => <NovelCard key={novel._id} novel={novel} mode="catalog" />)}
        </div>
      )}
    </div>
  );
}
