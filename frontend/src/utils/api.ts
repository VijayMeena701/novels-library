export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5050/api";
const API_REQUEST_TIMEOUT_MS = 30000;
const API_TRANSLATION_TIMEOUT_MS = 70000;

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface User {
	id: string;
	username: string;
	email: string;
	role?: string;
	roles?: string[];
	roleIds?: string[];
	isSuperuser?: boolean;
	isDisabled?: boolean;
	isDeleted?: boolean;
	isVerified?: boolean;
	isLocked?: boolean;
	capabilities?: string[];
	avatarUrl?: string;
	authProvider?: "password" | "google" | "both";
}

export interface AdminRole {
	_id: string;
	key: string;
	name: string;
	description: string;
	isSuperuser: boolean;
	isSystem: boolean;
	groups: { _id: string; name: string }[];
}

export interface AdminUser {
	_id: string;
	username: string;
	email: string;
	roles: { _id: string; key: string; name: string }[];
	isDisabled: boolean;
	isLocked: boolean;
	isVerified: boolean;
	isDeleted: boolean;
}

export interface AdminGroup {
	_id: string;
	key: string;
	name: string;
	description: string;
	isSystem: boolean;
	resource?: { _id: string; key: string; name: string };
	capabilities: { _id: string; resource: { key: string; name: string }; action: { key: string; name: string } }[];
}

export interface AdminCapability {
	_id: string;
	resource: { _id: string; key: string; name: string };
	action: { _id: string; key: string; name: string };
}

export interface AdminUserCreatePayload {
	username: string;
	email: string;
	password: string;
	roleIds?: string[];
}

export interface AdminAction {
	_id: string;
	key: string;
	name: string;
}

export interface AdminResource {
	_id: string;
	key: string;
	name: string;
	description: string;
	isEnabled: boolean;
	isSystem: boolean;
	category: string;
	actions: AdminAction[];
}

export interface AdminAuditLog {
	_id: string;
	action: string;
	method: string;
	path: string;
	outcome: string;
	userId?: string;
	email?: string;
	ip?: string;
	timestamp: string;
}

export interface AdminUserUpdate {
	roleIds?: string[];
	isDisabled?: boolean;
	isLocked?: boolean;
	isVerified?: boolean;
}

export interface AdminRolePayload {
	key?: string;
	name?: string;
	description?: string;
	isSuperuser?: boolean;
	groupIds?: string[];
}

export interface AdminGroupPayload {
	key?: string;
	name?: string;
	description?: string;
	resourceId?: string;
	capabilityIds?: string[];
}

export type ReaderTheme = "dark" | "light" | "sepia";
export type ReaderWidth = "narrow" | "medium" | "wide";
export type ReaderHighlightMode = "off" | "paragraph" | "word";
export type ReaderAutoScrollBehavior = "smooth" | "instant";

export interface ReaderSettings {
	theme: ReaderTheme;
	fontSize: number;
	width: ReaderWidth;
	autoNext: boolean;
	speechRate: number;
	speechPitch: number;
	voiceURI: string;
	speechPortalPosition: {
		x: number;
		y: number;
	};
	highlightMode: ReaderHighlightMode;
	highlightParagraph: boolean;
	paragraphHighlightColor: string;
	wordHighlightColor: string;
	sentenceHighlightOpacity: number;
	autoScrollDuringSpeech: boolean;
	autoScrollBehavior: ReaderAutoScrollBehavior;
	autoScrollOffset: number;
}

export interface UserSettings {
	_id: string;
	userId: string;
	reader: ReaderSettings;
	createdAt: string;
	updatedAt: string;
}

export interface UpdateUserSettingsPayload {
	reader?: Partial<ReaderSettings>;
}

export type BookStatus = "reading" | "completed" | "on_hold" | "dropped" | "planning";

export interface ChapterIndex {
	title: string;
	url: string;
	chapterNumber: number;
	chapterType?: string;
}

export interface BookReview {
	_id: string;
	userId: string;
	username: string;
	review: string;
	createdAt: string;
}

export interface Notification {
	_id: string;
	userId: string;
	type: string;
	title: string;
	message: string;
	link?: string;
	read: boolean;
	createdAt: string;
}

export interface Report {
	_id: string;
	bookId: Book | string;
	reporterUserId: string;
	reason: string;
	description: string;
	status: string;
	createdAt: string;
}

export interface BookRequest {
	_id: string;
	title: string;
	description: string;
	requestedByUserId: { _id: string; username: string } | string;
	status: string;
	votes: number;
	createdAt: string;
}

export interface Book {
	_id: string;
	authorId?: string;
	title: string;
	author: string;
	authorPenName: string;
	authorRealName: string;
	alternativeNames: string[];
	genres: string[];
	genreKeys: string[];
	originalSource: string;
	originalSourceKey: string;
	publicationStatus: string;
	publicationStatusKey: string;
	description: string;
	coverUrl: string;
	coverImagePath: string;
	coverImageMimeType: string;
	coverImageSize: number;
	coverImageToken: string;
	coverImageSyncedAt?: string | null;
	sourceUrl: string;
	rawSourceUrl: string;
	rawOriginalLanguage: string;
	rawChaptersTotal: number;
	rawChaptersList: ChapterIndex[];
	status: BookStatus;
	translatedChaptersTotal: number;
	chaptersRead: number;
	rating: number;
	review: string;
	personalNotes: string;
	rawLegacyEntry: string;
	characterNotes: string;
	relationshipNotes: string;
	personalTags: string[];
	personalTagKeys: string[];
	completedAt?: string | null;
	translatedChaptersList: ChapterIndex[];
	lastVisitedChapterNumber?: number;
	lastVisitedAt?: string;
	ratingAverage?: number;
	ratingCount?: number;
	reviewCount?: number;
	totalVisits?: number;
	totalVotes?: number;
	userVoted?: boolean;
	userBookCreatedAt?: string;
	userBookUpdatedAt?: string;
	createdAt: string;
	updatedAt: string;
}

export interface HomeStats {
	totalBooks: number;
	totalChapters: number;
}

export interface HomePersonalStats {
	reading: number;
	completed: number;
	planning: number;
	onHold: number;
	dropped: number;
	totalChaptersRead: number;
}

export interface HomeResponse {
	stats: HomeStats;
	personal: { library: HomePersonalStats } | Record<string, never>;
	recentlyUpdated: Book[];
	topRated: Book[];
	mostVisited: Book[];
	topVoted: Book[];
	continueReading: Book[];
	activities: { _id: string; bookId: Book | string; activityType: string; chapterNumber?: number; chapterTitle?: string; createdAt: string }[];
}

export interface HistoryPagination {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
}

export interface Pagination {
	page: number;
	limit: number;
	total: number;
	pages: number;
}

export interface HistoryResponse {
	visits: ChapterVisit[];
	pagination: HistoryPagination;
}

export interface BookListFilters {
	status?: BookStatus | "all";
	genre?: string;
	source?: string;
	publicationStatus?: string;
	authorId?: string;
}

export interface CatalogBookFilters extends BookListFilters {
	search?: string;
	minRating?: number;
	maxRating?: number;
	sort?: "updatedAt" | "title" | "translatedChaptersTotal" | "rawChaptersTotal" | "rating" | "publicationStatus" | "createdAt" | "author" | "originalSource";
	sortDir?: "asc" | "desc";
	page?: number;
	pageSize?: number;
}

export interface PaginatedBooks {
	books: Book[];
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
}

export interface Source {
	key: string;
	name: string;
	count: number;
}

export function getBookCoverUrl(book: Pick<Book, "_id" | "coverUrl" | "coverImageToken" | "coverImageSyncedAt">): string {
	if (book.coverImageToken && book.coverImageSyncedAt) {
		return `${API_BASE_URL}/public/books/${book._id}/cover/${book.coverImageToken}?v=${encodeURIComponent(book.coverImageSyncedAt)}`;
	}

	return book.coverUrl || "";
}

export interface PronunciationRule {
	_id: string;
	userId: string;
	bookId?: string | null;
	isGlobal: boolean;
	pattern: string;
	replacement: string;
	wholeWord: boolean;
	caseSensitive: boolean;
	enabled: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface CreatePronunciationRulePayload {
	pattern: string;
	replacement?: string;
	wholeWord?: boolean;
	caseSensitive?: boolean;
	enabled?: boolean;
	isGlobal?: boolean;
}

export interface UpdatePronunciationRulePayload {
	pattern?: string;
	replacement?: string;
	wholeWord?: boolean;
	caseSensitive?: boolean;
	enabled?: boolean;
	isGlobal?: boolean;
}

export interface Genre {
	_id: string;
	name: string;
	key: string;
	aliases: string[];
	description?: string;
	bookCount?: number;
	createdAt: string;
	updatedAt: string;
}

export interface PublicationStatus {
	_id: string;
	name: string;
	key: string;
	aliases: string[];
	color?: string;
	sortOrder?: number;
	bookCount?: number;
	createdAt: string;
	updatedAt: string;
}

export interface ReadingSession {
	_id: string;
	bookId: string;
	startDate: string;
	endDate?: string;
	chaptersRead: number;
	notes: string;
	completed: boolean;
}

export interface Author {
	_id: string;
	displayName: string;
	penName: string;
	realName: string;
	alternativeNames: string[];
	nameKeys: string[];
	originalLanguage: string;
	officialUrls: string[];
	notes: string;
	bookCount?: number;
	createdAt: string;
	updatedAt: string;
}

export interface ChapterContent {
	_id: string;
	bookId: string;
	chapterNumber: number;
	chapterType?: string;
	title: string;
	content: string;
	sourceUrl: string;
	language?: string;
	scrapedAt: string;
}

export interface ChapterVisit {
	_id: string;
	bookId: string | Book;
	userId: string;
	sessionId?: string;
	chapterNumber: number;
	chapterTitle: string;
	chapterType?: string;
	sourceUrl: string;
	openedAt: string;
	createdAt: string;
	updatedAt: string;
}

export type JobType = "scrape_metadata" | "scrape_chapters" | "scrape_raw_metadata" | "scrape_raw_chapters";
export type JobStatus = "pending" | "processing" | "completed" | "failed" | "requires_manual_intervention";
export type SourceKind = "translated" | "raw";

export interface BackgroundJob {
	_id: string;
	bookId: string;
	type: JobType;
	status: JobStatus;
	progress: {
		current: number;
		total: number;
		message: string;
	};
	error?: {
		message: string;
		stack?: string;
		code?: string;
		url?: string;
		chapterNumber?: number;
		sourceKind?: "translated" | "raw";
	};
	retryCount: number;
	createdAt: string;
	updatedAt: string;
}

class ApiClient {
	private getHeaders(): HeadersInit {
		const headers: HeadersInit = {};
		if (typeof window !== "undefined") {
			const token = localStorage.getItem("novel_lib_token");
			if (token) {
				headers["Authorization"] = `Bearer ${token}`;
			}
		}
		return headers;
	}

	private async request<T>(endpoint: string, options: RequestInit & { timeoutMs?: number; suppressErrorToast?: boolean } = {}): Promise<T> {
		const url = `${API_BASE_URL}${endpoint}`;
		const { timeoutMs, suppressErrorToast, ...fetchOptions } = options;
		const headers = { ...this.getHeaders(), ...fetchOptions.headers } as Record<string, string>;
		if (fetchOptions.body && !(fetchOptions.body instanceof FormData) && !headers["Content-Type"]) {
			headers["Content-Type"] = "application/json";
		}

		const controller = new AbortController();
		const timeoutDuration = timeoutMs ?? API_REQUEST_TIMEOUT_MS;
		const timeout = typeof window !== "undefined" ? window.setTimeout(() => controller.abort(), timeoutDuration) : undefined;
		try {
			const response = await fetch(url, { ...fetchOptions, headers, signal: fetchOptions.signal || controller.signal });
			const contentType = response.headers.get("content-type") || "";
			const payload = contentType.includes("application/json") ? await response.json().catch(() => null) : await response.text().catch(() => "");
			if (!response.ok) {
				const errorData = typeof payload === "object" && payload ? payload as { error?: string; code?: string; details?: unknown } : {};
				const message = errorData.error || (typeof payload === "string" && payload.trim()) || `Request failed (${response.status}).`;
				const error = new ApiError(message, response.status, errorData.code, errorData.details);
				if (typeof window !== "undefined" && response.status !== 401 && !suppressErrorToast) window.dispatchEvent(new CustomEvent("novels-library:api-error", { detail: { message, variant: "error" } }));
				throw error;
			}
			return payload as T;
		} catch (error) {
			if (error instanceof ApiError) throw error;
			const message = error instanceof DOMException && error.name === "AbortError" ? "The request timed out. Check the backend and try again." : error instanceof Error ? error.message : "Network request failed.";
			if (typeof window !== "undefined" && !suppressErrorToast) window.dispatchEvent(new CustomEvent("novels-library:api-error", { detail: { message, variant: "error" } }));
			throw new ApiError(message, 0);
		} finally {
			if (timeout !== undefined) window.clearTimeout(timeout);
		}
	}

	// Auth Methods
	setToken(token: string) {
		localStorage.setItem("novel_lib_token", token);
	}

	logout() {
		localStorage.removeItem("novel_lib_token");
	}

	getGoogleLoginUrl(): string {
		return `${API_BASE_URL}/auth/google`;
	}

	isLoggedIn(): boolean {
		if (typeof window === "undefined") return false;
		return !!localStorage.getItem("novel_lib_token");
	}

	async login(email: string, password: string): Promise<{ token: string; user: User }> {
		const data = await this.request<{ token: string; user: User }>("/auth/login", {
			method: "POST",
			body: JSON.stringify({ email, password }),
		});
		this.setToken(data.token);
		return data;
	}

	async register(username: string, email: string, password: string): Promise<{ token: string; user: User }> {
		const data = await this.request<{ token: string; user: User }>("/auth/register", {
			method: "POST",
			body: JSON.stringify({ username, email, password }),
		});
		this.setToken(data.token);
		return data;
	}

	async getMe(): Promise<{ user: User }> {
		return this.request<{ user: User }>("/auth/me");
	}

	async updateMe(payload: { username?: string; avatarUrl?: string }): Promise<{ user: User }> {
		return this.request<{ user: User }>("/auth/me", {
			method: "PUT",
			body: JSON.stringify(payload),
		});
	}

	async getCapabilities(): Promise<{ capabilities: string[]; isSuperuser: boolean }> {
		return this.request<{ capabilities: string[]; isSuperuser: boolean }>("/auth/capabilities");
	}

	// Admin Methods
	async getAdminStats(): Promise<{ users: number; roles: number; groups: number; capabilities: number; resources: number; auditLogs: number }> {
		return this.request<{ users: number; roles: number; groups: number; capabilities: number; resources: number; auditLogs: number }>("/admin");
	}

	async listAdminCapabilities() {
		return this.request<{ capabilities: AdminCapability[] }>("/admin/capabilities");
	}

	async listAdminUsers(query: { search?: string; page?: number; limit?: number } = {}) {
		const params = new URLSearchParams();
		if (query.search) params.set("search", query.search);
		if (query.page !== undefined) params.set("page", String(query.page));
		if (query.limit !== undefined) params.set("limit", String(query.limit));
		const suffix = params.toString() ? `?${params.toString()}` : "";
		return this.request<{ users: AdminUser[]; total: number; page: number; limit: number; totalPages: number }>(`/admin/users${suffix}`);
	}

	async createAdminUser(payload: AdminUserCreatePayload) {
		return this.request<{ user: AdminUser }>("/admin/users", { method: "POST", body: JSON.stringify(payload) });
	}

	async updateAdminUser(id: string, payload: AdminUserUpdate) {
		return this.request<{ user: AdminUser }>(`/admin/users/${id}`, { method: "PUT", body: JSON.stringify(payload) });
	}

	async deleteAdminUser(id: string) {
		return this.request<{ success: boolean; message: string }>(`/admin/users/${id}`, { method: "DELETE" });
	}

	async listAdminRoles() {
		return this.request<{ roles: AdminRole[] }>("/admin/roles");
	}

	async createAdminRole(payload: AdminRolePayload) {
		return this.request<{ role: AdminRole }>("/admin/roles", { method: "POST", body: JSON.stringify(payload) });
	}

	async updateAdminRole(id: string, payload: AdminRolePayload) {
		return this.request<{ role: AdminRole }>(`/admin/roles/${id}`, { method: "PUT", body: JSON.stringify(payload) });
	}

	async deleteAdminRole(id: string) {
		return this.request<{ success: boolean; message: string }>(`/admin/roles/${id}`, { method: "DELETE" });
	}

	async listAdminGroups() {
		return this.request<{ groups: AdminGroup[] }>("/admin/groups");
	}

	async createAdminGroup(payload: AdminGroupPayload) {
		return this.request<{ group: AdminGroup }>("/admin/groups", { method: "POST", body: JSON.stringify(payload) });
	}

	async updateAdminGroup(id: string, payload: AdminGroupPayload) {
		return this.request<{ group: AdminGroup }>(`/admin/groups/${id}`, { method: "PUT", body: JSON.stringify(payload) });
	}

	async deleteAdminGroup(id: string) {
		return this.request<{ success: boolean; message: string }>(`/admin/groups/${id}`, { method: "DELETE" });
	}

	async listAdminResources() {
		return this.request<{ resources: AdminResource[] }>("/admin/resources");
	}

	async enableAdminResource(id: string, isEnabled: boolean) {
		return this.request<{ resource: AdminResource }>(`/admin/resources/${id}/enable`, { method: "PUT", body: JSON.stringify({ isEnabled }) });
	}

	async listAdminAuditLogs(query: { page?: number; limit?: number } = {}) {
		const params = new URLSearchParams();
		if (query.page !== undefined) params.set("page", String(query.page));
		if (query.limit !== undefined) params.set("limit", String(query.limit));
		const suffix = params.toString() ? `?${params.toString()}` : "";
		return this.request<{ logs: AdminAuditLog[]; total: number; page: number; limit: number; totalPages: number }>(`/admin/audit-logs${suffix}`);
	}

	// User Settings Methods
	async getSettings(): Promise<UserSettings> {
		return this.request<UserSettings>("/settings");
	}

	async updateSettings(settings: UpdateUserSettingsPayload): Promise<UserSettings> {
		return this.request<UserSettings>("/settings", {
			method: "PUT",
			body: JSON.stringify(settings),
		});
	}

	// Books Methods
	async getBooks(filters: BookListFilters = {}): Promise<Book[]> {
		const query = new URLSearchParams();

		if (filters.status && filters.status !== "all") {
			query.set("status", filters.status);
		}
		if (filters.genre) {
			query.set("genre", filters.genre);
		}
		if (filters.source) {
			query.set("source", filters.source);
		}
		if (filters.publicationStatus) {
			query.set("publicationStatus", filters.publicationStatus);
		}
		if (filters.authorId) {
			query.set("authorId", filters.authorId);
		}

		const suffix = query.toString() ? `?${query.toString()}` : "";
		return this.request<Book[]>(`/books${suffix}`);
	}

	async getCatalogBooks(filters: BookListFilters = {}): Promise<Book[]> {
		const query = new URLSearchParams();

		if (filters.status && filters.status !== "all") {
			query.set("status", filters.status);
		}
		if (filters.genre) {
			query.set("genre", filters.genre);
		}
		if (filters.source) {
			query.set("source", filters.source);
		}
		if (filters.publicationStatus) {
			query.set("publicationStatus", filters.publicationStatus);
		}
		if (filters.authorId) {
			query.set("authorId", filters.authorId);
		}

		const suffix = query.toString() ? `?${query.toString()}` : "";
		return this.request<Book[]>(`/catalog/books${suffix}`);
	}

	async updateCatalogBook(id: string, bookData: Partial<Book>): Promise<Book> {
		return this.request<Book>(`/catalog/books/${id}`, {
			method: "PUT",
			body: JSON.stringify(bookData),
		});
	}

	private buildCatalogQuery(filters: CatalogBookFilters, includePagination: boolean): URLSearchParams {
		const query = new URLSearchParams();

		if (filters.status && filters.status !== "all") {
			query.set("status", filters.status);
		}
		if (filters.genre) {
			query.set("genre", filters.genre);
		}
		if (filters.source) {
			query.set("source", filters.source);
		}
		if (filters.publicationStatus) {
			query.set("publicationStatus", filters.publicationStatus);
		}
		if (filters.authorId) {
			query.set("authorId", filters.authorId);
		}
		if (filters.search) {
			query.set("search", filters.search);
		}
		if (filters.minRating !== undefined && filters.minRating !== null) {
			query.set("minRating", String(filters.minRating));
		}
		if (filters.maxRating !== undefined && filters.maxRating !== null) {
			query.set("maxRating", String(filters.maxRating));
		}
		if (filters.sort) {
			query.set("sort", filters.sort);
		}
		if (filters.sortDir) {
			query.set("sortDir", filters.sortDir);
		}

		if (includePagination) {
			if (filters.page !== undefined && filters.page !== null) {
				query.set("page", String(filters.page));
			}
			if (filters.pageSize !== undefined && filters.pageSize !== null) {
				query.set("pageSize", String(filters.pageSize));
			}
		}

		return query;
	}

	async getPublicCatalogBooks(filters: CatalogBookFilters = {}): Promise<Book[]> {
		const query = this.buildCatalogQuery(filters, false);
		const suffix = query.toString() ? `?${query.toString()}` : "";
		return this.request<Book[]>(`/public/catalog/books${suffix}`);
	}

	async getPublicCatalogBooksPaginated(filters: CatalogBookFilters = {}): Promise<PaginatedBooks> {
		const query = this.buildCatalogQuery({ ...filters, page: filters.page ?? 1 }, true);
		const suffix = query.toString() ? `?${query.toString()}` : "";
		return this.request<PaginatedBooks>(`/public/catalog/books${suffix}`);
	}

	async getPublicBook(id: string): Promise<Book> {
		return this.request<Book>(`/public/books/${id}`);
	}

	async getBookReviews(id: string): Promise<{ reviews: BookReview[]; pagination: Pagination }> {
		return this.request<{ reviews: BookReview[]; pagination: Pagination }>(`/public/books/${id}/reviews`);
	}

	async voteBook(id: string): Promise<{ voted: boolean; totalVotes: number }> {
		return this.request<{ voted: boolean; totalVotes: number }>(`/books/${id}/vote`, { method: "POST" });
	}

	async getNotifications(unreadOnly?: boolean): Promise<{ notifications: Notification[]; unreadCount: number; pagination: Pagination }> {
		const query = unreadOnly ? "?unreadOnly=true" : "";
		return this.request<{ notifications: Notification[]; unreadCount: number; pagination: Pagination }>(`/notifications${query}`);
	}

	async markNotificationRead(id: string): Promise<{ notification: Notification }> {
		return this.request<{ notification: Notification }>(`/notifications/${id}/read`, { method: "PUT" });
	}

	async markAllNotificationsRead(): Promise<{ success: boolean }> {
		return this.request<{ success: boolean }>("/notifications/read-all", { method: "PUT" });
	}

	async createReport(bookId: string, reason: string, description: string): Promise<{ report: Report }> {
		return this.request<{ report: Report }>(`/books/${bookId}/report`, {
			method: "POST",
			body: JSON.stringify({ reason, description }),
		});
	}

	async getReports(): Promise<{ reports: Report[]; pagination: Pagination }> {
		return this.request<{ reports: Report[]; pagination: Pagination }>("/reports");
	}

	async updateReportStatus(reportId: string, status: string): Promise<{ report: Report }> {
		return this.request<{ report: Report }>(`/reports/${reportId}/status`, {
			method: "PUT",
			body: JSON.stringify({ status }),
		});
	}

	async getBookRequests(): Promise<{ requests: BookRequest[]; pagination: Pagination }> {
		return this.request<{ requests: BookRequest[]; pagination: Pagination }>("/requests");
	}

	async createBookRequest(title: string, description: string): Promise<{ request: BookRequest }> {
		return this.request<{ request: BookRequest }>("/requests", {
			method: "POST",
			body: JSON.stringify({ title, description }),
		});
	}

	async voteBookRequest(id: string): Promise<{ request: BookRequest }> {
		return this.request<{ request: BookRequest }>(`/requests/${id}/vote`, { method: "POST" });
	}

	async getAuthors(): Promise<Author[]> {
		return this.request<Author[]>("/authors");
	}

	async getAuthor(id: string): Promise<{ author: Author; books: Book[] }> {
		return this.request<{ author: Author; books: Book[] }>(`/authors/${id}`);
	}

	async getPublicAuthors(): Promise<Author[]> {
		return this.request<Author[]>("/public/authors");
	}

	async getPublicAuthor(id: string): Promise<{ author: Author; books: Book[] }> {
		return this.request<{ author: Author; books: Book[] }>(`/public/authors/${id}`);
	}

	async getPublicGenres(): Promise<Genre[]> {
		return this.request<Genre[]>("/public/genres");
	}

	async getPublicPublicationStatuses(): Promise<PublicationStatus[]> {
		return this.request<PublicationStatus[]>("/public/publication-statuses");
	}

	async getSources(): Promise<Source[]> {
		return this.request<Source[]>("/public/sources");
	}

	async getBook(id: string, options?: { suppressErrorToast?: boolean }): Promise<Book> {
		return this.request<Book>(`/books/${id}`, options);
	}

	async createBook(bookData: Partial<Book>): Promise<Book> {
		return this.request<Book>("/books", {
			method: "POST",
			body: JSON.stringify(bookData),
		});
	}

	async addBookToLibrary(id: string): Promise<Book> {
		return this.request<Book>(`/books/${id}/library`, {
			method: "POST",
		});
	}

	async updateBook(id: string, bookData: Partial<Book>): Promise<Book> {
		return this.request<Book>(`/books/${id}`, {
			method: "PUT",
			body: JSON.stringify(bookData),
		});
	}

	async syncCover(id: string, coverUrl?: string): Promise<Book> {
		return this.request<Book>(`/books/${id}/cover/sync`, {
			method: "POST",
			body: JSON.stringify(coverUrl ? { coverUrl } : {}),
		});
	}

	async deleteBook(id: string): Promise<{ success: boolean; message: string }> {
		return this.request<{ success: boolean; message: string }>(`/books/${id}`, {
			method: "DELETE",
		});
	}

	// Re-read Sessions Methods
	async getSessions(bookId: string): Promise<ReadingSession[]> {
		return this.request<ReadingSession[]>(`/books/${bookId}/re-read`);
	}

	async startSession(bookId: string, data: { notes?: string; chaptersRead?: number }): Promise<ReadingSession> {
		return this.request<ReadingSession>(`/books/${bookId}/re-read`, {
			method: "POST",
			body: JSON.stringify(data),
		});
	}

	async updateSession(bookId: string, sessionId: string, data: { notes?: string; chaptersRead?: number; completed?: boolean }): Promise<ReadingSession> {
		return this.request<ReadingSession>(`/books/${bookId}/re-read/${sessionId}`, {
			method: "PUT",
			body: JSON.stringify(data),
		});
	}

	// TTS Pronunciation Rules Methods (per-user, per-book or global)
	async getPronunciationRules(bookId: string): Promise<PronunciationRule[]> {
		return this.request<PronunciationRule[]>(`/books/${bookId}/pronunciation-rules`);
	}

	async createPronunciationRule(bookId: string, data: CreatePronunciationRulePayload): Promise<PronunciationRule> {
		return this.request<PronunciationRule>(`/books/${bookId}/pronunciation-rules`, {
			method: "POST",
			body: JSON.stringify(data),
		});
	}

	async updatePronunciationRule(ruleId: string, data: UpdatePronunciationRulePayload): Promise<PronunciationRule> {
		return this.request<PronunciationRule>(`/pronunciation-rules/${ruleId}`, {
			method: "PUT",
			body: JSON.stringify(data),
		});
	}

	async deletePronunciationRule(ruleId: string): Promise<{ success: boolean; message: string }> {
		return this.request<{ success: boolean; message: string }>(`/pronunciation-rules/${ruleId}`, {
			method: "DELETE",
		});
	}

	// Chapters Methods
	async getChapters(bookId: string): Promise<Omit<ChapterContent, "content">[]> {
		return this.request<Omit<ChapterContent, "content">[]>(`/books/${bookId}/chapters`);
	}

	async getChapter(bookId: string, chapterNumber: number): Promise<ChapterContent> {
		return this.request<ChapterContent>(`/books/${bookId}/chapters/${chapterNumber}`);
	}

	async getRawChapters(bookId: string): Promise<Omit<ChapterContent, "content">[]> {
		return this.request<Omit<ChapterContent, "content">[]>(`/books/${bookId}/raw-chapters`);
	}

	async getRawChapter(bookId: string, chapterNumber: number): Promise<ChapterContent> {
		return this.request<ChapterContent>(`/books/${bookId}/raw-chapters/${chapterNumber}`);
	}

	async translateRawChapter(
		bookId: string,
		chapterNumber: number,
		data: { targetLanguage?: string; overwrite?: boolean } = {},
	): Promise<{ success: boolean; message: string; chapter: ChapterContent; model?: string; reusedExisting: boolean }> {
		return this.request<{ success: boolean; message: string; chapter: ChapterContent; model?: string; reusedExisting: boolean }>(
			`/books/${bookId}/raw-chapters/${chapterNumber}/translate`,
			{
				method: "POST",
				body: JSON.stringify(data),
				timeoutMs: API_TRANSLATION_TIMEOUT_MS,
			},
		);
	}

	async getPublicChapters(bookId: string): Promise<Omit<ChapterContent, "content">[]> {
		return this.request<Omit<ChapterContent, "content">[]>(`/public/books/${bookId}/chapters`);
	}

	async getPublicChapter(bookId: string, chapterNumber: number): Promise<ChapterContent> {
		return this.request<ChapterContent>(`/public/books/${bookId}/chapters/${chapterNumber}`);
	}

	async getPublicRawChapters(bookId: string): Promise<Omit<ChapterContent, "content">[]> {
		return this.request<Omit<ChapterContent, "content">[]>(`/public/books/${bookId}/raw-chapters`);
	}

	async getPublicRawChapter(bookId: string, chapterNumber: number): Promise<ChapterContent> {
		return this.request<ChapterContent>(`/public/books/${bookId}/raw-chapters/${chapterNumber}`);
	}

	async getChapterVisits(bookId: string, limit = 100): Promise<ChapterVisit[]> {
		const query = new URLSearchParams({ limit: String(limit) });
		return this.request<ChapterVisit[]>(`/books/${bookId}/visits?${query.toString()}`);
	}

	async recordChapterVisit(bookId: string, chapterNumber: number): Promise<ChapterVisit> {
		return this.request<ChapterVisit>(`/books/${bookId}/chapters/${chapterNumber}/visits`, {
			method: "POST",
		});
	}

	// Background Jobs Methods
	async getJobs(): Promise<BackgroundJob[]> {
		return this.request<BackgroundJob[]>("/jobs");
	}

	async getBookJobs(bookId: string): Promise<BackgroundJob[]> {
		return this.request<BackgroundJob[]>(`/jobs/book/${bookId}`);
	}

	async retryJob(jobId: string): Promise<{ success: boolean; message: string; job: BackgroundJob }> {
		return this.request<{ success: boolean; message: string; job: BackgroundJob }>(`/jobs/${jobId}/retry`, {
			method: "POST",
		});
	}

	async openManualIntervention(jobId: string): Promise<{ success: boolean; message: string; url: string }> {
		return this.request<{ success: boolean; message: string; url: string }>(`/jobs/${jobId}/manual-intervention`, {
			method: "POST",
		});
	}

	async importRawHtmlIndex(
		bookId: string,
		data: { html: string; pageUrl?: string },
	): Promise<{ success: boolean; message: string; chaptersFound: number; book: Book; job: BackgroundJob }> {
		return this.request<{ success: boolean; message: string; chaptersFound: number; book: Book; job: BackgroundJob }>(
			`/jobs/book/${bookId}/import-raw-html`,
			{
				method: "POST",
				body: JSON.stringify(data),
			},
		);
	}

	async importHtmlIndex(
		bookId: string,
		data: { sourceKind: SourceKind; html: string; pageUrl?: string },
	): Promise<{ success: boolean; message: string; sourceKind: SourceKind; chaptersFound: number; book: Book; job: BackgroundJob }> {
		return this.request<{ success: boolean; message: string; sourceKind: SourceKind; chaptersFound: number; book: Book; job: BackgroundJob }>(
			`/jobs/book/${bookId}/import-html-index`,
			{
				method: "POST",
				body: JSON.stringify(data),
			},
		);
	}

	async importFailedChapterHtml(
		jobId: string,
		data: { html: string; pageUrl?: string },
	): Promise<{ success: boolean; message: string; chapterNumber: number; title: string; sourceUrl: string; job: BackgroundJob }> {
		return this.request<{ success: boolean; message: string; chapterNumber: number; title: string; sourceUrl: string; job: BackgroundJob }>(
			`/jobs/${jobId}/import-chapter-html`,
			{
				method: "POST",
				body: JSON.stringify(data),
			},
		);
	}

	async importChapterHtml(
		bookId: string,
		data: { sourceKind: SourceKind; chapterNumber: number; html: string; pageUrl?: string },
	): Promise<{ success: boolean; message: string; sourceKind: SourceKind; chapterNumber: number; title: string; sourceUrl: string }> {
		return this.request<{ success: boolean; message: string; sourceKind: SourceKind; chapterNumber: number; title: string; sourceUrl: string }>(
			`/jobs/book/${bookId}/import-chapter-html`,
			{
				method: "POST",
				body: JSON.stringify(data),
			},
		);
	}

	async triggerScrape(bookId: string, type: JobType): Promise<{ success: boolean; message: string; job: BackgroundJob }> {
		return this.request<{ success: boolean; message: string; job: BackgroundJob }>(`/jobs/book/${bookId}/scrape`, {
			method: "POST",
			body: JSON.stringify({ type }),
		});
	}

	async runScrapeNow(
		bookId: string,
		type: JobType,
		data: { limit?: number; chapterNumber?: number } = {},
	): Promise<{ success: boolean; message: string; result: unknown; book: Book; job: BackgroundJob }> {
		return this.request<{ success: boolean; message: string; result: unknown; book: Book; job: BackgroundJob }>(`/jobs/book/${bookId}/scrape-now`, {
			method: "POST",
			body: JSON.stringify({ type, ...data }),
		});
	}

	async getHome(): Promise<HomeResponse> {
		return this.request<HomeResponse>("/home");
	}

	async getHistory(page = 1, limit = 50): Promise<HistoryResponse> {
		return this.request<HistoryResponse>(`/history?page=${page}&limit=${limit}`);
	}
}

export const api = new ApiClient();
