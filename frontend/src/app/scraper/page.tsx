'use client';
import { cn } from '../../lib/utils';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, BackgroundJob } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { CAPABILITY } from '../../utils/permissions';
import { useToast } from '../../context/ToastContext';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input, Textarea } from '../../components/ui/input';
import { Spinner } from '../../components/ui/spinner';

export default function ScraperMonitor() {
  const { user, hasCapability } = useAuth();
  const { showToast } = useToast();
  const [jobs, setJobs] = useState<BackgroundJob[]>([]);
  const [loading, setLoading] = useState(false);
  const refreshInterval = 3000;
  const [chapterHtmlJob, setChapterHtmlJob] = useState<BackgroundJob | null>(null);
  const [chapterHtmlPageUrl, setChapterHtmlPageUrl] = useState('');
  const [chapterHtmlContent, setChapterHtmlContent] = useState('');
  const [importingChapterHtml, setImportingChapterHtml] = useState(false);

  const fetchJobs = async () => {
    try {
      const data = await api.getJobs();
      setJobs(data);
    } catch (err) {
      console.error('Failed to fetch background jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hasCapability(CAPABILITY.JOBS_LIST)) return;
    let cancelled = false;

    async function loadJobs() {
      setLoading(true);
      try {
        const data = await api.getJobs();
        if (!cancelled) setJobs(data);
      } catch (err) {
        if (!cancelled) console.error('Failed to fetch background jobs:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadJobs();
    return () => {
      cancelled = true;
    };
  }, [hasCapability]);

  // Auto-refresh when jobs are active
  useEffect(() => {
    if (!hasCapability(CAPABILITY.JOBS_LIST)) return;
    
    const hasActiveJobs = jobs.some(j => j.status === 'pending' || j.status === 'processing');
    
    if (hasActiveJobs) {
      const timer = setInterval(() => {
        fetchJobs();
      }, refreshInterval);
      return () => clearInterval(timer);
    }
  }, [jobs, user, refreshInterval, hasCapability]);

  const handleRetry = async (jobId: string) => {
    // Optimistic UI update
    setJobs(prev => prev.map(j => {
      if (j._id === jobId) {
        return { ...j, status: 'pending', error: undefined };
      }
      return j;
    }));

    try {
      await api.retryJob(jobId);
      await fetchJobs();
    } catch (err) {
      console.error('Failed to retry job:', err);
      showToast({ message: 'Error triggering retry: ' + (err instanceof Error ? err.message : 'Unknown error.'), variant: 'error' });
    }
  };

  const handleOpenManualIntervention = async (jobId: string) => {
    try {
      const result = await api.openManualIntervention(jobId);
      showToast({ message: result.message, variant: 'info' });
      await fetchJobs();
    } catch (err) {
      console.error('Failed to open manual browser:', err);
      showToast({ message: 'Error opening manual browser: ' + (err instanceof Error ? err.message : 'Unknown error.'), variant: 'error' });
    }
  };

  const openChapterHtmlImport = (job: BackgroundJob) => {
    setChapterHtmlJob(job);
    setChapterHtmlPageUrl(job.error?.url || '');
    setChapterHtmlContent('');
  };

  const handleImportChapterHtml = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!chapterHtmlJob) return;

    setImportingChapterHtml(true);
    try {
      const result = await api.importFailedChapterHtml(chapterHtmlJob._id, {
        html: chapterHtmlContent,
        pageUrl: chapterHtmlPageUrl || chapterHtmlJob.error?.url,
      });
      setChapterHtmlJob(null);
      setChapterHtmlContent('');
      showToast({ message: `${result.message} Retry the job to continue archiving.`, variant: 'success' });
      await fetchJobs();
    } catch (err) {
      console.error('Failed to import chapter HTML:', err);
      showToast({ message: 'Error importing chapter HTML: ' + (err instanceof Error ? err.message : 'Unknown error.'), variant: 'error' });
    } finally {
      setImportingChapterHtml(false);
    }
  };

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <Spinner size="xl" />
          <span style={{ color: 'var(--text-secondary)' }}>Loading background tasks registry...</span>
        </div>
      </div>
    );
  }

  if (!hasCapability(CAPABILITY.JOBS_LIST)) {
    return (
      <div className={cn("mx-auto w-full max-w-[1520px] px-5 pt-6 pb-12")}>
        <div className="rounded-lg border border-border bg-card shadow-card transition hover:border-border-hover hover:bg-card-hover hover:shadow-elevated p-12 text-center text-copy">
          <h1>Access Required</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Scraper jobs, raw imports, and archive controls are catalog administration tools.
          </p>
          <Button asChild variant="secondary" className="mt-4">
            <Link href="/profile">Back to Profile</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("mx-auto w-full max-w-[1520px] px-5 pt-6 pb-12", "flex flex-col gap-5")}>
      
      {/* Title */}
      <div className="flex items-end justify-between gap-4 py-1">
        <div>
          <h1 className="text-[clamp(1.55rem,3vw,2.2rem)] leading-tight mb-1">Scraper Dashboard</h1>
          <p className="text-copy max-w-[720px]">
            Monitor background archiving queues, track crawl progress, and manage failures.
          </p>
        </div>
        <Button variant="secondary" onClick={fetchJobs}>
          Refresh Status
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
        <div className="rounded-lg border border-border bg-card shadow-card transition hover:border-border-hover hover:bg-card-hover hover:shadow-elevated p-4">
          <div className="text-xs font-bold uppercase tracking-normal text-muted-copy mb-1">Total Jobs</div>
          <div className="text-2xl font-extrabold">{jobs.length}</div>
        </div>
        <div className="rounded-lg border border-border bg-card shadow-card transition hover:border-border-hover hover:bg-card-hover hover:shadow-elevated p-4">
          <div className="text-xs font-bold uppercase tracking-normal text-muted-copy mb-1">Active</div>
          <div className="text-2xl font-extrabold" style={{ color: 'var(--info)' }}>
            {jobs.filter(j => j.status === 'processing' || j.status === 'pending').length}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card shadow-card transition hover:border-border-hover hover:bg-card-hover hover:shadow-elevated p-4">
          <div className="text-xs font-bold uppercase tracking-normal text-muted-copy mb-1">Completed</div>
          <div className="text-2xl font-extrabold" style={{ color: 'var(--success)' }}>
            {jobs.filter(j => j.status === 'completed').length}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card shadow-card transition hover:border-border-hover hover:bg-card-hover hover:shadow-elevated p-4">
          <div className="text-xs font-bold uppercase tracking-normal text-muted-copy mb-1">Failed</div>
          <div className="text-2xl font-extrabold" style={{ color: 'var(--danger)' }}>
            {jobs.filter(j => j.status === 'failed').length}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card shadow-card transition hover:border-border-hover hover:bg-card-hover hover:shadow-elevated p-4">
          <div className="text-xs font-bold uppercase tracking-normal text-muted-copy mb-1">Needs Manual</div>
          <div className="text-2xl font-extrabold" style={{ color: '#b45309' }}>
            {jobs.filter(j => j.status === 'requires_manual_intervention').length}
          </div>
        </div>
      </div>

      {/* Jobs Log Table */}
      <div className="rounded-lg border border-border bg-card shadow-card transition hover:border-border-hover hover:bg-card-hover hover:shadow-elevated" style={{ overflowX: 'auto', padding: '1.5rem' }}>
        {jobs.length === 0 ? (
          <div className="p-12 text-center text-copy" style={{ padding: '2rem' }}>
            No background crawler jobs have been scheduled yet.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Task ID</th>
                <th style={{ padding: '0.75rem 1rem' }}>Type</th>
                <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem' }}>Progress</th>
                <th style={{ padding: '0.75rem 1rem' }}>Details</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const total = job.progress?.total || 0;
                const current = job.progress?.current || 0;
                const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
                
                return (
                  <tr key={job._id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.925rem' }}>
                    
                    {/* Job ID / Date */}
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {job._id.substring(18)}...
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {new Date(job.createdAt).toLocaleString()}
                      </div>
                    </td>

                    {/* Job Type */}
                    <td style={{ padding: '1rem' }}>
                      <strong style={{ textTransform: 'capitalize', color: 'var(--text-primary)' }}>
                        {job.type.replace(/_/g, ' ')}
                      </strong>
                    </td>

                    {/* Status Badge */}
                    <td style={{ padding: '1rem' }}>
                      <Badge variant={job.status}>{job.status}</Badge>
                    </td>

                    {/* Progress Bar */}
                    <td style={{ padding: '1rem', width: '220px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          <span>{current} / {total}</span>
                          <span>{percent}%</span>
                        </div>
                        <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--surface-3)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ 
                            width: `${percent}%`, 
                            height: '100%', 
                            backgroundColor: job.status === 'failed'
                              ? 'var(--danger)'
                              : job.status === 'requires_manual_intervention'
                                ? '#b45309'
                                : 'var(--primary)', 
                            borderRadius: '2px',
                            transition: 'width 0.3s ease'
                          }}></div>
                        </div>
                      </div>
                    </td>

                    {/* Progress message / Error Message */}
                    <td style={{ padding: '1rem', maxWidth: '360px' }}>
                      {(job.status === 'failed' || job.status === 'requires_manual_intervention') && job.error ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <span style={{ color: job.status === 'failed' ? 'var(--danger)' : '#b45309', fontSize: '0.85rem', fontWeight: '500' }} title={job.error.message}>
                            {job.error.message}
                          </span>
                          {job.error.url && (
                            <a href={job.error.url} target="_blank" rel="noreferrer" style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', wordBreak: 'break-all' }}>
                              {job.error.sourceKind === 'raw' ? 'Raw' : 'Translated'} chapter {job.error.chapterNumber || ''}: {job.error.url}
                            </a>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }} title={job.progress?.message}>
                          {job.progress?.message || 'Queued...'}
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      {job.status === 'requires_manual_intervention' ? (
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <Button variant="secondary"
                            size="sm"
                            onClick={() => handleOpenManualIntervention(job._id)}
                          >
                            Open Browser
                          </Button>
                          {job.error?.chapterNumber && job.error?.url && (
                            <Button variant="secondary"
                              size="sm"
                              onClick={() => openChapterHtmlImport(job)}
                            >
                              Import HTML
                            </Button>
                          )}
                          <Button variant="secondary"
                            size="sm"
                            className="border-amber-700/25 text-amber-700"
                            onClick={() => handleRetry(job._id)}
                          >
                            Retry
                          </Button>
                        </div>
                      ) : job.status === 'failed' ? (
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          {job.error?.chapterNumber && job.error?.url && (
                            <Button variant="secondary"
                              size="sm"
                              onClick={() => openChapterHtmlImport(job)}
                            >
                              Import HTML
                            </Button>
                          )}
                          <Button variant="secondary"
                            size="sm"
                            className="border-danger/25 text-danger"
                            onClick={() => handleRetry(job._id)}
                          >
                            Retry Job
                          </Button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          {job.status === 'completed' ? 'Synced' : 'Running...'}
                        </span>
                      )}
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {chapterHtmlJob && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[8px]">
          <div className="flex w-full max-w-[720px] max-h-[90vh] flex-col gap-5 overflow-auto rounded-lg border border-border bg-card p-5 shadow-lg">
            <div className="flex items-center justify-between gap-4">
              <h2 style={{ fontSize: '1.4rem' }}>
                Import {chapterHtmlJob.error?.sourceKind === 'raw' ? 'Raw ' : ''}Chapter {chapterHtmlJob.error?.chapterNumber || ''}
              </h2>
              <button onClick={() => setChapterHtmlJob(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleImportChapterHtml} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-copy">Chapter Page URL</label>
                <Input type="url"
                  
                  value={chapterHtmlPageUrl}
                  onChange={(e) => setChapterHtmlPageUrl(e.target.value)}
                  required
               />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-copy">Saved Chapter HTML</label>
                <Textarea rows={14}
                  value={chapterHtmlContent}
                  onChange={(e) => setChapterHtmlContent(e.target.value)}
                  placeholder="<html>..."
                  required
               />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                <Button type="button"
                  variant="secondary"
                  onClick={() => setChapterHtmlJob(null)}
                  disabled={importingChapterHtml}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={importingChapterHtml}>
                  {importingChapterHtml ? 'Importing...' : 'Save Chapter'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
