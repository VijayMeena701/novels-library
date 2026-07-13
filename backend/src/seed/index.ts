import { Action } from '../models/Action.js';
import { Resource } from '../models/Resource.js';
import { Capability } from '../models/Capability.js';
import { AccessGroup } from '../models/AccessGroup.js';
import { Role } from '../models/Role.js';
import { syncPolicies } from '../services/casbin.js';
import { ACTIONS } from './actions.js';
import { RESOURCES } from './resources.js';
import { CAPABILITIES } from './capabilities.js';
import { ACCESS_GROUPS } from './accessGroups.js';
import { ROLES } from './roles.js';

async function seedActions() {
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

async function seedResources(actionMap: Map<string, string>) {
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

async function seedCapabilities(actionMap: Map<string, string>, resourceMap: Map<string, string>) {
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

async function seedAccessGroups(capabilityMap: Map<string, string>, resourceMap: Map<string, string>) {
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

async function seedRoles(groupMap: Map<string, string>) {
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
  const actionMap = await seedActions();
  const resourceMap = await seedResources(actionMap);
  const capabilityMap = await seedCapabilities(actionMap, resourceMap);
  const groupMap = await seedAccessGroups(capabilityMap, resourceMap);
  await seedRoles(groupMap);
  await syncPolicies();
  console.log('[Seed] RBAC seeding complete.');
}
