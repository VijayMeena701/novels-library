import { describe, it, expect } from 'vitest';
import { buildAbilityFor } from './ability';

describe('buildAbilityFor', () => {
  it('grants all permissions for superuser', () => {
    const ability = buildAbilityFor([], true);
    expect(ability.can('read', 'books')).toBe(true);
    expect(ability.can('delete', 'users')).toBe(true);
  });

  it('builds ability from colon-separated capabilities', () => {
    const ability = buildAbilityFor(['books:read', 'users:create'], false);
    expect(ability.can('read', 'books')).toBe(true);
    expect(ability.can('create', 'users')).toBe(true);
    expect(ability.can('delete', 'books')).toBe(false);
  });

  it('ignores malformed capability strings', () => {
    const ability = buildAbilityFor(['books', ':read', 'users:create'], false);
    expect(ability.can('create', 'users')).toBe(true);
    expect(ability.can('read', 'books')).toBe(false);
  });

  it('returns an empty ability for no capabilities', () => {
    const ability = buildAbilityFor();
    expect(ability.can('read', 'books')).toBe(false);
  });
});
