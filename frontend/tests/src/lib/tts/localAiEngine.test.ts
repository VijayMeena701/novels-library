import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LocalAIEngine } from '@/lib/tts/playback/localAiEngine';
import type { LocalTTSModelAdapter } from '@/lib/tts/playback/kokoroAdapter';
import type { PlaybackConfig, PlaybackEngineCallbacks } from '@/lib/tts/playback';

class AudioContextStub {
	state: AudioContextState = 'running';
	currentTime = 0;
	destination = {} as AudioDestinationNode;

	createBuffer = vi.fn((channels: number, length: number, sampleRate: number): AudioBuffer => {
		const data = new Float32Array(length);
		return {
			length,
			sampleRate,
			duration: length / sampleRate,
			numberOfChannels: channels,
			getChannelData: () => data,
		} as unknown as AudioBuffer;
	});

	createBufferSource = vi.fn((): AudioBufferSourceNode => {
		return {
			buffer: null,
			playbackRate: { value: 1 },
			connect: vi.fn(),
			start: vi.fn(),
			stop: vi.fn(),
			disconnect: vi.fn(),
			onended: null as (() => void) | null,
		} as unknown as AudioBufferSourceNode;
	});

	async resume(): Promise<void> {
		this.state = 'running';
	}

	async suspend(): Promise<void> {
		this.state = 'suspended';
	}

	async close(): Promise<void> {
		this.state = 'closed';
	}
}

type MockAdapter = LocalTTSModelAdapter & { synthesize: ReturnType<typeof vi.fn> };

function createMockAdapter(): MockAdapter {
	const voices = [
		{ voiceURI: 'af_heart', name: 'Heart', lang: 'en-US' },
		{ voiceURI: 'bf_emma', name: 'Emma', lang: 'en-GB' },
	];

	return {
		name: 'mock',
		initialize: vi.fn().mockResolvedValue(undefined),
		destroy: vi.fn(),
		getVoices: vi.fn().mockReturnValue(voices),
		synthesize: vi.fn().mockResolvedValue({ data: new Float32Array(2400), sampleRate: 24000 }),
	} as unknown as MockAdapter;
}

describe('LocalAIEngine', () => {
	let audioContext: AudioContextStub;
	let engine: LocalAIEngine;
	let adapter: MockAdapter;

	beforeEach(async () => {
		audioContext = new AudioContextStub();
		vi.stubGlobal('AudioContext', vi.fn().mockReturnValue(audioContext));
		adapter = createMockAdapter();
		engine = new LocalAIEngine(adapter);
		await engine.initialize();
	});

	afterEach(() => {
		engine.destroy();
		vi.unstubAllGlobals();
	});

	function lastSource() {
		const results = (audioContext.createBufferSource as ReturnType<typeof vi.fn>).mock.results;
		return results[results.length - 1].value as {
			onended: (() => void) | null;
			stop: ReturnType<typeof vi.fn>;
			disconnect: ReturnType<typeof vi.fn>;
		};
	}

	it('plays synthesized audio and fires lifecycle callbacks', async () => {
		const callbacks: PlaybackEngineCallbacks = {
			onStart: vi.fn(),
			onEnd: vi.fn(),
			onError: vi.fn(),
		};

		engine.play('Hello world.', { rate: 1, pitch: 1, voiceURI: 'af_heart' }, callbacks);
		await new Promise((resolve) => setTimeout(resolve, 10));

		expect(engine.getState()).toBe('playing');
		expect(callbacks.onStart).toHaveBeenCalled();

		lastSource().onended?.();
		expect(engine.getState()).toBe('idle');
		expect(callbacks.onEnd).toHaveBeenCalled();
	});

	it('fires onBoundary callbacks for word boundaries', async () => {
		const onBoundary = vi.fn();
		const callbacks: PlaybackEngineCallbacks = {
			onStart: vi.fn(),
			onEnd: vi.fn(),
			onError: vi.fn(),
			onBoundary,
		};

		engine.play('Hello world.', { rate: 1, pitch: 1, voiceURI: 'af_heart' }, callbacks);
		await new Promise((resolve) => setTimeout(resolve, 20));

		// Advance the fake AudioContext so the boundary timer sees elapsed time.
		audioContext.currentTime = 10;
		await new Promise((resolve) => setTimeout(resolve, 100));

		expect(onBoundary).toHaveBeenCalled();
		const firstBoundary = onBoundary.mock.calls[0]?.[0];
		expect(firstBoundary).toMatchObject({ name: 'word', charIndex: 0 });
	});

	it('reuses a preloaded buffer instead of synthesizing twice', async () => {
		const config: PlaybackConfig = { rate: 1, pitch: 1, voiceURI: 'af_heart' };
		engine.preload('Hello world.', config);
		await new Promise((resolve) => setTimeout(resolve, 10));

		const callbacks: PlaybackEngineCallbacks = { onStart: vi.fn(), onEnd: vi.fn() };
		engine.play('Hello world.', config, callbacks);
		await new Promise((resolve) => setTimeout(resolve, 10));

		expect(adapter.synthesize).toHaveBeenCalledTimes(1);
	});

	it('pauses while loading and resumes after synthesis finishes', async () => {
		let resolveSynthesis: (value: { data: Float32Array; sampleRate: number }) => void = () => {};
		adapter.synthesize.mockImplementationOnce(
			() => new Promise((resolve) => { resolveSynthesis = resolve as (value: { data: Float32Array; sampleRate: number }) => void; }),
		);

		const config: PlaybackConfig = { rate: 1, pitch: 1, voiceURI: 'af_heart' };
		engine.play('Hello world.', config, {});
		expect(engine.getState()).toBe('loading');

		engine.pause();
		expect(engine.getState()).toBe('paused');

		resolveSynthesis({ data: new Float32Array(2400), sampleRate: 24000 });
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(engine.getState()).toBe('paused');

		await engine.resume();
		expect(engine.getState()).toBe('playing');
	});

	it('stops playback and cancels the active source', async () => {
		const callbacks: PlaybackEngineCallbacks = { onStart: vi.fn(), onEnd: vi.fn(), onError: vi.fn() };
		engine.play('Hello world.', { rate: 1, pitch: 1, voiceURI: 'af_heart' }, callbacks);
		await new Promise((resolve) => setTimeout(resolve, 10));

		const source = lastSource();
		engine.stop();
		expect(engine.getState()).toBe('idle');
		expect(source.stop).toHaveBeenCalled();
		expect(source.disconnect).toHaveBeenCalled();
	});

	it('applies playback rate and voice to synthesis', async () => {
		const config: PlaybackConfig = { rate: 1.5, pitch: 1, voiceURI: 'bf_emma' };
		engine.play('Hello world.', config, {});
		await new Promise((resolve) => setTimeout(resolve, 10));

		expect(adapter.synthesize).toHaveBeenCalledWith(
			'Hello world.',
			expect.objectContaining({ voiceId: 'bf_emma', speed: 1.5, priority: 'play' }),
		);
	});

	it('falls back to the first available local voice when the requested voice is invalid', async () => {
		const config: PlaybackConfig = { rate: 1, pitch: 1, voiceURI: 'Microsoft David - English (United States)' };
		engine.play('Hello world.', config, {});
		await new Promise((resolve) => setTimeout(resolve, 10));

		expect(adapter.synthesize).toHaveBeenCalledWith(
			'Hello world.',
			expect.objectContaining({ voiceId: 'af_heart', speed: 1, priority: 'play' }),
		);
	});
});
