import mongoose from 'mongoose';
import { readdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, extname, join } from 'path';
import { Resource } from '../models/Resource';
import { Action } from '../models/Action';
import { Capability } from '../models/Capability';
import { AccessGroup } from '../models/AccessGroup';
import { Role } from '../models/Role';
import { AppConfig } from '../models/AppConfig';
import { syncPolicies } from './casbin';

interface ActionDefinition {
  key: string;
  name: string;
  description: string;
  isSystem?: boolean;
}

interface ResourceDefinition {
  key: string;
  name: string;
  description: string;
  category: string;
  actions: string[];
  isSystem?: boolean;
  isEnabled?: boolean;
}

interface CapabilityDefinition {
  resourceKey: string;
  actionKey: string;
  category: string;
  isSystem?: boolean;
}

interface AccessGroupDefinition {
  key: string;
  name: string;
  description: string;
  resourceKey?: string;
  capabilityKeys: string[];
  isSystem?: boolean;
}

interface RoleDefinition {
  key: string;
  name: string;
  description: string;
  groupKeys: string[];
  isSuperuser?: boolean;
  isSystem?: boolean;
  isDefault?: boolean;
}

interface AppConfigDefinition {
  name: string;
  value: unknown;
  description?: string;
}

async function ensureResource(key: string, name = key) {
  const existing = await Resource.findOne({ key });
  if (existing) return existing;
  return Resource.create({ key, name, isEnabled: true });
}

async function ensureAction(key: string, name = key) {
  const existing = await Action.findOne({ key });
  if (existing) return existing;
  return Action.create({ key, name });
}

async function ensureCapability(resourceKey: string, actionKey: string) {
  const resource = await ensureResource(resourceKey);
  const action = await ensureAction(actionKey);
  const existing = await Capability.findOne({ resource: resource._id, action: action._id });
  if (existing) return existing._id as mongoose.Types.ObjectId;
  const cap = await Capability.create({ resource: resource._id, action: action._id });
  return cap._id as mongoose.Types.ObjectId;
}

async function ensureDefaultRole(
  key: string,
  name: string,
  capabilityStrings: string[] = [],
  isSuperuser = false,
) {
  const existing = await Role.findOne({ key });
  if (existing) return existing;

  const capabilityIds: mongoose.Types.ObjectId[] = [];
  for (const cap of capabilityStrings) {
    const [resource, action] = cap.split(':');
    if (!resource || !action) continue;
    capabilityIds.push(await ensureCapability(resource, action));
  }

  const group = await AccessGroup.create({
    key: `${key}-group`,
    name: `${name} Access Group`,
    capabilities: capabilityIds,
  });

  return Role.create({
    key,
    name,
    groups: [group._id],
    isSuperuser,
    isSystem: true,
    isDefault: key === 'user',
  });
}

export async function ensureDefaultRoles() {
  await ensureDefaultRole('superadmin', 'Super Admin', [], true);
  await ensureDefaultRole('user', 'User', [
    'books:read',
    'books:list',
    'books:create',
    'books:manage',
    'library:read',
    'library:add',
    'library:update',
    'library:delete',
    'chapters:read',
    'chapters:visit',
    'chapters:read_raw',
    'profile:read',
    'profile:update',
    'settings:read',
    'settings:update',
  ]);
}

export async function seedRoles() {
  await ensureDefaultRoles();
  await syncPolicies();
}

const currentFile = fileURLToPath(import.meta.url);
const currentExt = extname(currentFile);
const seedBaseDir = join(dirname(currentFile), '../seed');

async function loadSeedDefinitions<T>(directory: string): Promise<T[]> {
  const dirPath = join(seedBaseDir, directory);
  const entries = await readdir(dirPath);
  const files = entries.filter((f) => extname(f) === currentExt);

  const definitions: T[] = [];
  for (const file of files) {
    const mod = (await import(join(dirPath, file))) as { default?: T | T[] };
    const exported = mod.default;
    if (Array.isArray(exported)) {
      definitions.push(...exported);
    } else if (exported) {
      definitions.push(exported);
    }
  }
  return definitions;
}

async function seedRbacActions(actions: ActionDefinition[]) {
  const actionMap = new Map<string, string>();
  for (const def of actions) {
    const doc = await Action.findOneAndUpdate(
      { key: def.key },
      { $set: { name: def.name, description: def.description, isSystem: def.isSystem ?? false } },
      { upsert: true, new: true },
    );
    actionMap.set(def.key, doc._id.toString());
  }
  return actionMap;
}

async function seedRbacResources(actionMap: Map<string, string>, resources: ResourceDefinition[]) {
  const resourceMap = new Map<string, string>();
  for (const def of resources) {
    const actionIds = def.actions.map((key) => actionMap.get(key)).filter((id): id is string => !!id);
    const doc = await Resource.findOneAndUpdate(
      { key: def.key },
      {
        $set: {
          name: def.name,
          description: def.description,
          category: def.category,
          actions: actionIds,
          isEnabled: def.isEnabled ?? true,
          isSystem: def.isSystem ?? false,
        },
      },
      { upsert: true, new: true },
    );
    resourceMap.set(def.key, doc._id.toString());
  }
  return resourceMap;
}

async function seedRbacCapabilities(actionMap: Map<string, string>, resourceMap: Map<string, string>, capabilities: CapabilityDefinition[]) {
  const capabilityMap = new Map<string, string>();
  for (const def of capabilities) {
    const actionId = actionMap.get(def.actionKey);
    const resourceId = resourceMap.get(def.resourceKey);
    if (!actionId || !resourceId) continue;
    const capabilityKey = `${def.resourceKey}:${def.actionKey}`;
    const doc = await Capability.findOneAndUpdate(
      { resource: resourceId, action: actionId },
      {
        $set: {
          resource: resourceId,
          action: actionId,
          category: def.category,
          isSystem: def.isSystem ?? false,
        },
      },
      { upsert: true, new: true },
    );
    capabilityMap.set(capabilityKey, doc._id.toString());
  }
  return capabilityMap;
}

async function seedRbacAccessGroups(capabilityMap: Map<string, string>, resourceMap: Map<string, string>, groups: AccessGroupDefinition[]) {
  const groupMap = new Map<string, string>();
  for (const def of groups) {
    const capabilityIds = def.capabilityKeys.map((key) => capabilityMap.get(key)).filter((id): id is string => !!id);
    const resourceId = def.resourceKey ? resourceMap.get(def.resourceKey) : undefined;
    const doc = await AccessGroup.findOneAndUpdate(
      { key: def.key },
      {
        $set: {
          name: def.name,
          description: def.description,
          resource: resourceId,
          capabilities: capabilityIds,
          isSystem: def.isSystem ?? false,
        },
      },
      { upsert: true, new: true },
    );
    groupMap.set(def.key, doc._id.toString());
  }
  return groupMap;
}

async function seedRbacRoles(groupMap: Map<string, string>, roles: RoleDefinition[]) {
  const roleMap = new Map<string, string>();
  for (const def of roles) {
    const groupIds = def.groupKeys.map((key) => groupMap.get(key)).filter((id): id is string => !!id);
    const doc = await Role.findOneAndUpdate(
      { key: def.key },
      {
        $set: {
          name: def.name,
          description: def.description,
          groups: groupIds,
          isSuperuser: def.isSuperuser ?? false,
          isSystem: def.isSystem ?? false,
          isDefault: def.isDefault ?? false,
        },
      },
      { upsert: true, new: true },
    );
    roleMap.set(def.key, doc._id.toString());
  }
  return roleMap;
}

export async function ensureAppConfigDefaults(): Promise<void> {
  const configs = await loadSeedDefinitions<AppConfigDefinition>('app-configs');

  for (const config of configs) {
    await AppConfig.findOneAndUpdate(
      { name: config.name },
      {
        $setOnInsert: {
          name: config.name,
          value: config.value,
          description: config.description,
        },
      },
      { upsert: true, new: true },
    );
  }

  console.log('[Seed] AppConfig defaults ensured.');
}

export async function seedRbac(): Promise<void> {
  const actions = await loadSeedDefinitions<ActionDefinition>('actions');
  const resources = await loadSeedDefinitions<ResourceDefinition>('resources');
  const groups = await loadSeedDefinitions<AccessGroupDefinition>('access-groups');
  const roles = await loadSeedDefinitions<RoleDefinition>('roles');

  const capabilities: CapabilityDefinition[] = resources.flatMap((resource) =>
    resource.actions.map((actionKey) => ({
      resourceKey: resource.key,
      actionKey,
      category: resource.category,
      isSystem: true,
    })),
  );

  const actionMap = await seedRbacActions(actions);
  const resourceMap = await seedRbacResources(actionMap, resources);
  const capabilityMap = await seedRbacCapabilities(actionMap, resourceMap, capabilities);
  const groupMap = await seedRbacAccessGroups(capabilityMap, resourceMap, groups);
  await seedRbacRoles(groupMap, roles);
  await syncPolicies();
  await ensureAppConfigDefaults();
  console.log('[Seed] RBAC seeding complete.');
}
