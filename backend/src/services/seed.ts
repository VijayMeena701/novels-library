import mongoose from 'mongoose';
import { Resource } from '../models/Resource';
import { Action } from '../models/Action';
import { Capability } from '../models/Capability';
import { AccessGroup } from '../models/AccessGroup';
import { Role } from '../models/Role';
import { syncPolicies } from './casbin';
import { ACTIONS } from '../seed/actions';
import { RESOURCES } from '../seed/resources';
import { CAPABILITIES } from '../seed/capabilities';
import { ACCESS_GROUPS } from '../seed/accessGroups';
import { ROLES } from '../seed/roles';

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

async function seedRbacActions() {
  const actionMap = new Map<string, string>();
  for (const def of ACTIONS) {
    const doc = await Action.findOneAndUpdate(
      { key: def.key },
      { $set: { name: def.name, description: def.description, isSystem: def.isSystem ?? false } },
      { upsert: true, new: true },
    );
    actionMap.set(def.key, doc._id.toString());
  }
  return actionMap;
}

async function seedRbacResources(actionMap: Map<string, string>) {
  const resourceMap = new Map<string, string>();
  for (const def of RESOURCES) {
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

async function seedRbacCapabilities(actionMap: Map<string, string>, resourceMap: Map<string, string>) {
  const capabilityMap = new Map<string, string>();
  for (const def of CAPABILITIES) {
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

async function seedRbacAccessGroups(capabilityMap: Map<string, string>, resourceMap: Map<string, string>) {
  const groupMap = new Map<string, string>();
  for (const def of ACCESS_GROUPS) {
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

async function seedRbacRoles(groupMap: Map<string, string>) {
  const roleMap = new Map<string, string>();
  for (const def of ROLES) {
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

export async function seedRbac(): Promise<void> {
  const actionMap = await seedRbacActions();
  const resourceMap = await seedRbacResources(actionMap);
  const capabilityMap = await seedRbacCapabilities(actionMap, resourceMap);
  const groupMap = await seedRbacAccessGroups(capabilityMap, resourceMap);
  await seedRbacRoles(groupMap);
  await syncPolicies();
  console.log('[Seed] RBAC seeding complete.');
}
