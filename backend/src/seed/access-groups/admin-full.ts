const definition = {
  "key": "admin:full",
  "name": "Admin Console",
  "description": "Admin console access and management.",
  "resourceKey": "admin",
  "capabilityKeys": [
    "admin:access",
    "admin:manage"
  ],
  "isSystem": true
} as const;

export default definition;
