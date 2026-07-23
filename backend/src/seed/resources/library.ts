const definition = {
  "key": "library",
  "name": "Personal Library",
  "description": "User-specific library entries.",
  "category": "library",
  "actions": [
    "read",
    "add",
    "update",
    "delete",
    "manage"
  ],
  "isEnabled": true,
  "isSystem": true
} as const;

export default definition;
