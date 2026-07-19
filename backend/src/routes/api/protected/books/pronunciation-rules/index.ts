import { FastifyInstance } from 'fastify';
import {
  listPronunciationRulesHandler,
  createPronunciationRuleHandler,
} from '@/controllers/pronunciationRuleController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function protectedBookPronunciationRuleRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/',
    { preHandler: requireCapability(CAPABILITY.PRONUNCIATION_READ) },
    listPronunciationRulesHandler,
  );
  fastify.post(
    '/',
    { preHandler: requireCapability(CAPABILITY.PRONUNCIATION_MANAGE) },
    createPronunciationRuleHandler,
  );
}
