import { User } from "./api";

export const CAPABILITY = {
  PROFILE_READ: "profile:read",
  PROFILE_UPDATE: "profile:update",
  SETTINGS_READ: "settings:read",
  SETTINGS_UPDATE: "settings:update",

  APP_CONFIG_READ: "app_config:read",
  APP_CONFIG_UPDATE: "app_config:update",
  APP_CONFIG_MANAGE: "app_config:manage",

  BOOKS_LIST: "books:list",
  BOOKS_READ: "books:read",
  BOOKS_CREATE: "books:create",
  BOOKS_UPDATE: "books:update",
  BOOKS_DELETE: "books:delete",
  BOOKS_MANAGE: "books:manage",

  LIBRARY_READ: "library:read",
  LIBRARY_ADD: "library:add",
  LIBRARY_UPDATE: "library:update",
  LIBRARY_DELETE: "library:delete",
  LIBRARY_MANAGE: "library:manage",

  CHAPTERS_LIST: "chapters:list",
  CHAPTERS_READ: "chapters:read",
  CHAPTERS_READ_RAW: "chapters:read_raw",
  CHAPTERS_TRANSLATE: "chapters:translate",
  CHAPTERS_VISIT: "chapters:visit",
  CHAPTERS_MANAGE: "chapters:manage",

  AUTHORS_LIST: "authors:list",
  AUTHORS_READ: "authors:read",
  AUTHORS_CREATE: "authors:create",
  AUTHORS_UPDATE: "authors:update",
  AUTHORS_DELETE: "authors:delete",
  AUTHORS_MANAGE: "authors:manage",

  GENRES_LIST: "genres:list",
  GENRES_READ: "genres:read",
  GENRES_CREATE: "genres:create",
  GENRES_UPDATE: "genres:update",
  GENRES_DELETE: "genres:delete",
  GENRES_MANAGE: "genres:manage",

  PUBLICATION_STATUSES_LIST: "publication_statuses:list",
  PUBLICATION_STATUSES_READ: "publication_statuses:read",
  PUBLICATION_STATUSES_CREATE: "publication_statuses:create",
  PUBLICATION_STATUSES_UPDATE: "publication_statuses:update",
  PUBLICATION_STATUSES_DELETE: "publication_statuses:delete",
  PUBLICATION_STATUSES_MANAGE: "publication_statuses:manage",

  JOBS_LIST: "jobs:list",
  JOBS_RETRY: "jobs:retry",
  JOBS_MANUAL_INTERVENTION: "jobs:manual_intervention",
  JOBS_IMPORT: "jobs:import",
  JOBS_SCRAPE: "jobs:scrape",
  JOBS_MANAGE: "jobs:manage",

  PRONUNCIATION_READ: "pronunciation:read",
  PRONUNCIATION_MANAGE: "pronunciation:manage",

  SESSIONS_READ: "sessions:read",
  SESSIONS_MANAGE: "sessions:manage",

  COVER_SYNC: "cover:sync",
  COVER_MANAGE: "cover:manage",
  TRANSLATION_EXECUTE: "translation:execute",
  TRANSLATION_MANAGE: "translation:manage",

  ADMIN_ACCESS: "admin:access",
  ADMIN_MANAGE: "admin:manage",

  USERS_LIST: "users:list",
  USERS_READ: "users:read",
  USERS_CREATE: "users:create",
  USERS_UPDATE: "users:update",
  USERS_DELETE: "users:delete",
  USERS_MANAGE: "users:manage",

  ROLES_LIST: "roles:list",
  ROLES_READ: "roles:read",
  ROLES_CREATE: "roles:create",
  ROLES_UPDATE: "roles:update",
  ROLES_DELETE: "roles:delete",
  ROLES_MANAGE: "roles:manage",

  GROUPS_LIST: "groups:list",
  GROUPS_READ: "groups:read",
  GROUPS_CREATE: "groups:create",
  GROUPS_UPDATE: "groups:update",
  GROUPS_DELETE: "groups:delete",
  GROUPS_MANAGE: "groups:manage",

  RESOURCES_LIST: "resources:list",
  RESOURCES_READ: "resources:read",
  RESOURCES_ENABLE: "resources:enable",
  RESOURCES_MANAGE: "resources:manage",

  AUDIT_LOGS_READ: "audit_logs:read",
  ACCESS_LOGS_READ: "access_logs:read",

  SERVICE_READ: "service:read",
  SERVICE_EXECUTE: "service:execute",
  SERVICE_MANAGE: "service:manage",
} as const;

export function hasCapability(user: User | null | undefined, capability: string): boolean {
  if (!user) return false;
  if (user.isSuperuser) return true;
  const capabilities = new Set(user.capabilities || []);
  return capabilities.has(capability) || capabilities.has(`${capability.split(":")[0]}:manage`);
}
