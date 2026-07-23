const definition = {
  "key": "user:sessions",
  "name": "User Reading Sessions",
  "description": "Manage reading sessions.",
  "resourceKey": "sessions",
  "capabilityKeys": [
    "sessions:read",
    "sessions:manage"
  ],
  "isSystem": true
} as const;

export default definition;
