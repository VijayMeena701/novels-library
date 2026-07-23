const definition = {
  "key": "anonymous:public",
  "name": "Public Read",
  "description": "Public read-only access.",
  "capabilityKeys": [
    "books:read",
    "chapters:read",
    "chapters:read_raw",
    "authors:read",
    "genres:read",
    "publication_statuses:read",
    "app_config:read"
  ],
  "isSystem": true
} as const;

export default definition;
