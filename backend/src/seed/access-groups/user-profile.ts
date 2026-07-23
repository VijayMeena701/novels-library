const definition = {
  "key": "user:profile",
  "name": "User Profile",
  "description": "Manage own profile.",
  "resourceKey": "profile",
  "capabilityKeys": [
    "profile:read",
    "profile:update"
  ],
  "isSystem": true
} as const;

export default definition;
