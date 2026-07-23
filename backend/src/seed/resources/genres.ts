const definition = {
  "key": "genres",
  "name": "Genres",
  "description": "Genre taxonomy.",
  "category": "taxonomy",
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
