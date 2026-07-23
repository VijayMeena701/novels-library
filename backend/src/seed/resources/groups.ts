const definition = {
  "key": "groups",
  "name": "Access Groups",
  "description": "RBAC access groups.",
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
