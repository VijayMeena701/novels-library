const definition = {
  "key": "user:public",
  "name": "User Public Read",
  "description": "Read public catalog and taxonomy.",
  "resourceKey": "books",
  "capabilityKeys": [
    "books:read",
    "chapters:read",
    "chapters:read_raw",
    "chapters:visit",
    "authors:read",
    "genres:read",
    "publication_statuses:read",
    "app_config:read"
  ],
  "isSystem": true
} as const;

export default definition;
