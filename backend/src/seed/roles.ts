export interface RoleDefinition {
  key: string;
  name: string;
  description: string;
  groupKeys: string[];
  isSuperuser?: boolean;
  isSystem?: boolean;
  isDefault?: boolean;
}

export const ROLES: RoleDefinition[] = [
  {
    key: 'anonymous',
    name: 'Anonymous',
    description: 'Unauthenticated public visitors.',
    groupKeys: ['anonymous:public'],
    isSystem: true,
  },
  {
    key: 'user',
    name: 'User',
    description: 'Standard authenticated user.',
    groupKeys: [
      'user:public',
      'user:library',
      'user:profile',
      'user:settings',
      'user:sessions',
      'user:tts',
      'user:translation',
    ],
    isSystem: true,
    isDefault: true,
  },
  {
    key: 'admin',
    name: 'Administrator',
    description: 'Manages content, users, roles, and access groups (except admin-level roles).',
    groupKeys: [
      'user:public',
      'user:library',
      'user:profile',
      'user:settings',
      'user:sessions',
      'user:tts',
      'user:translation',
      'admin:content',
      'admin:users',
      'admin:full',
    ],
    isSystem: true,
  },
  {
    key: 'superadmin',
    name: 'Superadmin',
    description: 'Full wildcard access to all resources and operations.',
    groupKeys: [],
    isSuperuser: true,
    isSystem: true,
  },
  {
    key: 'service',
    name: 'Service',
    description: 'Service/bot account with limited operational access.',
    groupKeys: ['service:full', 'jobs:manage'],
    isSystem: true,
  },
];
