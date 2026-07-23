const definition = {
  "key": "authors",
  "name": "Authors",
  "description": "Author taxonomy.",
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
