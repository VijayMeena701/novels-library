const definition = {
  "key": "user:library",
  "name": "User Library",
  "description": "Manage personal library.",
  "resourceKey": "library",
  "capabilityKeys": [
    "library:read",
    "library:add",
    "library:update",
    "library:delete"
  ],
  "isSystem": true
} as const;

export default definition;
