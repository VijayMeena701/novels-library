import { User } from "./api";

export const CAPABILITY = {
  AUTH_SELF: "auth.self",
  PUBLIC_CATALOG_READ: "public.catalog.read",
  PUBLIC_READ: "public.read",
  SETTINGS_READ: "settings.read",
  SETTINGS_UPDATE: "settings.update",
  LIBRARY_READ: "library.read",
  LIBRARY_ADD: "library.add",
  LIBRARY_UPDATE: "library.update",
  LIBRARY_DELETE: "library.delete",
  CATALOG_MANAGE: "catalog.manage",
  CATALOG_DELETE: "catalog.delete",
  COVER_SYNC: "cover.sync",
  CHAPTER_READ: "chapter.read",
  CHAPTER_READ_RAW: "chapter.read_raw",
  CHAPTER_TRANSLATE: "chapter.translate",
  CHAPTER_VISIT: "chapter.visit",
  SESSION_READ: "session.read",
  SESSION_MANAGE: "session.manage",
  PRONUNCIATION_READ: "pronunciation.read",
  PRONUNCIATION_MANAGE: "pronunciation.manage",
  AUTHOR_READ: "author.read",
  AUTHOR_MANAGE: "author.manage",
  GENRE_READ: "genre.read",
  GENRE_MANAGE: "genre.manage",
  PUBLICATION_STATUS_READ: "publication_status.read",
  PUBLICATION_STATUS_MANAGE: "publication_status.manage",
  JOB_READ: "job.read",
  JOB_RETRY: "job.retry",
  JOB_MANUAL_INTERVENTION: "job.manual_intervention",
  JOB_IMPORT: "job.import",
  JOB_SCRAPE: "job.scrape",
  RBAC_MANAGE: "rbac.manage",
} as const;

export function hasCapability(user: User | null | undefined, capability: string): boolean {
  if (!user) return false;
  const capabilities = new Set(user.capabilities || []);
  return capabilities.has(capability) || capabilities.has(CAPABILITY.RBAC_MANAGE) || user.role === "admin";
}
