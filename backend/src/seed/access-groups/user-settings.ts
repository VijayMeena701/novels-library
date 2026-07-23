const definition = {
  "key": "user:settings",
  "name": "User Settings",
  "description": "Manage user settings.",
  "resourceKey": "settings",
  "capabilityKeys": [
    "settings:read",
    "settings:update"
  ],
  "isSystem": true
} as const;

export default definition;
