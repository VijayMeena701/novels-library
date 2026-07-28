'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, type FeatureFlags } from '../utils/api';
import { setKokoroDebug } from '../lib/tts/playback/kokoroDebug';

const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  localTtsEnabled: false,
  readerModes: {
    singlePage: true,
    infinite: false,
    oldReader: false,
  },
  kokoroDebugEnabled: false,
  commentsEnabled: false,
  frontendLoggingEnabled: false,
};

interface FeatureFlagsContextType {
  featureFlags: FeatureFlags;
  isLoading: boolean;
  error: Error | null;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextType>({
  featureFlags: DEFAULT_FEATURE_FLAGS,
  isLoading: true,
  error: null,
});

export function FeatureFlagsProvider({
  children,
  initialFeatureFlags,
}: {
  children: ReactNode;
  initialFeatureFlags?: FeatureFlags;
}) {
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>(initialFeatureFlags ?? DEFAULT_FEATURE_FLAGS);
  const [isLoading, setIsLoading] = useState(!initialFeatureFlags);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setKokoroDebug(featureFlags.kokoroDebugEnabled);
  }, [featureFlags.kokoroDebugEnabled]);

  useEffect(() => {
    if (initialFeatureFlags) return;

    let cancelled = false;
    async function load() {
      try {
        const flags = await api.getFeatureFlags();
        if (!cancelled) {
          setFeatureFlags(flags);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [initialFeatureFlags]);

  const value = useMemo(() => ({ featureFlags, isLoading, error }), [featureFlags, isLoading, error]);

  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>;
}

export function useFeatureFlags(): FeatureFlagsContextType {
  return useContext(FeatureFlagsContext);
}
