'use client';
import { cn } from '../../../lib/utils';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type Report } from '../../../utils/api';
import { useAuth } from '../../../context/AuthContext';
import { CAPABILITY } from '../../../utils/permissions';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';

const statusLabels: Record<string, string> = {
  open: 'Open',
  under_review: 'Under Review',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
};

const statusColors: Record<string, string> = {
  open: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  under_review: 'bg-blue-100 text-blue-800 border-blue-300',
  resolved: 'bg-green-100 text-green-800 border-green-300',
  dismissed: 'bg-gray-100 text-gray-800 border-gray-300',
};

export default function AdminReportsPage() {
  const router = useRouter();
  const { user, hasCapability } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadReports() {
    setLoading(true);
    try {
      const data = await api.getReports();
      setReports(data.reports);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(reportId: string, status: string) {
    try {
      await api.updateReportStatus(reportId, status);
      setReports((prev) =>
        prev.map((r) => (r._id === reportId ? { ...r, status } : r))
      );
    } catch (err) {
      console.error('Failed to update report status:', err);
    }
  }

  useEffect(() => {
    if (!user || !hasCapability(CAPABILITY.BOOKS_MANAGE)) {
      router.push('/');
      return;
    }
    void loadReports();
  }, [user, hasCapability, router]);

  if (!user || !hasCapability(CAPABILITY.BOOKS_MANAGE)) {
    return null;
  }

  if (loading) {
    return (
      <div className={cn("mx-auto w-full max-w-[1520px] px-5 pt-6 pb-12", "py-12 text-center text-sm text-muted-copy")}>Loading reports...</div>
    );
  }

  return (
    <div className={cn("mx-auto w-full max-w-[1520px] px-5 pt-6 pb-12", "py-6 md:py-8")}>
      <h1 className="font-serif text-2xl font-medium text-foreground mb-6">Reports & Moderation</h1>
      <Card className="divide-y divide-border overflow-hidden">
        {reports.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-copy">No reports.</div>
        ) : (
          reports.map((report) => (
            <div key={report._id} className="p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={statusColors[report.status] || ''}>
                    {statusLabels[report.status] || report.status}
                  </Badge>
                  <span className="text-sm font-semibold text-foreground">
                    {typeof report.bookId === 'object' ? report.bookId.title : report.bookId}
                  </span>
                </div>
                <span className="text-xs text-muted-copy">{new Date(report.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-sm text-muted-copy capitalize">{report.reason.replace(/_/g, ' ')}</p>
              {report.description && <p className="text-sm text-copy">{report.description}</p>}
              <div className="flex flex-wrap gap-2 mt-1">
                {report.status !== 'under_review' && (
                  <Button size="sm" variant="secondary" onClick={() => updateStatus(report._id, 'under_review')}>
                    Under Review
                  </Button>
                )}
                {report.status !== 'resolved' && (
                  <Button size="sm" variant="secondary" onClick={() => updateStatus(report._id, 'resolved')}>
                    Resolve
                  </Button>
                )}
                {report.status !== 'dismissed' && (
                  <Button size="sm" variant="secondary" onClick={() => updateStatus(report._id, 'dismissed')}>
                    Dismiss
                  </Button>
                )}
                {report.status !== 'open' && (
                  <Button size="sm" variant="secondary" onClick={() => updateStatus(report._id, 'open')}>
                    Reopen
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
