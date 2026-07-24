const definition = {
	key: 'local_tts',
	name: 'Local TTS',
	description: 'On-device AI text-to-speech playback using WebGPU or WASM.',
	category: 'tts',
	actions: ['use'],
	isEnabled: true,
	isSystem: true,
} as const;

export default definition;
