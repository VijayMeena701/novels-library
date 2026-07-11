export interface ActionDefinition {
  key: string;
  name: string;
  description: string;
  isSystem?: boolean;
}

export const ACTIONS: ActionDefinition[] = [
  { key: 'list', name: 'List', description: 'List items in a collection.', isSystem: true },
  { key: 'read', name: 'Read', description: 'Read/view details of an item.', isSystem: true },
  { key: 'create', name: 'Create', description: 'Create a new item.', isSystem: true },
  { key: 'update', name: 'Update', description: 'Update an existing item.', isSystem: true },
  { key: 'delete', name: 'Delete', description: 'Delete an item.', isSystem: true },
  { key: 'manage', name: 'Manage', description: 'Full control over an item.', isSystem: true },
  { key: 'add', name: 'Add', description: 'Add an item to a collection.', isSystem: true },
  { key: 'retry', name: 'Retry', description: 'Retry a failed item.', isSystem: true },
  { key: 'manual_intervention', name: 'Manual Intervention', description: 'Perform manual intervention on a job.', isSystem: true },
  { key: 'import', name: 'Import', description: 'Import HTML data.', isSystem: true },
  { key: 'scrape', name: 'Scrape', description: 'Trigger a scraping action.', isSystem: true },
  { key: 'execute', name: 'Execute', description: 'Execute a one-off operation.', isSystem: true },
  { key: 'sync', name: 'Sync', description: 'Sync an external resource.', isSystem: true },
  { key: 'visit', name: 'Visit', description: 'Record a visit event.', isSystem: true },
  { key: 'read_raw', name: 'Read Raw', description: 'Read raw (untranslated) content.', isSystem: true },
  { key: 'translate', name: 'Translate', description: 'Translate content to another language.', isSystem: true },
  { key: 'enable', name: 'Enable', description: 'Enable/disable a resource toggle.', isSystem: true },
  { key: 'access', name: 'Access', description: 'Access an admin area.', isSystem: true },
];
