const definition = {
	key: 'tts:local',
	name: 'Local TTS User',
	description: 'Use on-device local AI TTS playback.',
	resourceKey: 'local_tts',
	capabilityKeys: ['local_tts:use'],
	isSystem: true,
} as const;

export default definition;
