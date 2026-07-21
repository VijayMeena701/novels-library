"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Book, BookReview, BackgroundJob, ChapterContent, JobType, SourceKind } from "../../../utils/api";
import { api, ApiError, getBookCoverUrl } from "../../../utils/api";
import { useAuth } from "../../../context/AuthContext";
import { CAPABILITY } from "../../../utils/permissions";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { BookLibraryPanel } from "../../../components/BookLibraryPanel";
import { BookHero } from "../../../components/book/BookHero";
import { BookAdminConsole } from "../../../components/book/BookAdminConsole";
import { BookSummarySection } from "../../../components/book/BookSummarySection";
import { BookAuthorBooks } from "../../../components/book/BookAuthorBooks";
import { BookReviewsSection } from "../../../components/book/BookReviewsSection";
import { BookTableOfContents } from "../../../components/book/BookTableOfContents";
import { BookRawTableOfContents } from "../../../components/book/BookRawTableOfContents";
import { BookDetailsSidebar } from "../../../components/book/BookDetailsSidebar";
import { CatalogEditModal } from "../../../components/book/CatalogEditModal";
import { IndexHtmlImportModal } from "../../../components/book/IndexHtmlImportModal";
import { isGenericChapterTitle, type CatalogItem } from "../../../components/book/book-details-helpers";

export default function PublicBookDetails({ params }: { params: Promise<{ id: string }> }) {
	const { id } = use(params);
	const { user, hasCapability } = useAuth();

	const [book, setBook] = useState<Book | null>(null);
	const [chapters, setChapters] = useState<Omit<ChapterContent, "content">[]>([]);
	const [rawChapters, setRawChapters] = useState<Omit<ChapterContent, "content">[]>([]);
	const [authorBooks, setAuthorBooks] = useState<Book[]>([]);
	const [jobs, setJobs] = useState<BackgroundJob[]>([]);
	const [reviews, setReviews] = useState<BookReview[]>([]);
	const [loading, setLoading] = useState(true);
	const [isUserBook, setIsUserBook] = useState(false);
	const [voting, setVoting] = useState(false);
	const [voted, setVoted] = useState(false);

	const [jobsLoading, setJobsLoading] = useState(false);
	const [adding, setAdding] = useState(false);
	const [queueing, setQueueing] = useState<JobType | null>(null);
	const [runningNow, setRunningNow] = useState<JobType | null>(null);
	const [addMessage, setAddMessage] = useState("");
	const [adminMessage, setAdminMessage] = useState("");

	const [isEditCatalogOpen, setIsEditCatalogOpen] = useState(false);
	const [isIndexHtmlModalOpen, setIsIndexHtmlModalOpen] = useState(false);
	const [indexHtmlSourceKind, setIndexHtmlSourceKind] = useState<SourceKind>("translated");

	const [activeTab, setActiveTab] = useState<"read" | "admin" | "library">("read");
	const [chapterSearch, setChapterSearch] = useState("");
	const [chapterSort, setChapterSort] = useState<"asc" | "desc">("asc");

	const fetchBookJobs = async () => {
		if (!hasCapability(CAPABILITY.JOBS_LIST)) return;
		setJobsLoading(true);
		try {
			const jobData = await api.getBookJobs(id);
			setJobs(jobData);
		} catch (err) {
			console.error("Failed to load book jobs:", err);
		} finally {
			setJobsLoading(false);
		}
	};

	const refreshChapterLists = async () => {
		const [chapterData, rawChapterData] = await Promise.all([
			api.getPublicChapters(id).catch(() => []),
			api.getPublicRawChapters(id).catch(() => []),
		]);
		setChapters(chapterData);
		setRawChapters(rawChapterData);
	};

	useEffect(() => {
		async function loadBook() {
			setLoading(true);
			try {
				let bookData: Book;
				let userBook = false;
				if (user) {
					try {
						bookData = await api.getBook(id, { suppressErrorToast: true });
						userBook = true;
					} catch (err) {
						if (err instanceof ApiError && err.status === 404) {
							bookData = await api.getPublicBook(id);
						} else {
							throw err;
						}
					}
				} else {
					bookData = await api.getPublicBook(id);
				}
				const [chapterData, rawChapterData, authorData, reviewsData] = await Promise.all([
					api.getPublicChapters(id).catch(() => []),
					api.getPublicRawChapters(id).catch(() => []),
					bookData.authorId ? api.getPublicAuthor(bookData.authorId).catch(() => null) : Promise.resolve(null),
					api.getBookReviews(id).catch(() => ({ reviews: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } })),
				]);
				setBook(bookData);
				setIsUserBook(userBook);
				setVoted(bookData.userVoted || false);
				setChapters(chapterData);
				setRawChapters(rawChapterData);
				setAuthorBooks((authorData?.books || []).filter((item) => item._id !== bookData._id).slice(0, 6));
				setReviews(reviewsData.reviews || []);
			} catch (err) {
				console.error("Failed to load public book:", err);
			} finally {
				setLoading(false);
			}
		}
		loadBook();
	}, [id, user]);

	useEffect(() => {
		if (!hasCapability(CAPABILITY.JOBS_LIST)) return;
		let cancelled = false;

		async function loadBookJobs() {
			setJobsLoading(true);
			try {
				const jobData = await api.getBookJobs(id);
				if (!cancelled) setJobs(jobData);
			} catch (err) {
				if (!cancelled) console.error("Failed to load book jobs:", err);
			} finally {
				if (!cancelled) setJobsLoading(false);
			}
		}

		void loadBookJobs();
		return () => {
			cancelled = true;
		};
	}, [id, user?.capabilities, hasCapability]);

	const firstReadableChapter = useMemo(() => chapters[0]?.chapterNumber || 1, [chapters]);

	const continueChapter = useMemo(() => {
		if (!isUserBook || !book) return 0;
		const last = book.lastVisitedChapterNumber;
		if (last && last > 0) return last;
		const read = book.chaptersRead;
		if (read && read > 0) return read;
		return 0;
	}, [isUserBook, book]);

	const translatedCatalogItems = useMemo<CatalogItem[]>(() => {
		if (!book) return [];
		const archivedByNumber = new Map(chapters.map((chapter) => [chapter.chapterNumber, chapter]));
		const seen = new Set<number>();
		const indexedItems: CatalogItem[] = [];
		for (const chapter of book.translatedChaptersList || []) {
			if (!Number.isFinite(chapter.chapterNumber) || seen.has(chapter.chapterNumber)) continue;
			seen.add(chapter.chapterNumber);
			const archived = archivedByNumber.get(chapter.chapterNumber);
			const archivedTitle = archived?.title?.trim() || "";
			const indexedTitle = chapter.title?.trim() || "";
			indexedItems.push({
				chapterNumber: chapter.chapterNumber,
				title:
					archivedTitle && !isGenericChapterTitle(archivedTitle, book.title, chapter.chapterNumber)
						? archivedTitle
						: indexedTitle || archivedTitle || `Chapter ${chapter.chapterNumber}`,
				archived: Boolean(archived),
				sourceUrl: archived?.sourceUrl || chapter.url,
				scrapedAt: archived?.scrapedAt,
			});
		}

		const archivedOnlyItems = Array.from(archivedByNumber.values())
			.filter((chapter) => !seen.has(chapter.chapterNumber))
			.map((chapter) => ({
				chapterNumber: chapter.chapterNumber,
				title: chapter.title || `Chapter ${chapter.chapterNumber}`,
				archived: true,
				sourceUrl: chapter.sourceUrl,
				scrapedAt: chapter.scrapedAt,
			}));

		return [...indexedItems, ...archivedOnlyItems].sort((a, b) => a.chapterNumber - b.chapterNumber);
	}, [book, chapters]);

	const rawCatalogItems = useMemo<CatalogItem[]>(() => {
		if (!book) return [];
		const archivedByNumber = new Map(rawChapters.map((chapter) => [chapter.chapterNumber, chapter]));
		const seen = new Set<number>();
		const indexedItems: CatalogItem[] = [];
		for (const chapter of book.rawChaptersList || []) {
			if (!Number.isFinite(chapter.chapterNumber) || seen.has(chapter.chapterNumber)) continue;
			seen.add(chapter.chapterNumber);
			const archived = archivedByNumber.get(chapter.chapterNumber);
			const archivedTitle = archived?.title?.trim() || "";
			const indexedTitle = chapter.title?.trim() || "";
			indexedItems.push({
				chapterNumber: chapter.chapterNumber,
				title:
					archivedTitle && !isGenericChapterTitle(archivedTitle, book.title, chapter.chapterNumber)
						? archivedTitle
						: indexedTitle || archivedTitle || `Raw Chapter ${chapter.chapterNumber}`,
				archived: Boolean(archived),
				sourceUrl: archived?.sourceUrl || chapter.url,
				scrapedAt: archived?.scrapedAt,
			});
		}

		const archivedOnlyItems = Array.from(archivedByNumber.values())
			.filter((chapter) => !seen.has(chapter.chapterNumber))
			.map((chapter) => ({
				chapterNumber: chapter.chapterNumber,
				title: chapter.title || `Raw Chapter ${chapter.chapterNumber}`,
				archived: true,
				sourceUrl: chapter.sourceUrl,
				scrapedAt: chapter.scrapedAt,
			}));

		return [...indexedItems, ...archivedOnlyItems].sort((a, b) => a.chapterNumber - b.chapterNumber);
	}, [book, rawChapters]);

	const firstReadableRawChapter = useMemo(
		() => rawCatalogItems[0]?.chapterNumber || rawChapters[0]?.chapterNumber || 1,
		[rawCatalogItems, rawChapters],
	);

	const sortedTranslatedItems = useMemo(() => {
		let items = [...translatedCatalogItems];
		if (chapterSearch.trim()) {
			const searchLower = chapterSearch.toLowerCase();
			items = items.filter(
				(item) => item.chapterNumber.toString().includes(searchLower) || item.title.toLowerCase().includes(searchLower),
			);
		}
		if (chapterSort === "desc") {
			items.reverse();
		}
		return items;
	}, [translatedCatalogItems, chapterSearch, chapterSort]);

	const sortedRawItems = useMemo(() => {
		let items = [...rawCatalogItems];
		if (chapterSearch.trim()) {
			const searchLower = chapterSearch.toLowerCase();
			items = items.filter(
				(item) => item.chapterNumber.toString().includes(searchLower) || item.title.toLowerCase().includes(searchLower),
			);
		}
		if (chapterSort === "desc") {
			items.reverse();
		}
		return items;
	}, [rawCatalogItems, chapterSearch, chapterSort]);

	const coverSrc = book ? getBookCoverUrl(book) : "";
	const canManageCatalog = hasCapability(CAPABILITY.BOOKS_MANAGE) || hasCapability(CAPABILITY.BOOKS_CREATE) || hasCapability(CAPABILITY.BOOKS_UPDATE);
	const canReadJobs = hasCapability(CAPABILITY.JOBS_LIST);
	const canScrape = hasCapability(CAPABILITY.JOBS_SCRAPE);
	const canImport = hasCapability(CAPABILITY.JOBS_IMPORT);
	const canAdmin = canManageCatalog || canReadJobs || canScrape || canImport;
	const activeJobTypes = useMemo(() => new Set(jobs.filter((job) => job.status === "pending" || job.status === "processing").map((job) => job.type)), [jobs]);
	const processingJobCount = jobs.filter((job) => job.status === "pending" || job.status === "processing").length;
	const translatedChapterTotal = book?.translatedChaptersTotal || translatedCatalogItems.length || 0;
	const translatedArchivePercent = translatedChapterTotal ? Math.min(100, Math.round((chapters.length / translatedChapterTotal) * 100)) : 0;

	const handleAddToLibrary = async () => {
		if (!book || !user) return;
		setAdding(true);
		setAddMessage("");
		try {
			const created = await api.addBookToLibrary(book._id);
			setAddMessage("Added to your profile library.");
			window.setTimeout(() => {
				window.location.href = `/books/${created._id}`;
			}, 700);
		} catch (err: unknown) {
			setAddMessage(err instanceof Error ? err.message : "Could not add this book.");
		} finally {
			setAdding(false);
		}
	};

	const handleVote = async () => {
		if (!book || !user) return;
		setVoting(true);
		try {
			const result = await api.voteBook(book._id);
			setBook((prev) => (prev ? { ...prev, totalVotes: result.totalVotes, userVoted: result.voted } : prev));
			setVoted(result.voted);
		} catch (err) {
			console.error("Failed to vote for book:", err);
		} finally {
			setVoting(false);
		}
	};

	const handleTriggerScrape = async (type: JobType) => {
		if (!book) return;
		setQueueing(type);
		setAdminMessage("");
		try {
			const result = await api.triggerScrape(book._id, type);
			setAdminMessage(result.message || "Scraper job queued.");
			await fetchBookJobs();
		} catch (err: unknown) {
			setAdminMessage(err instanceof Error ? err.message : "Could not queue scraper job.");
		} finally {
			setQueueing(null);
		}
	};

	const handleRunScrapeNow = async (type: JobType) => {
		if (!book) return;
		setRunningNow(type);
		setAdminMessage("");
		try {
			const result = await api.runScrapeNow(book._id, type, { limit: 5 });
			setBook(result.book);
			await refreshChapterLists();
			setAdminMessage(result.message || "Direct scraper run completed.");
			await fetchBookJobs();
		} catch (err: unknown) {
			setAdminMessage(err instanceof Error ? err.message : "Direct scraper run failed.");
			await fetchBookJobs();
		} finally {
			setRunningNow(null);
		}
	};

	const openIndexHtmlImport = (sourceKind: SourceKind) => {
		if (!book) return;
		setIndexHtmlSourceKind(sourceKind);
		setIsIndexHtmlModalOpen(true);
	};

	const handleIndexHtmlImported = async (result: { book: Book; message?: string }) => {
		setBook(result.book);
		await refreshChapterLists();
		setAdminMessage(result.message || "Catalogue imported.");
		await fetchBookJobs();
	};

	const handleCatalogSaved = (updated: Book) => {
		setBook(updated);
		setIsEditCatalogOpen(false);
	};

	if (loading) {
		return (
			<div className="w-full max-w-[1520px] mx-auto px-5 py-8">
				<Card className="p-12 text-center flex flex-col items-center justify-center border-[#dfd6c8] bg-[#fffdf8]">
					<div className="w-10 h-10 border-4 border-slate-200 border-t-[#405f8f] rounded-full animate-spin" />
				</Card>
			</div>
		);
	}

	if (!book) {
		return (
			<div className="w-full max-w-[1520px] mx-auto px-5 py-8">
				<Card className="p-12 text-center border-[#dfd6c8] bg-[#fffdf8]">
					<h1 className="text-xl font-extrabold text-[#24211d]">Book Not Found</h1>
					<Button asChild variant="secondary" className="mt-4 text-xs font-bold border-[#dfd6c8] hover:bg-slate-50">
						<Link href="/">Back Home</Link>
					</Button>
				</Card>
			</div>
		);
	}

	return (
		<div className="w-full max-w-[1520px] mx-auto px-4 md:px-5 py-6 md:py-8 flex flex-col gap-6">
			<BookHero
				book={book}
				chaptersCount={chapters.length}
				rawCatalogCount={rawCatalogItems.length}
				coverSrc={coverSrc}
				user={user}
				isUserBook={isUserBook}
				adding={adding}
				addMessage={addMessage}
				firstReadableChapter={firstReadableChapter}
				continueChapter={continueChapter}
				firstReadableRawChapter={firstReadableRawChapter}
				onAddToLibrary={handleAddToLibrary}
				voting={voting}
				voted={voted}
				onVote={handleVote}
			/>

			{(canAdmin || isUserBook) && (
				<div className="flex gap-6 border-b-2 border-[#dfd6c8] mt-2 pb-0.5">
					<button
						className={`relative pb-2.5 text-sm font-bold transition-all ${
							activeTab === "read"
								? "text-[#405f8f] after:absolute after:bottom-[-2px] after:left-0 after:right-0 after:h-[3px] after:bg-[#405f8f] after:rounded-full"
								: "text-[#877d70] hover:text-[#24211d]"
						}`}
						onClick={() => setActiveTab("read")}
					>
						📖 Reader View
					</button>
					{isUserBook && (
						<button
							className={`relative pb-2.5 text-sm font-bold transition-all ${
								activeTab === "library"
									? "text-[#405f8f] after:absolute after:bottom-[-2px] after:left-0 after:right-0 after:h-[3px] after:bg-[#405f8f] after:rounded-full"
									: "text-[#877d70] hover:text-[#24211d]"
							}`}
							onClick={() => setActiveTab("library")}
						>
							🗂️ My Library
						</button>
					)}
					{canAdmin && (
						<button
							className={`relative pb-2.5 text-sm font-bold transition-all ${
								activeTab === "admin"
									? "text-[#405f8f] after:absolute after:bottom-[-2px] after:left-0 after:right-0 after:h-[3px] after:bg-[#405f8f] after:rounded-full"
									: "text-[#877d70] hover:text-[#24211d]"
							}`}
							onClick={() => setActiveTab("admin")}
						>
							⚡ Scraper & Admin Tools
						</button>
					)}
				</div>
			)}

			{canAdmin && activeTab === "admin" && (
				<BookAdminConsole
					book={book}
					jobs={jobs}
					activeJobTypes={activeJobTypes}
					processingJobCount={processingJobCount}
					translatedArchivePercent={translatedArchivePercent}
					canScrape={canScrape}
					canImport={canImport}
					canReadJobs={canReadJobs}
					canManageCatalog={canManageCatalog}
					queueing={queueing}
					runningNow={runningNow}
					jobsLoading={jobsLoading}
					adminMessage={adminMessage}
					onTriggerScrape={handleTriggerScrape}
					onRunScrapeNow={handleRunScrapeNow}
					onEditCatalog={() => setIsEditCatalogOpen(true)}
					onRefreshJobs={fetchBookJobs}
					onOpenIndexHtmlImport={openIndexHtmlImport}
				/>
			)}

			{isUserBook && activeTab === "library" && (
				<BookLibraryPanel bookId={id} book={book} chapters={chapters} onUpdate={(updated) => setBook(updated)} />
			)}

			{activeTab === "read" && (
				<div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
					<main className="flex flex-col gap-6">
						<BookSummarySection book={book} />
						<BookAuthorBooks authorBooks={authorBooks} />
						<BookReviewsSection reviews={reviews} />
						<BookTableOfContents
							book={book}
							chapters={chapters}
							sortedItems={sortedTranslatedItems}
							chapterSearch={chapterSearch}
							chapterSort={chapterSort}
							onSearchChange={setChapterSearch}
							onSortToggle={() => setChapterSort((prev) => (prev === "asc" ? "desc" : "asc"))}
						/>
						{(book.rawChaptersTotal > 0 || rawCatalogItems.length > 0) && (
							<BookRawTableOfContents
								book={book}
								rawChapters={rawChapters}
								sortedRawItems={sortedRawItems}
								chapterSearch={chapterSearch}
								chapterSort={chapterSort}
								firstReadableRawChapter={firstReadableRawChapter}
								onSearchChange={setChapterSearch}
								onSortToggle={() => setChapterSort((prev) => (prev === "asc" ? "desc" : "asc"))}
							/>
						)}
					</main>

					<BookDetailsSidebar book={book} chaptersCount={chapters.length} sortedItemsCount={translatedCatalogItems.length} />
				</div>
			)}

			{canImport && (
				<IndexHtmlImportModal
					book={book}
					sourceKind={indexHtmlSourceKind}
					isOpen={isIndexHtmlModalOpen}
					onClose={() => setIsIndexHtmlModalOpen(false)}
					onImported={handleIndexHtmlImported}
				/>
			)}

			{canManageCatalog && (
				<CatalogEditModal
					book={book}
					isOpen={isEditCatalogOpen}
					onClose={() => setIsEditCatalogOpen(false)}
					onSaved={handleCatalogSaved}
				/>
			)}
		</div>
	);
}
