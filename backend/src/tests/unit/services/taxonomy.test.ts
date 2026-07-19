import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import {
  findOrCreateGenre,
  resolveGenres,
  findOrCreatePublicationStatus,
  resolvePublicationStatus,
  backfillBookTaxonomy,
} from '@/services/taxonomy.js';
import { Genre } from '@/models/Genre.js';
import { PublicationStatus } from '@/models/PublicationStatus.js';
import { Book } from '@/models/Book.js';

describe('taxonomy service', () => {
  describe('findOrCreateGenre', () => {
    it('returns null for invalid input', async () => {
      expect(await findOrCreateGenre('')).toBeNull();
      expect(await findOrCreateGenre('   ')).toBeNull();
      expect(await findOrCreateGenre(null as any)).toBeNull();
    });

    it('creates a new genre and normalizes key', async () => {
      const genre = await findOrCreateGenre('  Epic Fantasy ');
      expect(genre).not.toBeNull();
      expect(genre!.name).toBe('Epic Fantasy');
      expect(genre!.key).toBe('epic-fantasy');
    });

    it('returns an existing genre by key', async () => {
      const first = await findOrCreateGenre('Isekai');
      const second = await findOrCreateGenre('isekai');
      expect(second!._id.toString()).toBe(first!._id.toString());
    });

    it('returns an existing genre by alias', async () => {
      const existing = await Genre.create({ name: 'Sci-Fi', key: 'sci-fi', aliases: ['SF'] });
      const found = await findOrCreateGenre('SF');
      expect(found!._id.toString()).toBe(existing._id.toString());
    });
  });

  describe('resolveGenres', () => {
    it('returns empty collections for empty input', async () => {
      const result = await resolveGenres({});
      expect(result.genreIds).toEqual([]);
      expect(result.genres).toEqual([]);
      expect(result.genreKeys).toEqual([]);
    });

    it('resolves ids and names, deduplicating by key', async () => {
      const genre = await findOrCreateGenre('Fantasy');
      const result = await resolveGenres({
        genreIds: [genre!._id],
        genres: ['fantasy', '  Sci-Fi ', 'sci fi'],
      });
      expect(result.genreIds).toHaveLength(2);
      expect(result.genres).toContain('Fantasy');
      expect(result.genres).toContain('Sci-Fi');
      expect(result.genreKeys).toContain('fantasy');
      expect(result.genreKeys).toContain('sci-fi');
    });

    it('ignores invalid object ids', async () => {
      const result = await resolveGenres({ genreIds: ['not-an-id', 12345 as any] });
      expect(result.genreIds).toEqual([]);
    });
  });

  describe('findOrCreatePublicationStatus', () => {
    it('returns null for invalid input', async () => {
      expect(await findOrCreatePublicationStatus('')).toBeNull();
      expect(await findOrCreatePublicationStatus(undefined as any)).toBeNull();
    });

    it('creates and normalizes a publication status', async () => {
      const status = await findOrCreatePublicationStatus('  Ongoing ');
      expect(status).not.toBeNull();
      expect(status!.name).toBe('Ongoing');
      expect(status!.key).toBe('ongoing');
    });

    it('returns an existing status by key', async () => {
      const first = await findOrCreatePublicationStatus('Completed');
      const second = await findOrCreatePublicationStatus('completed');
      expect(second!._id.toString()).toBe(first!._id.toString());
    });
  });

  describe('resolvePublicationStatus', () => {
    it('returns an empty object for invalid input', async () => {
      const result = await resolvePublicationStatus({});
      expect(result.publicationStatusId).toBeUndefined();
    });

    it('resolves by existing id', async () => {
      const status = await findOrCreatePublicationStatus('Hiatus');
      const result = await resolvePublicationStatus({ publicationStatusId: String(status!._id) });
      expect(result.publicationStatus).toBe('Hiatus');
      expect(result.publicationStatusKey).toBe('hiatus');
    });

    it('resolves by name when id is invalid', async () => {
      const result = await resolvePublicationStatus({
        publicationStatusId: new mongoose.Types.ObjectId().toString(),
        publicationStatus: 'Dropped',
      });
      expect(result.publicationStatus).toBe('Dropped');
    });
  });

  describe('backfillBookTaxonomy', () => {
    it('backfills genre and publication status ids from string fields', async () => {
      await Book.create({
        title: 'Backfill Book',
        genres: ['Fantasy'],
        publicationStatus: 'Ongoing',
      });

      await backfillBookTaxonomy(500);

      const book = await Book.findOne({ title: 'Backfill Book' });
      expect(book).not.toBeNull();
      expect(book!.genreIds).toHaveLength(1);
      expect(book!.genres).toContain('Fantasy');
      expect(book!.publicationStatusId).toBeDefined();
      expect(book!.publicationStatus).toBe('Ongoing');
    });

    it('leaves already-backfilled books alone', async () => {
      const genre = await findOrCreateGenre('Adventure');
      await Book.create({
        title: 'Already Filled',
        genreIds: [genre!._id],
        genres: ['Adventure'],
        publicationStatus: 'Completed',
      });

      await backfillBookTaxonomy(500);

      const book = await Book.findOne({ title: 'Already Filled' });
      expect(book!.genreIds[0].toString()).toBe(genre!._id.toString());
    });
  });
});
