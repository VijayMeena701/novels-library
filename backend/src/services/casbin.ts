import { newEnforcer, newModel, StringAdapter, Enforcer } from 'casbin';
import { Role } from '../models/Role.js';
import { AccessGroup } from '../models/AccessGroup.js';
import { Capability } from '../models/Capability.js';
import { Resource } from '../models/Resource.js';
import { User } from '../models/User.js';

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
  if (!enforcer) {
    enforcer = await newEnforcer(model, adapter);
  }
  return enforcer;
}

export function getEnforcer(): Enforcer {
  if (!enforcer) {
    throw new Error('Casbin enforcer has not been initialized. Call initEnforcer() first.');
  }
  return enforcer;
}

export async function syncPolicies(): Promise<void> {
  const e = await initEnforcer();
  await e.clearPolicy();

  const roles = await Role.find().populate({
    path: 'groups',
    populate: {
      path: 'capabilities',
      populate: ['resource', 'action'],
    },
  });

  const resourceMap = new Map<string, { isEnabled: boolean }>();
  const resources = await Resource.find().lean();
  for (const r of resources) {
    resourceMap.set(r.key, { isEnabled: r.isEnabled });
  }

  for (const role of roles) {
    if (role.isSuperuser) {
      await e.addPolicy(`role:${role.key}`, '*', '*');
      continue;
    }

    const groups = (role.groups || []) as any[];
    for (const group of groups) {
      const capabilities = (group.capabilities || []) as any[];
      for (const cap of capabilities) {
        const resource = cap.resource?.key as string;
        const action = cap.action?.key as string;
        if (!resource || !action) continue;
        const res = resourceMap.get(resource);
        if (!res || !res.isEnabled) continue;
        const casbinAction = action === 'manage' ? '*' : action;
        await e.addPolicy(`role:${role.key}`, resource, casbinAction);
      }
    }
  }

  await e.addPolicy('role:anonymous', 'books', 'read');
  await e.addPolicy('role:anonymous', 'chapters', 'read');
  await e.addPolicy('role:anonymous', 'chapters', 'read_raw');
  await e.addPolicy('role:anonymous', 'authors', 'read');
  await e.addPolicy('role:anonymous', 'genres', 'read');
  await e.addPolicy('role:anonymous', 'publication_statuses', 'read');
  await e.addGroupingPolicy('anonymous', 'role:anonymous');

  const users = await User.find().populate('roles');
  for (const user of users) {
    if (user.isDeleted || user.isDisabled) continue;
    const userRoles = (user.roles || []) as any[];
    for (const role of userRoles) {
      await e.addGroupingPolicy(String(user._id), `role:${role.key}`);
    }
  }
}

export { Enforcer };
