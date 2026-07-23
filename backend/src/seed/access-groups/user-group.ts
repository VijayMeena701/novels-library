const definition = {
  "key": "user-group",
  "name": "User Access Group",
  "description": "",
  "capabilityKeys": [
    "books:read",
    "books:list",
    "books:create",
    "books:manage",
    "library:read",
    "library:add",
    "library:update",
    "library:delete",
    "chapters:read",
    "chapters:visit",
    "chapters:read_raw",
    "profile:read",
    "profile:update",
    "settings:read",
    "settings:update"
  ],
  "isSystem": false
} as const;

export default definition;
