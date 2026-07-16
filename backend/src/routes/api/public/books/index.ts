import { FastifyInstance } from 'fastify';
import { publicBookDetailRoutes } from './detail';
import { publicBookReviewRoutes } from './reviews';
import { publicBookChapterRoutes } from './chapters';
import { publicBookRawChapterRoutes } from './raw-chapters';
import { publicBookCoverRoutes } from './cover';

export async function publicBookRoutes(fastify: FastifyInstance) {
  fastify.register(publicBookDetailRoutes, { prefix: '/:id' });
  fastify.register(publicBookReviewRoutes, { prefix: '/:id/reviews' });
  fastify.register(publicBookChapterRoutes, { prefix: '/:id/chapters' });
  fastify.register(publicBookRawChapterRoutes, { prefix: '/:id/raw-chapters' });
  fastify.register(publicBookCoverRoutes, { prefix: '/:id/cover' });
}
