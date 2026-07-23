const definition = {
  "key": "user",
  "name": "Authenticated User",
  "description": "Standard authenticated user.",
  "groupKeys": [
    "user:public",
    "user:library",
    "user:profile",
    "user:settings",
    "user:sessions",
    "user:tts"
  ],
  "isSuperuser": false,
  "isSystem": true,
  "isDefault": true
} as const;

export default definition;
