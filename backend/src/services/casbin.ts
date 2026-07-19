import { newEnforcer, newModel, StringAdapter, Enforcer } from 'casbin';
import { Role } from '../models/Role';
import { Resource } from '../models/Resource';
import { User } from '../models/User';
import '../models/Action';

const model = newModel(`
[request_definition]
r = sub, obj, act

[policy_definition]
p = sub, obj, act

[role_definition]
g = _, _

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = g(r.sub, p.sub) && (r.obj == p.obj || p.obj == '*') && (r.act == p.act || p.act == '*')
`);

const adapter = new StringAdapter('# initial');

let enforcer: Enforcer | null = null;

export async function initEnforcer(): Promise<Enforcer> {
  enforcer ??= await newEnforcer(model, adapter);
  return enforcer;
}

export function getEnforcer(): Enforcer {
  if (!enforcer) {
    throw new Error('Casbin enforcer has not been initialized. Call initEnforcer() first.');
  }
  return enforcer;
}

type ResourceMap = Map<string, { isEnabled: boolean }>;

async function loadResourceMap(): Promise<ResourceMap> {
  const resourceMap: ResourceMap = new Map();
  const resources = await Resource.find().lean();
  for (const r of resources) {
    resourceMap.set(r.key, { isEnabled: r.isEnabled });
  }
  return resourceMap;
}

async function addCapabilityPolicy(
  roleKey: string,
  cap: any,
  e: Enforcer,
  resourceMap: ResourceMap,
): Promise<void> {
  const resource: string | undefined = cap.resource?.key;
  const action: string | undefined = cap.action?.key;
  if (!resource) return;
  if (!action) return;

  const res = resourceMap.get(resource);
  if (!res) return;
  if (!res.isEnabled) return;

  const casbinAction = action === 'manage' ? '*' : action;
  await e.addPolicy(`role:${roleKey}`, resource, casbinAction);
}

async function addGroupPolicies(
  roleKey: string,
  group: any,
  e: Enforcer,
  resourceMap: ResourceMap,
): Promise<void> {
  for (const cap of group.capabilities ?? []) {
    await addCapabilityPolicy(roleKey, cap, e, resourceMap);
  }
}

async function addRolePolicies(
  role: any,
  e: Enforcer,
  resourceMap: ResourceMap,
): Promise<void> {
  if (role.isSuperuser) {
    await e.addPolicy(`role:${role.key}`, '*', '*');
    return;
  }

  for (const group of role.groups ?? []) {
    await addGroupPolicies(role.key, group, e, resourceMap);
  }
}

async function addAnonymousPolicies(e: Enforcer): Promise<void> {
  await e.addPolicy('role:anonymous', 'books', 'read');
  await e.addPolicy('role:anonymous', 'chapters', 'read');
  await e.addPolicy('role:anonymous', 'chapters', 'read_raw');
  await e.addPolicy('role:anonymous', 'authors', 'read');
  await e.addPolicy('role:anonymous', 'genres', 'read');
  await e.addPolicy('role:anonymous', 'publication_statuses', 'read');
  await e.addGroupingPolicy('anonymous', 'role:anonymous');
}

async function addUserGroupings(user: any, e: Enforcer): Promise<void> {
  if (user.isDeleted) return;
  if (user.isDisabled) return;

  for (const role of user.roles ?? []) {
    await e.addGroupingPolicy(String(user._id), `role:${role.key}`);
  }
}

export async function syncPolicies(): Promise<void> {
  const e = await initEnforcer();
  e.clearPolicy();

  const roles = await Role.find().populate({
    path: 'groups',
    populate: {
      path: 'capabilities',
      populate: ['resource', 'action'],
    },
  });

  const resourceMap = await loadResourceMap();

  for (const role of roles) {
    await addRolePolicies(role, e, resourceMap);
  }

  await addAnonymousPolicies(e);

  const users = await User.find().populate('roles');
  for (const user of users) {
    await addUserGroupings(user, e);
  }
}

export { Enforcer };
