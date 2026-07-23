# Future Features and Deferred Work

## Reader page Server Component refactor

- **Status:** deferred
- **Context:** The reader page (`frontend/src/app/books/[id]/reader/[chapterNumber]/page.tsx`) is currently a Client Component because it uses `useSearchParams`, `useAuth`, and many data/effect hooks. We discussed converting it to an `async` Server Component that fetches `readerModes` (and possibly the book/chapter data) server-side and passes props to a new `ReaderViewClient` component.
- **Benefit:** Reader-mode config and other system behavior would be loaded before the client renders, so users never see a separate "app config" request from the browser.
- **Blockers/Notes:** `useAuth` and the reader interactivity hooks (`useReaderSettings`, `useReaderTts`, etc.) must stay in the client half. The split is straightforward but touches a large file.

## Reader-mode configuration source

- **Status:** needs-review
- **Context:** `reader_modes` currently lives in the `AppConfig` collection and is exposed through the admin endpoints and the public `/app-config` endpoint. The reader page has been reverted and does not consume it; the backend no longer attaches it to the book response. When we pick this feature, we need to decide how the reader UI should receive the configuration without leaking the `AppConfig` concept to the client.
- **Question:** Should reader modes become a first-class `ReaderConfig` concept, or should they remain an `AppConfig` document that only server-side code reads?

## Clean up app-config frontend code

- **Status:** completed
- **Context:** The reader page was reverted to its pre-app-config state. The public `/app-config` endpoint remains registered on the backend for future use, but the frontend no longer calls it.
- **Cleanup:** `frontend/src/hooks/useReaderModes.ts`, `frontend/src/hooks/useAppConfig.ts`, and the `getAppConfig` method in `frontend/src/utils/api.ts` have been removed. `backend/src/routes/api/public/app-config/index.ts` is kept so the endpoint exists for the correct implementation later.

## RBAC AppConfig permissions

- **Status:** ready
- **Context:** MongoDB verification showed `app_config:read` is in `anonymous:public` and `user:public`, but missing from `service:full`, and the `admin:app_config` access group does not exist. If seeding is not run, admins and service accounts will lack app config permissions.
- **Action:** Add `app_config:read` to `service:full`, create `admin:app_config` access group, and add it to the `admin` role. This only matters once the admin AppConfig UI is actively used.
