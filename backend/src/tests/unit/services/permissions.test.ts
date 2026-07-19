import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { isAdminRequest } from '@/services/permissions.js';
import { User } from '@/models/User.js';
import { Role } from '@/models/Role.js';
import { seedRoles } from '@/services/seed.js';

function mockRequest(user?: { id?: string; isSuperuser?: boolean; role?: string }) {
  return { user } as any;
}

describe('isAdminRequest', () => {
  it('returns true when the token user is a superuser', async () => {
    const req = mockRequest({ id: 'any', isSuperuser: true });
    expect(await isAdminRequest(req)).toBe(true);
  });

  it('returns true when the token role contains admin', async () => {
    const req = mockRequest({ id: 'any', role: 'admin,user' });
    expect(await isAdminRequest(req)).toBe(true);
  });

  it('returns false without a user id', async () => {
    const req = mockRequest();
    expect(await isAdminRequest(req)).toBe(false);
  });

  it('returns false when the user is not found', async () => {
    const req = mockRequest({ id: new mongoose.Types.ObjectId().toString() });
    expect(await isAdminRequest(req)).toBe(false);
  });

  it('returns true when the user has a superuser role', async () => {
    await seedRoles();
    const superadminRole = await Role.findOne({ key: 'superadmin' });
    const user = await User.create({
      username: 'super',
      email: 'super@example.com',
      passwordHash: 'x',
      roles: [superadminRole!._id],
    });
    const req = mockRequest({ id: String(user._id) });
    expect(await isAdminRequest(req)).toBe(true);
  });

  it('returns true when the user email is in ADMIN_EMAILS', async () => {
    await seedRoles();
    const userRole = await Role.findOne({ key: 'user' });
    const user = await User.create({
      username: 'envadmin',
      email: 'admin@example.com',
      passwordHash: 'x',
      roles: [userRole!._id],
    });
    const req = mockRequest({ id: String(user._id) });
    expect(await isAdminRequest(req)).toBe(true);
  });

  it('returns false for an ordinary user', async () => {
    await seedRoles();
    const userRole = await Role.findOne({ key: 'user' });
    const user = await User.create({
      username: 'regular',
      email: 'regular@example.com',
      passwordHash: 'x',
      roles: [userRole!._id],
    });
    const req = mockRequest({ id: String(user._id) });
    expect(await isAdminRequest(req)).toBe(false);
  });
});
