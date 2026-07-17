import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { findOrCreateAuthor, resolveAuthorIds, toAuthorObjectId, toAuthorObjectIds } from '@/services/authors.js';
import { Author } from '@/models/Author.js';

describe('authors service', () => {
  describe('findOrCreateAuthor', () => {
    it('returns null when no name is provided', async () => {
      expect(await findOrCreateAuthor({})).toBeNull();
      expect(await findOrCreateAuthor({ author: '   ' })).toBeNull();
    });

    it('creates a new author from a pen name', async () => {
      const author = await findOrCreateAuthor({ penName: 'J. K. Smith' });
      expect(author).not.toBeNull();
      expect(author!.displayName).toBe('J. K. Smith');
      expect(author!.penName).toBe('J. K. Smith');
      expect(author!.nameKeys).toContain('j-k-smith');
    });

    it('creates from a real name fallback', async () => {
      const author = await findOrCreateAuthor({ realName: 'Alice Wonder' });
      expect(author!.displayName).toBe('Alice Wonder');
    });

    it('updates an existing author with missing fields', async () => {
      const existing = await findOrCreateAuthor({ author: 'John' });
      expect(existing!.realName).toBe('');

      const updated = await findOrCreateAuthor({
        author: 'John',
        realName: 'John Doe',
        originalLanguage: 'English',
        officialUrl: 'https://example.com/john',
      });
      expect(updated!._id.toString()).toBe(existing!._id.toString());
      expect(updated!.realName).toBe('John Doe');
      expect(updated!.originalLanguage).toBe('English');
      expect(updated!.officialUrls).toContain('https://example.com/john');
    });

    it('merges alternative names', async () => {
      const first = await findOrCreateAuthor({ author: 'Bob', alternativeNames: ['Bobby'] });
      const second = await findOrCreateAuthor({ author: 'Bob', alternativeNames: ['Bobster', 'Bobby'] });
      expect(second!._id.toString()).toBe(first!._id.toString());
      expect(second!.alternativeNames).toContain('Bobster');
      expect(second!.alternativeNames).toContain('Bobby');
    });
  });

  describe('toAuthorObjectId and toAuthorObjectIds', () => {
    it('returns undefined for invalid ids', () => {
      expect(toAuthorObjectId('not-an-id')).toBeUndefined();
      expect(toAuthorObjectId(null as any)).toBeUndefined();
    });

    it('returns a valid ObjectId', () => {
      const id = new mongoose.Types.ObjectId().toString();
      const result = toAuthorObjectId(id);
      expect(result).toBeInstanceOf(mongoose.Types.ObjectId);
      expect(result!.toString()).toBe(id);
    });

    it('deduplicates and filters author ids', () => {
      const id = new mongoose.Types.ObjectId().toString();
      const result = toAuthorObjectIds([id, id, 'invalid']);
      expect(result).toHaveLength(1);
      expect(result[0].toString()).toBe(id);
    });
  });

  describe('resolveAuthorIds', () => {
    it('resolves explicit author ids', async () => {
      const existing = await Author.create({ displayName: 'Existing' });
      const ids = await resolveAuthorIds({ authorId: String(existing._id) });
      expect(ids).toHaveLength(1);
      expect(ids[0].toString()).toBe(existing._id.toString());
    });

    it('splits comma and semicolon separated author names', async () => {
      const ids = await resolveAuthorIds({ author: 'Alice; Bob, Carol' });
      expect(ids).toHaveLength(3);
    });

    it('deduplicates explicit and parsed ids', async () => {
      const existing = await Author.create({ displayName: 'Alice' });
      const ids = await resolveAuthorIds({ author: 'Alice; Bob', authorIds: [String(existing._id)] });
      expect(ids).toHaveLength(2);
    });

    it('returns empty array when no names or ids are provided', async () => {
      const ids = await resolveAuthorIds({});
      expect(ids).toEqual([]);
    });
  });
});
