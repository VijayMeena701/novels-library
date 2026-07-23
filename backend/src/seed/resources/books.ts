const definition = {
  "key": "books",
  "name": "Catalog Books",
  "description": "Public catalog books.",
  "category": "catalog",
  "actions": [
    "list",
    "read",
    "create",
    "update",
    "delete",
    "manage"
  ],
  "isEnabled": true,
  "isSystem": true
} as const;

export default definition;
