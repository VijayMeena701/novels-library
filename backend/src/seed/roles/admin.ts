const definition = {
  "key": "admin",
  "name": "Administrator",
  "description": "Manages content, users, roles, and access groups (except admin-level roles).",
  "groupKeys": [
    "user:public",
    "user:library",
    "user:profile",
    "user:settings",
    "user:sessions",
    "user:tts",
    "user:translation",
    "admin:content",
    "admin:users",
    "admin:full"
  ],
  "isSuperuser": false,
  "isSystem": true,
  "isDefault": false
} as const;

export default definition;
