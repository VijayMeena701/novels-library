# MongoDB Backup, Restore & Clone

Standalone scripts to **backup**, **restore**, and **clone** MongoDB databases between any two MongoDB instances (cloud ↔ local, cloud ↔ cloud, local ↔ local).

They live inside the `backend` project and use the same validated config the app uses. Values are read from `backend/.env` (or environment variables) through `backend/src/config/index.ts`.

## What is captured

- All databases, collections, documents, and indexes
- Collection validation schemas (JSON Schema validators)
- Collection options (capped, collation, views, etc.)
- Selected namespaces only — if you pick a specific database/collection
- Atlas App Services config (triggers, functions, values, etc.) — **only when `--include-atlas` is enabled**

## What is NOT captured

- Cluster-level Atlas settings (IP allowlists, network peering, backup schedules, encryption, etc.)
- Atlas App Services artifacts unless you opt in with Atlas credentials or the `appservices` CLI.

## Requirements

- Node.js 20+ (or 18+ with global `fetch`)
- MongoDB Database Tools: `mongodump` and `mongorestore`
  - Download: https://www.mongodb.com/docs/database-tools/installation/
- `mongoose` is used for automatic database/collection listing (no `mongosh` required)
- Optional: `appservices` CLI for Atlas App Services export
  - https://www.mongodb.com/docs/atlas/app-services/cli/

## Environment setup

All scripts use the same `backend/.env` file as the app. Put your backup-related variables there, for example:

```dotenv
# MongoDB backup/restore variables
SOURCE_MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/novels-library?retryWrites=true&w=majority
TARGET_MONGODB_URI=mongodb://127.0.0.1:27017/novels-library
BACKUP_DIR=./mongodb-backups
MONGODB_TOOLS_DIR=

# Optional Atlas App Services export
ATLAS_PUBLIC_KEY=
ATLAS_PRIVATE_KEY=
ATLAS_GROUP_ID=
ATLAS_APP_ID=
```

The config is validated by `backend/src/config/index.ts` on startup.

## Interactive CLI (recommended)

Run the guided wizard from the `backend` directory:

```bash
tsx scripts/mongodb-backup/cli.ts
```

The CLI can:

- Connect to **Cloud (Atlas)**, **Local**, or any custom URI
- List databases and collections using `mongoose`
- Export a whole database, a specific collection, or multiple collections
- Rename the database on restore (e.g. `prod_db` → `prod_db_backup`)
- Drop existing collections before restore (replace mode) or merge without dropping
- Create databases and collections automatically if they do not exist (`mongorestore` does this)

## Config file

You can also run the CLI from a JSON config file:

```bash
cp scripts/mongodb-backup/config.example.json scripts/mongodb-backup/mongodb-backup-config.json
tsx scripts/mongodb-backup/cli.ts
# Select "Config file" and enter the path
```

Example `mongodb-backup-config.json`:

```json
{
  "mode": "export",
  "source": "mongodb+srv://user:password@cluster.mongodb.net/novels-library?retryWrites=true&w=majority",
  "target": "mongodb://127.0.0.1:27017/novels-library",
  "backupDir": "./mongodb-backups/manual-run",
  "database": "novels-library",
  "collections": ["novels", "users"],
  "includeAtlas": false,
  "atlas": {
    "publicKey": "",
    "privateKey": "",
    "groupId": "",
    "appId": ""
  },
  "drop": false,
  "stopOnError": false,
  "rename": null,
  "toolsDir": ""
}
```

- `mode`: `export`, `import`, or `clone`
- `database`: database name, or `null` for all databases
- `collections`: array of collection names, or `null` for all collections
- `rename`: `null` or `{ "source": "old_db", "target": "new_db" }`
- `drop`: `true` to replace existing collections, `false` to merge
- `stopOnError`: `true` to stop on the first restore error
- `toolsDir`: directory with `mongodump`/`mongorestore` if not on PATH

If `source`/`target`/`backupDir` are omitted, the corresponding values are read from `backend/.env` (or environment variables) through the shared config.

## Non-interactive scripts

`backup.ts` and `restore.ts` are still available for automation.

### Backup

```bash
tsx scripts/mongodb-backup/backup.ts \
  --source "mongodb+srv://user:password@cluster.mongodb.net/novels-library?retryWrites=true&w=majority" \
  --out ./mongodb-backups/latest \
  --db novels-library
```

### Restore / rollback

```bash
# Replace existing collections
tsx scripts/mongodb-backup/restore.ts \
  --target "mongodb://127.0.0.1:27017/novels-library" \
  --backup ./mongodb-backups/<timestamp> \
  --drop

# Restore to a different database name
tsx scripts/mongodb-backup/restore.ts \
  --target "mongodb://127.0.0.1:27017" \
  --backup ./mongodb-backups/<timestamp> \
  --ns-include "old_db.*" \
  --ns-from "old_db.*" \
  --ns-to "new_db.*"
```

## Backup directory contents

- `data/` — compressed BSON dump and collection metadata (from `mongodump`)
- `metadata/summary.json` — readable list of collections, validation schemas, indexes
- `backup-info.json` — redacted backup metadata
- `atlas-app/` — optional Atlas App Services export (if enabled)

## Conflict handling

`mongorestore` cannot upsert BSON documents. When you choose **not** to drop:

- Existing documents with the same `_id` will cause errors in the log.
- By default `restore.ts` does **not** stop on those errors, so non-conflicting documents are still inserted.
- Use `--stop-on-error` or `--drop` to fail fast or replace collections.

## Atlas triggers / functions

MongoDB Atlas Triggers and Functions live in **Atlas App Services**, not in the database itself. They are only backed up if:

1. `includeAtlas` is true and Atlas credentials are set in `backend/.env`.
2. Either the `appservices` CLI is installed, or the script falls back to the Admin API and saves `atlas-app/app-export.zip`.

## Windows notes

- If `mongodump` / `mongorestore` are not on `PATH`, download MongoDB Database Tools and set `MONGODB_TOOLS_DIR` in `backend/.env`.
- Scripts are `.ts` and can be run from Command Prompt or PowerShell with `tsx`.
- Run the scripts from the `backend` directory so `mongodb-backups/` is created in the expected location.
