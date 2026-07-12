'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { api, type BookRequest } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

const statusLabels: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  completed: 'Completed',
  declined: 'Declined',
};

export default function RequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<BookRequest[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadRequests() {
    setLoading(true);
    try {
      const data = await api.getBookRequests();
      setRequests(data.requests);
    } catch (err) {
      console.error('Failed to load requests:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setSubmitting(true);
    try {
      await api.createBookRequest(newTitle.trim(), newDescription.trim());
      setNewTitle('');
      setNewDescription('');
      await loadRequests();
    } catch (err) {
      console.error('Failed to create request:', err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVote(id: string) {
    try {
      const data = await api.voteBookRequest(id);
      setRequests((prev) =>
        prev.map((r) => (r._id === id ? data.request : r))
      );
    } catch (err) {
      console.error('Failed to vote:', err);
    }
  }

  useEffect(() => {
    void loadRequests();
  }, []);

  if (!user) {
    return (
      <div className="container py-12">
        <Card className="mx-auto max-w-2xl p-8 text-center">
          <h1 className="font-serif text-2xl font-medium text-foreground">Book Requests</h1>
          <p className="mt-2 text-sm text-muted-copy">Please log in to view and create book requests.</p>
          <Button asChild className="mt-4">
            <Link href="/login">Go to Login</Link>
          </Button>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container py-12 text-center text-sm text-muted-copy">Loading requests...</div>
    );
  }

  return (
    <div className="container py-6 md:py-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-serif text-2xl font-medium text-foreground mb-6">Book Requests</h1>

        <Card className="p-4 mb-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <Input
              placeholder="Book title or request title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              required
            />
            <textarea
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              rows={3}
              placeholder="Optional details..."
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
            />
            <Button type="submit" disabled={submitting} className="self-start">
              Submit Request
            </Button>
          </form>
        </Card>

        <Card className="divide-y divide-border overflow-hidden">
          {requests.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-copy">No requests yet. Be the first to request a book.</div>
          ) : (
            requests.map((request) => (
              <div key={request._id} className="p-4 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{request.title}</p>
                    <p className="text-xs text-muted-copy">
                      Requested by {typeof request.requestedByUserId === 'object' ? request.requestedByUserId.username : 'Unknown'} · {new Date(request.createdAt).toLocaleDateString()}
                    </p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-surface-muted text-muted-copy border border-border">
                      {statusLabels[request.status] || request.status}
                    </span>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => handleVote(request._id)}>
                    Vote ({request.votes})
                  </Button>
                </div>
                {request.description && <p className="text-sm text-muted-copy">{request.description}</p>}
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
