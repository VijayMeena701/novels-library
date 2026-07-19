import bcrypt from 'bcryptjs';
import { User } from '@/models/User.js';
import { Role } from '@/models/Role.js';
import { syncPolicies } from '@/services/casbin.js';
import { seedRoles } from './roles.js';

export async function createUser({
  email,
  password,
  roleKey = 'user',
}: {
  email: string;
  password: string;
  roleKey?: 'user' | 'superadmin';
}) {
  await seedRoles();
  const role = await Role.findOne({ key: roleKey });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    username: email.split('@')[0],
    email: email.toLowerCase(),
    passwordHash,
    authProvider: 'password',
    roles: role ? [role._id] : [],
  });
  await syncPolicies();
  return user;
}
