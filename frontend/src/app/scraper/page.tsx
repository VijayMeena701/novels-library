'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, BackgroundJob } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

export default function ScraperMonitor() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<BackgroundJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(3000); // Poll every 3s when processing

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
    if (user) {
      fetchJobs();
    }
  }, [user]);

  // Auto-refresh when jobs are active
  useEffect(() => {
    if (!user) return;
    
    const hasActiveJobs = jobs.some(j => j.status === 'pending' || j.status === 'processing');
    
    if (hasActiveJobs) {
      const timer = setInterval(() => {
        fetchJobs();
      }, refreshInterval);
      return () => clearInterval(timer);
    }
  }, [jobs, user, refreshInterval]);

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
      alert('Error triggering retry: ' + (err as any).message);
    }
  };

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div className="spinner" style={{ width: '40px', height: '40px' }}></div>
          <span style={{ color: 'var(--text-secondary)' }}>Loading background tasks registry...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container page-stack">
      
      {/* Title */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Scraper Dashboard</h1>
          <p className="page-subtitle">
            Monitor background archiving queues, track crawl progress, and manage failures.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={fetchJobs}>
          Refresh Status
        </button>
      </div>

      {/* Overview Stats */}
      <div className="stat-grid">
        <div className="glass-card stat-card">
          <div className="stat-label">Total Jobs</div>
          <div className="stat-value">{jobs.length}</div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-label">Active</div>
          <div className="stat-value" style={{ color: 'var(--info)' }}>
            {jobs.filter(j => j.status === 'processing' || j.status === 'pending').length}
          </div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-label">Completed</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            {jobs.filter(j => j.status === 'completed').length}
          </div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-label">Failed</div>
          <div className="stat-value" style={{ color: 'var(--danger)' }}>
            {jobs.filter(j => j.status === 'failed').length}
          </div>
        </div>
      </div>

      {/* Jobs Log Table */}
      <div className="glass-card" style={{ overflowX: 'auto', padding: '1.5rem' }}>
        {jobs.length === 0 ? (
          <div className="empty-state" style={{ padding: '2rem' }}>
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
                      <span className={`badge badge-${job.status}`}>
                        {job.status}
                      </span>
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
                            backgroundColor: job.status === 'failed' ? 'var(--danger)' : 'var(--primary)', 
                            borderRadius: '2px',
                            transition: 'width 0.3s ease'
                          }}></div>
                        </div>
                      </div>
                    </td>

                    {/* Progress message / Error Message */}
                    <td style={{ padding: '1rem', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {job.status === 'failed' && job.error ? (
                        <span style={{ color: 'var(--danger)', fontSize: '0.85rem', fontWeight: '500' }} title={job.error.message}>
                          {job.error.message}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }} title={job.progress?.message}>
                          {job.progress?.message || 'Queued...'}
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      {job.status === 'failed' ? (
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', borderColor: 'rgba(239, 68, 68, 0.25)', color: 'var(--danger)' }}
                          onClick={() => handleRetry(job._id)}
                        >
                          Retry Job
                        </button>
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

    </div>
  );
}
