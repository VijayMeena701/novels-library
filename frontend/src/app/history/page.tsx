'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock } from 'lucide-react';
import { api, type Book, type BookVisit, type HistoryPagination } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { BookCard } from '../../components/BookCard';

function isBook(bookId: string | Book): bookId is Book {
	return typeof bookId === 'object' && bookId !== null && '_id' in bookId;
}

export default function HistoryPage() {
	const { user } = useAuth();
	const [visits, setVisits] = useState<BookVisit[]>([]);
	const [pagination, setPagination] = useState<HistoryPagination | null>(null);
	const [loading, setLoading] = useState(true);
	const [page, setPage] = useState(1);

	useEffect(() => {
		if (!user) return;
		let cancelled = false;
		setLoading(true);

		async function loadHistory() {
			try {
				const data = await api.getHistory(page, 25);
				if (!cancelled) {
					setVisits(data.visits);
					setPagination(data.pagination);
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		}

		void loadHistory();
		return () => {
			cancelled = true;
		};
	}, [user, page]);

	if (!user) {
		return (
			<div className="container flex flex-1 items-center justify-center py-24">
				<Card className="mx-auto max-w-md p-8 text-center">
					<h1 className="font-serif text-2xl font-medium text-foreground">Reading History</h1>
					<p className="mt-2 text-sm text-muted-copy">Sign in to view your reading history.</p>
					<Button asChild className="mt-6">
						<Link href="/login">Sign In</Link>
					</Button>
				</Card>
			</div>
		);
	}

	return (
		<div className="container py-8">
			<div className="mb-6 flex items-center justify-between">
				<h1 className="font-serif text-2xl font-medium text-foreground">Reading History</h1>
				<p className="text-sm text-muted-copy">{pagination ? `${pagination.total} visits` : ''}</p>
			</div>

			{loading ? (
				<div className="flex items-center justify-center py-24">
					<div className="spinner" style={{ width: 40, height: 40 }} />
				</div>
			) : visits.length === 0 ? (
				<Card className="p-8 text-center">
					<p className="text-muted-copy">No reading history yet. Start reading a book!</p>
					<Button asChild className="mt-4">
						<Link href="/books">Browse Catalog</Link>
					</Button>
				</Card>
			) : (
				<div className="grid gap-4">
					{visits.map((visit) => {
						const book = isBook(visit.bookId) ? visit.bookId : null;
						if (!book) return null;
						return (
							<Card key={visit._id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
								<div className="flex-1">
									<div className="flex items-center gap-2 text-sm text-muted-copy">
										<Clock className="size-4" />
										<span>{new Date(visit.openedAt).toLocaleString()}</span>
									</div>
									<Link
										href={`/books/${book._id}/reader/${visit.unitNumber}`}
										className="mt-1 block font-serif text-lg font-medium text-foreground hover:underline"
									>
										{book.title}
									</Link>
									<p className="text-sm text-muted-copy">
										Unit {visit.unitNumber}
										{visit.unitTitle ? `: ${visit.unitTitle}` : ''}
									</p>
								</div>
								<div className="w-full sm:w-40">
									<BookCard book={book} mode="profile" href={`/books/${book._id}/reader/${visit.unitNumber}`} />
								</div>
							</Card>
						);
					})}
				</div>
			)}

			{pagination && pagination.totalPages > 1 && (
				<div className="mt-6 flex items-center justify-center gap-2">
					<Button
						variant="secondary"
						disabled={page <= 1}
						onClick={() => setPage((p) => p - 1)}
					>
						Previous
					</Button>
					<span className="text-sm text-muted-copy">
						Page {pagination.page} of {pagination.totalPages}
					</span>
					<Button
						variant="secondary"
						disabled={page >= pagination.totalPages}
						onClick={() => setPage((p) => p + 1)}
					>
						Next
					</Button>
				</div>
			)}
		</div>
	);
}
