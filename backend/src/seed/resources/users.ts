const definition = {
  "key": "users",
  "name": "Users",
  "description": "User accounts.",
  "category": "administration",
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
