const definition = {
  "key": "service:full",
  "name": "Service Full",
  "description": "Service/bot operations.",
  "resourceKey": "service",
  "capabilityKeys": [
    "service:read",
    "service:execute",
    "service:manage"
  ],
  "isSystem": true
} as const;

export default definition;
