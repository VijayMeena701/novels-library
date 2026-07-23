const definition = {
  "name": "reader_modes",
  "value": {
    "singlePage": {
      "enabled": true,
      "label": "Single Page"
    },
    "infinite": {
      "enabled": false,
      "label": "Infinite"
    },
    "oldReader": {
      "enabled": false,
      "label": "Old Reader"
    }
  },
  "description": "Feature toggles and labels for reader mode options in the bottom sheet."
} as const;

export default definition;
