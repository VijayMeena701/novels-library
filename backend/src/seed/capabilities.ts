import { RESOURCES } from './resources';

export interface CapabilityDefinition {
  resourceKey: string;
  actionKey: string;
  category: string;
  isSystem?: boolean;
}

export const CAPABILITIES: CapabilityDefinition[] = RESOURCES.flatMap((resource) =>
  resource.actions.map((actionKey) => ({
    resourceKey: resource.key,
    actionKey,
    category: resource.category,
    isSystem: true,
  })),
);
