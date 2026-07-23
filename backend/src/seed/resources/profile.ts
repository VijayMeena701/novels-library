const definition = {
  "key": "profile",
  "name": "Profile",
  "description": "Current user profile.",
  "category": "user",
  "actions": [
    "read",
    "update",
    "manage"
  ],
  "isEnabled": true,
  "isSystem": true
} as const;

export default definition;
