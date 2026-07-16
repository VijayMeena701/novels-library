import { FastifyInstance } from 'fastify';
import { protectedJobRetryRoutes } from './retry';
import { protectedJobManualInterventionRoutes } from './manual-intervention';
import { protectedJobImportChapterHtmlRoutes } from './import-chapter-html';

export async function protectedJobActionRoutes(fastify: FastifyInstance) {
  fastify.register(protectedJobRetryRoutes, { prefix: '/retry' });
  fastify.register(protectedJobManualInterventionRoutes, { prefix: '/manual-intervention' });
  fastify.register(protectedJobImportChapterHtmlRoutes, { prefix: '/import-chapter-html' });
}
