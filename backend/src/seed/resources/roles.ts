const definition = {
  "key": "roles",
  "name": "Roles",
  "description": "RBAC roles.",
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
