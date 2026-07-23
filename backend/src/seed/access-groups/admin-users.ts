const definition = {
  "key": "admin:users",
  "name": "Admin Users",
  "description": "Manage users, roles, and access groups (non-admin only).",
  "capabilityKeys": [
    "users:manage",
    "roles:manage",
    "groups:manage",
    "audit_logs:read",
    "access_logs:read"
  ],
  "isSystem": true
} as const;

export default definition;
