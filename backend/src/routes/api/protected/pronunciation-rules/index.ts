import { FastifyInstance } from 'fastify';
import {
  updatePronunciationRuleHandler,
  deletePronunciationRuleHandler,
} from '@/controllers/pronunciationRuleController';
import { CAPABILITY, requireCapability } from '@/services/rbac';

export async function protectedPronunciationRuleRoutes(fastify: FastifyInstance) {
  fastify.put(
    '/:ruleId',
    { preHandler: requireCapability(CAPABILITY.PRONUNCIATION_MANAGE) },
    updatePronunciationRuleHandler,
  );
  fastify.delete(
    '/:ruleId',
    { preHandler: requireCapability(CAPABILITY.PRONUNCIATION_MANAGE) },
    deletePronunciationRuleHandler,
  );
}
