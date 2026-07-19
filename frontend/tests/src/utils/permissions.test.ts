import { describe, it, expect } from 'vitest';
import { CAPABILITY, hasCapability } from '@/utils/permissions';
import type { User } from '@/utils/api';

describe('hasCapability', () => {
  it('returns false for missing user', () => {
    expect(hasCapability(null, CAPABILITY.BOOKS_READ)).toBe(false);
    expect(hasCapability(undefined, CAPABILITY.BOOKS_READ)).toBe(false);
  });

  it('returns true for superuser regardless of capability', () => {
    const user: User = { id: '1', username: 'admin', email: 'a@test', isSuperuser: true };
    expect(hasCapability(user, CAPABILITY.ADMIN_ACCESS)).toBe(true);
    expect(hasCapability(user, 'unknown:action')).toBe(true);
  });

  it('returns true when the user has the exact capability', () => {
    const user: User = { id: '1', username: 'u', email: 'u@test', capabilities: [CAPABILITY.BOOKS_READ] };
    expect(hasCapability(user, CAPABILITY.BOOKS_READ)).toBe(true);
  });

  it('returns true when the user has the manage variant of the resource', () => {
    const user: User = { id: '1', username: 'u', email: 'u@test', capabilities: [CAPABILITY.BOOKS_MANAGE] };
    expect(hasCapability(user, CAPABILITY.BOOKS_READ)).toBe(true);
    expect(hasCapability(user, CAPABILITY.BOOKS_DELETE)).toBe(true);
  });

  it('returns false when capability is missing and no manage fallback', () => {
    const user: User = { id: '1', username: 'u', email: 'u@test', capabilities: [CAPABILITY.BOOKS_READ] };
    expect(hasCapability(user, CAPABILITY.CHAPTERS_READ)).toBe(false);
  });

  it('treats malformed capability strings as false', () => {
    const user: User = { id: '1', username: 'u', email: 'u@test', capabilities: ['invalid'] };
    expect(hasCapability(user, CAPABILITY.BOOKS_READ)).toBe(false);
  });
});

describe('CAPABILITY', () => {
  it('contains capabilities in resource:action format', () => {
    expect(CAPABILITY.BOOKS_READ).toBe('books:read');
    expect(CAPABILITY.JOBS_MANAGE).toBe('jobs:manage');
  });
});
