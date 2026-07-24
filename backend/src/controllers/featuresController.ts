import type { FastifyRequest, FastifyReply } from 'fastify';
import { AppConfig } from '@/models/AppConfig';
import { CAPABILITY, getUserCapabilities } from '@/services/rbac';

export interface FeatureFlags {
  localTtsEnabled: boolean;
  readerModes: {
    singlePage: boolean;
    infinite: boolean;
    oldReader: boolean;
  };
  kokoroDebugEnabled: boolean;
  commentsEnabled: boolean;
  frontendLoggingEnabled: boolean;
}

const DEFAULT_READER_MODES: FeatureFlags['readerModes'] = {
  singlePage: true,
  infinite: false,
  oldReader: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function getFeatureFlagsHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    let userId: string | undefined;
    try {
      await request.jwtVerify();
      userId = (request.user as { id?: string } | undefined)?.id;
    } catch {
      // No token or invalid token; treat as anonymous
      userId = undefined;
    }

    const { capabilities, isSuperuser } = userId
      ? await getUserCapabilities(userId)
      : { capabilities: [], isSuperuser: false };
    const canUseLocalTts = isSuperuser || capabilities.includes(CAPABILITY.LOCAL_TTS_USE);

    const [localTtsConfig, readerModesConfig, kokoroDebugConfig, commentsConfig, frontendLoggingConfig] =
      await Promise.all([
        AppConfig.findOne({ name: 'local_tts' }).lean(),
        AppConfig.findOne({ name: 'reader_modes' }).lean(),
        AppConfig.findOne({ name: 'kokoro_debug' }).lean(),
        AppConfig.findOne({ name: 'comments' }).lean(),
        AppConfig.findOne({ name: 'frontend_logging' }).lean(),
      ]);

    const localTtsValue = localTtsConfig?.value;
    const localTtsEnabled =
      canUseLocalTts && isRecord(localTtsValue) && localTtsValue.enabled === true;

    const readerModesValue = readerModesConfig?.value;
    let readerModes = DEFAULT_READER_MODES;
    if (isRecord(readerModesValue)) {
      readerModes = {
        singlePage:
          isRecord(readerModesValue.singlePage) &&
          readerModesValue.singlePage.enabled === true,
        infinite:
          isRecord(readerModesValue.infinite) &&
          readerModesValue.infinite.enabled === true,
        oldReader:
          isRecord(readerModesValue.oldReader) &&
          readerModesValue.oldReader.enabled === true,
      };
    }

    const featureFlags: FeatureFlags = {
      localTtsEnabled,
      readerModes,
      kokoroDebugEnabled: isRecord(kokoroDebugConfig?.value) && kokoroDebugConfig.value.enabled === true,
      commentsEnabled: isRecord(commentsConfig?.value) && commentsConfig.value.enabled === true,
      frontendLoggingEnabled: isRecord(frontendLoggingConfig?.value) && frontendLoggingConfig.value.enabled === true,
    };

    return reply.send({ featureFlags });
  } catch (err: any) {
    request.log.error({ err }, 'Failed to fetch feature flags');
    return reply.status(500).send({ error: 'Failed to fetch feature flags.' });
  }
}
