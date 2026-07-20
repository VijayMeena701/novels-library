'use client';
import { cn } from '../../lib/utils';

import { useEffect, useState, type FormEvent } from 'react';
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

  const handleImportChapterHtml = async (event: FormEvent) => {
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
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="xl" />
          <span className="text-copy">Loading background tasks registry...</span>
        </div>
      </div>
    );
  }

  if (!hasCapability(CAPABILITY.JOBS_LIST)) {
    return (
      <div className={cn("mx-auto w-full max-w-[1520px] px-5 pt-6 pb-12")}>
        <div className="rounded-lg border border-border bg-card shadow-card transition hover:border-border-hover hover:bg-card-hover hover:shadow-elevated p-12 text-center text-copy">
          <h1>Access Required</h1>
          <p className="mt-2 text-copy">
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
          <div className="text-2xl font-extrabold text-info">
            {jobs.filter(j => j.status === 'processing' || j.status === 'pending').length}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card shadow-card transition hover:border-border-hover hover:bg-card-hover hover:shadow-elevated p-4">
          <div className="text-xs font-bold uppercase tracking-normal text-muted-copy mb-1">Completed</div>
          <div className="text-2xl font-extrabold text-success">
            {jobs.filter(j => j.status === 'completed').length}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card shadow-card transition hover:border-border-hover hover:bg-card-hover hover:shadow-elevated p-4">
          <div className="text-xs font-bold uppercase tracking-normal text-muted-copy mb-1">Failed</div>
          <div className="text-2xl font-extrabold text-danger">
            {jobs.filter(j => j.status === 'failed').length}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card shadow-card transition hover:border-border-hover hover:bg-card-hover hover:shadow-elevated p-4">
          <div className="text-xs font-bold uppercase tracking-normal text-muted-copy mb-1">Needs Manual</div>
          <div className="text-2xl font-extrabold text-amber-700">
            {jobs.filter(j => j.status === 'requires_manual_intervention').length}
          </div>
        </div>
      </div>

      {/* Jobs Log Table */}
      <div className="overflow-x-auto rounded-lg border border-border bg-card p-6 shadow-card transition hover:border-border-hover hover:bg-card-hover hover:shadow-elevated">
        {jobs.length === 0 ? (
          <div className="p-8 text-center text-copy">
            No background crawler jobs have been scheduled yet.
          </div>
        ) : (
          <table className="w-full border-collapse text-left min-w-[800px]">
            <thead>
              <tr className="border-b border-border text-sm text-copy">
                <th className="px-4 py-3">Task ID</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Progress</th>
                <th className="px-4 py-3">Details</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const total = job.progress?.total || 0;
                const current = job.progress?.current || 0;
                const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
                
                return (
                  <tr key={job._id} className="border-b border-border text-[0.925rem]">
                    
                    {/* Job ID / Date */}
                    <td className="p-4">
                      <div className="font-mono text-[0.8rem] text-copy">
                        {job._id.substring(18)}...
                      </div>
                      <div className="mt-0.5 text-xs text-muted-copy">
                        {new Date(job.createdAt).toLocaleString()}
                      </div>
                    </td>

                    {/* Job Type */}
                    <td className="p-4">
                      <strong className="capitalize text-foreground">
                        {job.type.replace(/_/g, ' ')}
                      </strong>
                    </td>

                    {/* Status Badge */}
                    <td className="p-4">
                      <Badge variant={job.status}>{job.status}</Badge>
                    </td>

                    {/* Progress Bar */}
                    <td className="w-[220px] p-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-xs text-muted-copy">
                          <span>{current} / {total}</span>
                          <span>{percent}%</span>
                        </div>
                        <div className="h-1 w-full overflow-hidden rounded-sm bg-surface-muted">
                          <div
                            className={cn("h-full rounded-sm transition-all duration-300", job.status === 'failed' ? "bg-danger" : job.status === 'requires_manual_intervention' ? "bg-amber-700" : "bg-primary")}
                            style={{ width: `${percent}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>

                    {/* Progress message / Error Message */}
                    <td className="max-w-[360px] p-4">
                      {(job.status === 'failed' || job.status === 'requires_manual_intervention') && job.error ? (
                        <div className="flex flex-col gap-1.5">
                          <span className={cn("text-sm font-medium", job.status === 'failed' ? "text-danger" : "text-amber-700")} title={job.error.message}>
                            {job.error.message}
                          </span>
                          {job.error.url && (
                            <a href={job.error.url} target="_blank" rel="noreferrer" className="break-all text-xs text-copy">
                              {job.error.sourceKind === 'raw' ? 'Raw' : 'Translated'} chapter {job.error.chapterNumber || ''}: {job.error.url}
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-copy" title={job.progress?.message}>
                          {job.progress?.message || 'Queued...'}
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-right">
                      {job.status === 'requires_manual_intervention' ? (
                        <div className="flex flex-wrap justify-end gap-2">
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
                        <div className="flex flex-wrap justify-end gap-2">
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
                        <span className="text-sm text-muted-copy">
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
              <h2 className="text-[1.4rem]">
                Import {chapterHtmlJob.error?.sourceKind === 'raw' ? 'Raw ' : ''}Chapter {chapterHtmlJob.error?.chapterNumber || ''}
              </h2>
              <button
                className="cursor-pointer border-none bg-transparent text-2xl text-copy"
                onClick={() => setChapterHtmlJob(null)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleImportChapterHtml} className="flex flex-col gap-4">
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

              <div className="mt-2 flex justify-end gap-4">
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
