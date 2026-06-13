export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050/api';

export interface User {
  id: string;
  username: string;
  email: string;
  role?: 'user' | 'admin';
  avatarUrl?: string;
  authProvider?: 'password' | 'google' | 'both';
}

export type ReaderTheme = 'dark' | 'light' | 'sepia';
export type ReaderWidth = 'narrow' | 'medium' | 'wide';

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

export type NovelStatus = 'reading' | 'completed' | 'on_hold' | 'dropped' | 'planning';

export interface ChapterIndex {
  title: string;
  url: string;
  number: number;
}

export interface Novel {
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
  status: NovelStatus;
  chaptersTotal: number;
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
  chaptersList: ChapterIndex[];
  createdAt: string;
  updatedAt: string;
}

export interface NovelListFilters {
  status?: NovelStatus | 'all';
  genre?: string;
  source?: string;
  publicationStatus?: string;
  authorId?: string;
}

export function getNovelCoverUrl(novel: Pick<Novel, '_id' | 'coverUrl' | 'coverImageToken' | 'coverImageSyncedAt'>): string {
  if (novel.coverImageToken && novel.coverImageSyncedAt) {
    return `${API_BASE_URL}/public/novels/${novel._id}/cover/${novel.coverImageToken}?v=${encodeURIComponent(novel.coverImageSyncedAt)}`;
  }

  return novel.coverUrl || '';
}

export interface ReadingSession {
  _id: string;
  novelId: string;
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
  novelCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChapterContent {
  _id: string;
  novelId: string;
  chapterNumber: number;
  title: string;
  content: string;
  sourceUrl: string;
  language?: string;
  scrapedAt: string;
}

export interface ChapterVisit {
  _id: string;
  novelId: string;
  userId: string;
  sessionId?: string;
  chapterNumber: number;
  chapterTitle: string;
  sourceUrl: string;
  openedAt: string;
  createdAt: string;
  updatedAt: string;
}

export type JobType = 'scrape_metadata' | 'scrape_chapters' | 'scrape_raw_metadata' | 'scrape_raw_chapters';
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'requires_manual_intervention';
export type SourceKind = 'translated' | 'raw';

export interface BackgroundJob {
  _id: string;
  novelId: string;
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
    sourceKind?: 'translated' | 'raw';
  };
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}

class ApiClient {
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {};
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('novel_lib_token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
    return headers;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = { ...this.getHeaders(), ...options.headers } as Record<string, string>;
    if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  // Auth Methods
  setToken(token: string) {
    localStorage.setItem('novel_lib_token', token);
  }

  logout() {
    localStorage.removeItem('novel_lib_token');
  }

  getGoogleLoginUrl(): string {
    return `${API_BASE_URL}/auth/google`;
  }

  isLoggedIn(): boolean {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem('novel_lib_token');
  }

  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const data = await this.request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.token);
    return data;
  }

  async register(username: string, email: string, password: string): Promise<{ token: string; user: User }> {
    const data = await this.request<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
    this.setToken(data.token);
    return data;
  }

  async getMe(): Promise<{ user: User }> {
    return this.request<{ user: User }>('/auth/me');
  }

  // User Settings Methods
  async getSettings(): Promise<UserSettings> {
    return this.request<UserSettings>('/settings');
  }

  async updateSettings(settings: UpdateUserSettingsPayload): Promise<UserSettings> {
    return this.request<UserSettings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  // Novels Methods
  async getNovels(filters: NovelListFilters = {}): Promise<Novel[]> {
    const query = new URLSearchParams();

    if (filters.status && filters.status !== 'all') {
      query.set('status', filters.status);
    }
    if (filters.genre) {
      query.set('genre', filters.genre);
    }
    if (filters.source) {
      query.set('source', filters.source);
    }
    if (filters.publicationStatus) {
      query.set('publicationStatus', filters.publicationStatus);
    }
    if (filters.authorId) {
      query.set('authorId', filters.authorId);
    }

    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.request<Novel[]>(`/novels${suffix}`);
  }

  async getCatalogNovels(filters: NovelListFilters = {}): Promise<Novel[]> {
    const query = new URLSearchParams();

    if (filters.status && filters.status !== 'all') {
      query.set('status', filters.status);
    }
    if (filters.genre) {
      query.set('genre', filters.genre);
    }
    if (filters.source) {
      query.set('source', filters.source);
    }
    if (filters.publicationStatus) {
      query.set('publicationStatus', filters.publicationStatus);
    }
    if (filters.authorId) {
      query.set('authorId', filters.authorId);
    }

    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.request<Novel[]>(`/catalog/novels${suffix}`);
  }

  async getPublicCatalogNovels(filters: NovelListFilters = {}): Promise<Novel[]> {
    const query = new URLSearchParams();

    if (filters.status && filters.status !== 'all') {
      query.set('status', filters.status);
    }
    if (filters.genre) {
      query.set('genre', filters.genre);
    }
    if (filters.source) {
      query.set('source', filters.source);
    }
    if (filters.publicationStatus) {
      query.set('publicationStatus', filters.publicationStatus);
    }
    if (filters.authorId) {
      query.set('authorId', filters.authorId);
    }

    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.request<Novel[]>(`/public/catalog/novels${suffix}`);
  }

  async getPublicNovel(id: string): Promise<Novel> {
    return this.request<Novel>(`/public/novels/${id}`);
  }

  async getAuthors(): Promise<Author[]> {
    return this.request<Author[]>('/authors');
  }

  async getAuthor(id: string): Promise<{ author: Author; novels: Novel[] }> {
    return this.request<{ author: Author; novels: Novel[] }>(`/authors/${id}`);
  }

  async getPublicAuthors(): Promise<Author[]> {
    return this.request<Author[]>('/public/authors');
  }

  async getPublicAuthor(id: string): Promise<{ author: Author; novels: Novel[] }> {
    return this.request<{ author: Author; novels: Novel[] }>(`/public/authors/${id}`);
  }

  async getNovel(id: string): Promise<Novel> {
    return this.request<Novel>(`/novels/${id}`);
  }

  async createNovel(novelData: Partial<Novel>): Promise<Novel> {
    return this.request<Novel>('/novels', {
      method: 'POST',
      body: JSON.stringify(novelData),
    });
  }

  async addNovelToLibrary(id: string): Promise<Novel> {
    return this.request<Novel>(`/novels/${id}/library`, {
      method: 'POST',
    });
  }

  async updateNovel(id: string, novelData: Partial<Novel>): Promise<Novel> {
    return this.request<Novel>(`/novels/${id}`, {
      method: 'PUT',
      body: JSON.stringify(novelData),
    });
  }

  async syncCover(id: string, coverUrl?: string): Promise<Novel> {
    return this.request<Novel>(`/novels/${id}/cover/sync`, {
      method: 'POST',
      body: JSON.stringify(coverUrl ? { coverUrl } : {}),
    });
  }

  async deleteNovel(id: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/novels/${id}`, {
      method: 'DELETE',
    });
  }

  // Re-read Sessions Methods
  async getSessions(novelId: string): Promise<ReadingSession[]> {
    return this.request<ReadingSession[]>(`/novels/${novelId}/re-read`);
  }

  async startSession(novelId: string, data: { notes?: string; chaptersRead?: number }): Promise<ReadingSession> {
    return this.request<ReadingSession>(`/novels/${novelId}/re-read`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSession(
    novelId: string, 
    sessionId: string, 
    data: { notes?: string; chaptersRead?: number; completed?: boolean }
  ): Promise<ReadingSession> {
    return this.request<ReadingSession>(`/novels/${novelId}/re-read/${sessionId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Chapters Methods
  async getChapters(novelId: string): Promise<Omit<ChapterContent, 'content'>[]> {
    return this.request<Omit<ChapterContent, 'content'>[]>(`/novels/${novelId}/chapters`);
  }

  async getChapter(novelId: string, chapterNumber: number): Promise<ChapterContent> {
    return this.request<ChapterContent>(`/novels/${novelId}/chapters/${chapterNumber}`);
  }

  async getRawChapters(novelId: string): Promise<Omit<ChapterContent, 'content'>[]> {
    return this.request<Omit<ChapterContent, 'content'>[]>(`/novels/${novelId}/raw-chapters`);
  }

  async getRawChapter(novelId: string, chapterNumber: number): Promise<ChapterContent> {
    return this.request<ChapterContent>(`/novels/${novelId}/raw-chapters/${chapterNumber}`);
  }

  async translateRawChapter(
    novelId: string,
    chapterNumber: number,
    data: { targetLanguage?: string; overwrite?: boolean } = {}
  ): Promise<{ success: boolean; message: string; chapter: ChapterContent; model?: string; reusedExisting: boolean }> {
    return this.request<{ success: boolean; message: string; chapter: ChapterContent; model?: string; reusedExisting: boolean }>(
      `/novels/${novelId}/raw-chapters/${chapterNumber}/translate`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  }

  async getPublicChapters(novelId: string): Promise<Omit<ChapterContent, 'content'>[]> {
    return this.request<Omit<ChapterContent, 'content'>[]>(`/public/novels/${novelId}/chapters`);
  }

  async getPublicChapter(novelId: string, chapterNumber: number): Promise<ChapterContent> {
    return this.request<ChapterContent>(`/public/novels/${novelId}/chapters/${chapterNumber}`);
  }

  async getPublicRawChapters(novelId: string): Promise<Omit<ChapterContent, 'content'>[]> {
    return this.request<Omit<ChapterContent, 'content'>[]>(`/public/novels/${novelId}/raw-chapters`);
  }

  async getPublicRawChapter(novelId: string, chapterNumber: number): Promise<ChapterContent> {
    return this.request<ChapterContent>(`/public/novels/${novelId}/raw-chapters/${chapterNumber}`);
  }

  async getChapterVisits(novelId: string, limit = 100): Promise<ChapterVisit[]> {
    const query = new URLSearchParams({ limit: String(limit) });
    return this.request<ChapterVisit[]>(`/novels/${novelId}/chapter-visits?${query.toString()}`);
  }

  async recordChapterVisit(novelId: string, chapterNumber: number): Promise<ChapterVisit> {
    return this.request<ChapterVisit>(`/novels/${novelId}/chapters/${chapterNumber}/visits`, {
      method: 'POST',
    });
  }

  // Background Jobs Methods
  async getJobs(): Promise<BackgroundJob[]> {
    return this.request<BackgroundJob[]>('/jobs');
  }

  async getNovelJobs(novelId: string): Promise<BackgroundJob[]> {
    return this.request<BackgroundJob[]>(`/jobs/novel/${novelId}`);
  }

  async retryJob(jobId: string): Promise<{ success: boolean; message: string; job: BackgroundJob }> {
    return this.request<{ success: boolean; message: string; job: BackgroundJob }>(`/jobs/${jobId}/retry`, {
      method: 'POST',
    });
  }

  async openManualIntervention(jobId: string): Promise<{ success: boolean; message: string; url: string }> {
    return this.request<{ success: boolean; message: string; url: string }>(`/jobs/${jobId}/manual-intervention`, {
      method: 'POST',
    });
  }

  async importRawHtmlIndex(
    novelId: string,
    data: { html: string; pageUrl?: string }
  ): Promise<{ success: boolean; message: string; chaptersFound: number; novel: Novel; job: BackgroundJob }> {
    return this.request<{ success: boolean; message: string; chaptersFound: number; novel: Novel; job: BackgroundJob }>(
      `/jobs/novel/${novelId}/import-raw-html`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  }

  async importHtmlIndex(
    novelId: string,
    data: { sourceKind: SourceKind; html: string; pageUrl?: string }
  ): Promise<{ success: boolean; message: string; sourceKind: SourceKind; chaptersFound: number; novel: Novel; job: BackgroundJob }> {
    return this.request<{ success: boolean; message: string; sourceKind: SourceKind; chaptersFound: number; novel: Novel; job: BackgroundJob }>(
      `/jobs/novel/${novelId}/import-html-index`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  }

  async importFailedChapterHtml(
    jobId: string,
    data: { html: string; pageUrl?: string }
  ): Promise<{ success: boolean; message: string; chapterNumber: number; title: string; sourceUrl: string; job: BackgroundJob }> {
    return this.request<{ success: boolean; message: string; chapterNumber: number; title: string; sourceUrl: string; job: BackgroundJob }>(
      `/jobs/${jobId}/import-chapter-html`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  }

  async importChapterHtml(
    novelId: string,
    data: { sourceKind: SourceKind; chapterNumber: number; html: string; pageUrl?: string }
  ): Promise<{ success: boolean; message: string; sourceKind: SourceKind; chapterNumber: number; title: string; sourceUrl: string }> {
    return this.request<{ success: boolean; message: string; sourceKind: SourceKind; chapterNumber: number; title: string; sourceUrl: string }>(
      `/jobs/novel/${novelId}/import-chapter-html`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  }

  async triggerScrape(novelId: string, type: JobType): Promise<{ success: boolean; message: string; job: BackgroundJob }> {
    return this.request<{ success: boolean; message: string; job: BackgroundJob }>(`/jobs/novel/${novelId}/scrape`, {
      method: 'POST',
      body: JSON.stringify({ type }),
    });
  }

  async runScrapeNow(
    novelId: string,
    type: JobType,
    data: { limit?: number; chapterNumber?: number } = {}
  ): Promise<{ success: boolean; message: string; result: unknown; novel: Novel; job: BackgroundJob }> {
    return this.request<{ success: boolean; message: string; result: unknown; novel: Novel; job: BackgroundJob }>(
      `/jobs/novel/${novelId}/scrape-now`,
      {
        method: 'POST',
        body: JSON.stringify({ type, ...data }),
      }
    );
  }
}

export const api = new ApiClient();
