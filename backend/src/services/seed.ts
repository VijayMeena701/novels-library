import mongoose from 'mongoose';
import { Resource } from '../models/Resource';
import { Action } from '../models/Action';
import { Capability } from '../models/Capability';
import { AccessGroup } from '../models/AccessGroup';
import { Role } from '../models/Role';
import { syncPolicies } from './casbin';

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

async function ensureRole(
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
  await ensureRole('superadmin', 'Super Admin', [], true);
  await ensureRole('user', 'User', [
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
