import { API_BASE_URL, type FeatureFlags } from "../../utils/api";

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

export async function getFeatureFlags(): Promise<FeatureFlags> {
	try {
		const response = await fetch(`${API_BASE_URL}/public/features`, {
			next: { revalidate: 0 },
		});
		if (!response.ok) {
			return DEFAULT_FEATURE_FLAGS;
		}
		const data = (await response.json()) as { featureFlags?: FeatureFlags };
		return data.featureFlags ?? DEFAULT_FEATURE_FLAGS;
	} catch {
		return DEFAULT_FEATURE_FLAGS;
	}
}
