const definition = {
  "key": "resources",
  "name": "Resources",
  "description": "System resources and feature toggles.",
  "category": "administration",
  "actions": [
    "list",
    "read",
    "enable"
  ],
  "isEnabled": true,
  "isSystem": true
} as const;

export default definition;
