const definition = {
  "key": "admin:content",
  "name": "Admin Content",
  "description": "Manage catalog content, jobs, taxonomy, and cover.",
  "capabilityKeys": [
    "books:manage",
    "chapters:manage",
    "library:manage",
    "jobs:manage",
    "authors:manage",
    "genres:manage",
    "publication_statuses:manage",
    "cover:sync",
    "cover:manage",
    "translation:manage",
    "service:manage"
  ],
  "isSystem": true
} as const;

export default definition;
