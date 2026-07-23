const definition = {
  "key": "jobs",
  "name": "Background Jobs",
  "description": "Background scraper jobs and tasks.",
  "category": "jobs",
  "actions": [
    "list",
    "retry",
    "manual_intervention",
    "import",
    "scrape",
    "manage"
  ],
  "isEnabled": true,
  "isSystem": true
} as const;

export default definition;
