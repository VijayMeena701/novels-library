const definition = {
  "key": "user:tts",
  "name": "User TTS",
  "description": "Manage TTS pronunciation rules.",
  "resourceKey": "pronunciation",
  "capabilityKeys": [
    "pronunciation:read",
    "pronunciation:manage"
  ],
  "isSystem": true
} as const;

export default definition;
