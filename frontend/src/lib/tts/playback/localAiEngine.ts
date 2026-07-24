import { KokoroAdapter, type LocalTTSModelAdapter } from "./kokoroAdapter";
import { debugLog } from "./kokoroDebug";
import type {
    PlaybackBoundaryEvent,
    PlaybackConfig,
    PlaybackEngine,
    PlaybackEngineCallbacks,
    PlaybackState,
    PlaybackVoice,
} from "./types";

interface WordBoundary {
    charIndex: number;
    charLength: number;
    time: number;
}

function computeWordBoundaries(text: string, duration: number): WordBoundary[] {
    const words: WordBoundary[] = [];
    const regex = /\S+/g;
    let match: RegExpExecArray | null;
    let totalChars = 0;

    while ((match = regex.exec(text)) !== null) {
        totalChars += match[0].length;
    }

    if (totalChars === 0) return [];

    let cumulative = 0;
    regex.lastIndex = 0;
    while ((match = regex.exec(text)) !== null) {
        const time = (cumulative / totalChars) * duration;
        words.push({ charIndex: match.index, charLength: match[0].length, time });
        cumulative += match[0].length;
    }

    return words;
}

function logAudioContextStats(ctx: AudioContext | null, label: string): void {
    if (!ctx) return;
    debugLog(`${label}: state=${ctx.state}, sampleRate=${ctx.sampleRate}, outputLatency=${ctx.outputLatency}, baseLatency=${ctx.baseLatency}, currentTime=${ctx.currentTime}`);
}

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    const writeString = (offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };
    writeString(0, "RIFF");
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, samples.length * 2, true);
    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
        let s = samples[i] as number;
        if (s < -1) s = -1;
        else if (s > 1) s = 1;
        const intSample = s < 0 ? Math.max(-32768, Math.round(s * 0x8000)) : Math.min(32767, Math.round(s * 0x7fff));
        view.setInt16(offset, intSample, true);
        offset += 2;
    }
    return buffer;
}

function downloadWav(samples: Float32Array, sampleRate: number, filename: string): void {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const wav = encodeWav(samples, sampleRate);
    const blob = new Blob([wav], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

interface SynthesisParams {
    voiceId: string;
    speed: number;
}

/**
 * Local AI playback engine. It delegates all model-specific work to a
 * `LocalTTSModelAdapter` so the engine itself is agnostic to which local model is used.
 *
 * Synthesized audio is cached so the next chunk can be generated while the current
 * one is playing, removing the long pause between chunks.
 */
export class LocalAIEngine implements PlaybackEngine {
    readonly name = "local" as const;
    private adapter: LocalTTSModelAdapter;
    private audioContext: AudioContext | null = null;
    private currentSource: AudioBufferSourceNode | null = null;
    private currentBuffer: AudioBuffer | null = null;
    private currentConfig: PlaybackConfig = { rate: 1, pitch: 1, voiceURI: "" };
    private _state: PlaybackState = "idle";
    private callbacks: PlaybackEngineCallbacks | null = null;
    private wordBoundaries: WordBoundary[] = [];
    private nextBoundaryIndex = 0;
    private boundaryInterval: ReturnType<typeof setInterval> | null = null;
    private startTime = 0;
    private elapsedAtPause = 0;
    private operationId = 0;
    private pauseRequested = false;
    private pendingStart: { text: string; buffer: AudioBuffer; callbacks: PlaybackEngineCallbacks; operationId: number } | null = null;
    private synthesisCache = new Map<string, Promise<AudioBuffer>>();
    private maxCacheSize = 8;
    private diagnosticBypassNext = false;
    private lastBuffer: AudioBuffer | null = null;

    constructor(adapter?: LocalTTSModelAdapter) {
        this.adapter = adapter ?? new KokoroAdapter();
        if (typeof window !== "undefined") {
            const win = window as unknown as { __kokoroDiagnostic?: { bypassNext: () => void; exportLastWav: () => void } };
            win.__kokoroDiagnostic = {
                bypassNext: () => { this.diagnosticBypassNext = true; },
                exportLastWav: () => this.exportLastWav(),
            };
        }
    }

    get isSupported(): boolean {
        return (
            typeof window !== "undefined" &&
            typeof Worker !== "undefined" &&
            ("AudioContext" in window || "webkitAudioContext" in window)
        );
    }

    async initialize(): Promise<void> {
        if (this.audioContext) return;
        const AudioContextCtor = (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) as typeof AudioContext | undefined;
        if (!AudioContextCtor) {
            this._state = "error";
            throw new Error("Web Audio API is not available.");
        }

        this.audioContext = new AudioContextCtor();
        this.audioContext.onstatechange = () => {
            debugLog("LocalAIEngine: AudioContext onstatechange state=", this.audioContext?.state);
        };
        logAudioContextStats(this.audioContext, "LocalAIEngine initialize");
        await this.adapter.initialize();
        this._state = "idle";
    }

    destroy(): void {
        this.stop();
        this.adapter.destroy();
        if (this.audioContext && this.audioContext.state !== "closed") {
            void this.audioContext.close();
        }
        this.audioContext = null;
        this.synthesisCache.clear();
    }

    getVoices(): PlaybackVoice[] {
        return this.adapter.getVoices();
    }

    getState(): PlaybackState {
        return this._state;
    }

    setPlaybackRate(rate: number): void {
        this.currentConfig.rate = rate;
    }

    setVoice(voiceURI: string): void {
        this.currentConfig.voiceURI = voiceURI;
    }

    play(text: string, config: PlaybackConfig, callbacks: PlaybackEngineCallbacks): void {
        void this.doPlay(text, config, callbacks);
    }

    preload(text: string, config: PlaybackConfig): void {
        if (!this.audioContext) return;
        void this.doPreload(text, config);
    }

    private resolveParams(config: PlaybackConfig): SynthesisParams {
        const requestedVoice = config.voiceURI || this.getDefaultVoice();
        const availableVoices = this.adapter.getVoices();
        const voiceId = availableVoices.some((voice) => voice.voiceURI === requestedVoice)
            ? requestedVoice
            : this.getDefaultVoice();
        return {
            voiceId,
            speed: Math.min(Math.max(config.rate, 0.5), 4),
        };
    }

    private cacheKey(text: string, voiceId: string, speed: number): string {
        return `${voiceId}:${speed}:${text}`;
    }

    private trimCache(): void {
        while (this.synthesisCache.size > this.maxCacheSize) {
            const firstKey = this.synthesisCache.keys().next().value as string | undefined;
            if (!firstKey) break;
            this.synthesisCache.delete(firstKey);
        }
    }

    private async synthesizeToBuffer(
        text: string,
        voiceId: string,
        speed: number,
        priority: "play" | "preload",
    ): Promise<AudioBuffer> {
        if (!this.audioContext) {
            throw new Error("Local AI audio context is not ready.");
        }
        const { data, sampleRate } = await this.adapter.synthesize(text, { voiceId, speed, priority });
        debugLog(`LocalAIEngine: synthesizeToBuffer sampleRate=${sampleRate}, data.length=${data.length}`);
        if (data.length > 0) {
            let min = data[0] as number;
            let max = data[0] as number;
            let zeroCount = 0;
            for (let i = 0; i < data.length; i++) {
                const v = data[i] as number;
                if (v < min) min = v;
                if (v > max) max = v;
                if (v === 0) zeroCount++;
            }
            debugLog(`LocalAIEngine: PCM stats min=${min.toExponential(3)} max=${max.toExponential(3)} zeroCount=${zeroCount} first20=`, Array.from(data.slice(0, 20)));
        }
        const buffer = this.audioContext.createBuffer(1, data.length, sampleRate);
        buffer.getChannelData(0).set(data);
        this.lastBuffer = buffer;
        let mismatch = 0;
        const channel = buffer.getChannelData(0);
        for (let i = 0; i < Math.min(data.length, 5); i++) {
            if (channel[i] !== data[i]) mismatch++;
        }
        debugLog(`LocalAIEngine: AudioBuffer length=${buffer.length}, duration=${buffer.duration}, sampleRate=${buffer.sampleRate}, channelMismatch=${mismatch}, first5=`, Array.from(channel.slice(0, 5)));
        return buffer;
    }

    private async getOrCreateBuffer(
        text: string,
        voiceId: string,
        speed: number,
        priority: "play" | "preload",
    ): Promise<AudioBuffer> {
        const key = this.cacheKey(text, voiceId, speed);
        const cached = this.synthesisCache.get(key);
        if (cached) return cached;

        const promise = this.synthesizeToBuffer(text, voiceId, speed, priority);
        this.synthesisCache.set(key, promise);
        this.trimCache();

        try {
            return await promise;
        } catch (error) {
            this.synthesisCache.delete(key);
            throw error;
        }
    }

    private async doPreload(text: string, config: PlaybackConfig): Promise<void> {
        const { voiceId, speed } = this.resolveParams(config);
        try {
            await this.getOrCreateBuffer(text, voiceId, speed, "preload");
        } catch {
            return;
        }
    }

    private async startBuffer(
        text: string,
        buffer: AudioBuffer,
        callbacks: PlaybackEngineCallbacks,
        operationId: number,
    ): Promise<void> {
        if (!this.audioContext || operationId !== this.operationId) return;

        logAudioContextStats(this.audioContext, "LocalAIEngine startBuffer");

        if (this.pauseRequested) {
            this.pendingStart = { text, buffer, callbacks, operationId };
            this._state = "paused";
            return;
        }

        if (this.audioContext.state === "suspended") {
            try {
                await this.audioContext.resume();
                debugLog("LocalAIEngine: AudioContext resumed, state=", this.audioContext.state);
            } catch {
                if (operationId === this.operationId) {
                    this._state = "idle";
                    callbacks.onError?.("not-allowed");
                }
                return;
            }
        }

        if (operationId !== this.operationId) return;
        if (this.pauseRequested) {
            this.pendingStart = { text, buffer, callbacks, operationId };
            this._state = "paused";
            return;
        }

        this.currentBuffer = buffer;
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioContext.destination);
        debugLog("LocalAIEngine: audio graph = AudioBufferSourceNode -> AudioContext.destination");

        this.wordBoundaries = computeWordBoundaries(text, buffer.duration);
        this.nextBoundaryIndex = 0;
        source.onended = () => {
            if (operationId !== this.operationId) return;
            debugLog("LocalAIEngine: source.onended at currentTime=", this.audioContext?.currentTime);
            this.clearBoundaryTimer();
            this.currentSource = null;
            this.currentBuffer = null;
            this._state = "idle";
            callbacks.onEnd?.();
        };

        this.currentSource = source;
        this.startTime = this.audioContext.currentTime;
        debugLog("LocalAIEngine: source.start(0) at currentTime=", this.startTime, "scheduled=0, duration=", buffer.duration);
        source.start(0);
        this._state = "playing";
        this.startBoundaryTimer();
        callbacks.onStart?.();
    }

    private async doPlay(text: string, config: PlaybackConfig, callbacks: PlaybackEngineCallbacks): Promise<void> {
        this.stop();
        const operationId = this.operationId;
        this.pauseRequested = false;
        this.currentConfig = { ...config };
        this.callbacks = callbacks;

        if (!this.audioContext) {
            callbacks.onError?.("Local AI audio context is not ready.");
            return;
        }

        this._state = "loading";

        try {
            const { voiceId, speed } = this.resolveParams(config);
            const buffer = await this.getOrCreateBuffer(text, voiceId, speed, "play");
            if (operationId !== this.operationId) return;
            if (this.diagnosticBypassNext) {
                this.diagnosticBypassNext = false;
                this.diagnosticImmediatePlay(buffer, callbacks);
                return;
            }
            await this.startBuffer(text, buffer, callbacks, operationId);
        } catch (err) {
            if (operationId === this.operationId) {
                this._state = "error";
                callbacks.onError?.(err instanceof Error ? err.message : String(err));
            }
        }
    }

    pause(): void {
        if (!this.audioContext) return;
        if (this._state === "loading") {
            this.pauseRequested = true;
            this._state = "paused";
            return;
        }
        if (this._state !== "playing" || !this.currentSource) return;

        this.pauseRequested = true;
        this.elapsedAtPause = this.audioContext.currentTime - this.startTime;
        this.clearBoundaryTimer();
        void this.audioContext.suspend();
        this._state = "paused";
    }

    async resume(): Promise<void> {
        if (!this.audioContext || this._state !== "paused") return;
        this.pauseRequested = false;

        const pending = this.pendingStart;
        if (pending) {
            this.pendingStart = null;
            this._state = "loading";
            await this.startBuffer(pending.text, pending.buffer, pending.callbacks, pending.operationId);
            return;
        }

        if (!this.currentSource) {
            this._state = "loading";
            return;
        }

        await this.audioContext.resume();
        this.startTime = this.audioContext.currentTime - this.elapsedAtPause;
        this._state = "playing";
        this.startBoundaryTimer();
    }

    stop(): void {
        this.operationId++;
        this.pauseRequested = false;
        this.pendingStart = null;
        this.clearBoundaryTimer();
        this.stopSource();
        if (this.audioContext?.state === "suspended") {
            void this.audioContext.resume();
        }
        this._state = "idle";
    }

    private stopSource(): void {
        if (this.currentSource) {
            this.currentSource.onended = null;
            try {
                this.currentSource.stop();
            } catch {
                return;
            } finally {
                this.currentSource.disconnect();
                this.currentSource = null;
            }
        }
        this.currentBuffer = null;
    }

    private startBoundaryTimer(): void {
        if (!this.audioContext || this.wordBoundaries.length === 0) return;

        this.clearBoundaryTimer();
        this.boundaryInterval = setInterval(() => {
            if (!this.audioContext || this._state !== "playing") return;
            const elapsed = this.audioContext.currentTime - this.startTime;
            while (
                this.nextBoundaryIndex < this.wordBoundaries.length &&
                elapsed >= this.wordBoundaries[this.nextBoundaryIndex].time
            ) {
                const boundary = this.wordBoundaries[this.nextBoundaryIndex];
                this.callbacks?.onBoundary?.({
                    name: "word",
                    charIndex: boundary.charIndex,
                    charLength: boundary.charLength,
                } as PlaybackBoundaryEvent);
                this.nextBoundaryIndex++;
            }
        }, 30);
    }

    private clearBoundaryTimer(): void {
        if (this.boundaryInterval) {
            clearInterval(this.boundaryInterval);
            this.boundaryInterval = null;
        }
    }

    private diagnosticImmediatePlay(buffer: AudioBuffer, callbacks: PlaybackEngineCallbacks): void {
        debugLog("LocalAIEngine: DIAGNOSTIC BYPASS creating new AudioContext and playing directly");
        const AudioContextCtor = (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) as typeof AudioContext | undefined;
        if (!AudioContextCtor) {
            console.warn("Diagnostic bypass: AudioContext not available");
            return;
        }
        const ctx = new AudioContextCtor({ sampleRate: buffer.sampleRate });
        logAudioContextStats(ctx, "Diagnostic AudioContext");
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        debugLog("Diagnostic audio graph: AudioBufferSourceNode -> AudioContext.destination");
        source.onended = () => {
            debugLog("Diagnostic source.onended at currentTime=", ctx.currentTime);
            void ctx.close();
            callbacks.onEnd?.();
        };
        this._state = "playing";
        const startTime = ctx.currentTime;
        debugLog("Diagnostic source.start(0) at currentTime=", startTime, "duration=", buffer.duration);
        source.start(0);
        callbacks.onStart?.();
        if (buffer.numberOfChannels > 0) {
            downloadWav(buffer.getChannelData(0), buffer.sampleRate, "kokoro-diagnostic.wav");
        }
    }

    private exportLastWav(): void {
        if (!this.lastBuffer || this.lastBuffer.numberOfChannels === 0) {
            console.warn("No audio buffer available to export.");
            return;
        }
        downloadWav(this.lastBuffer.getChannelData(0), this.lastBuffer.sampleRate, "kokoro-last-buffer.wav");
    }

    private getDefaultVoice(): string {
        const voices = this.adapter.getVoices();
        const english = voices.find((v) => v.lang.startsWith("en"));
        return english?.voiceURI ?? voices[0]?.voiceURI ?? "af_heart";
    }
}
