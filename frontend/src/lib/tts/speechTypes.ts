export type TtsStatus = 'idle' | 'playing' | 'paused';

export interface SpeechConfig {
  rate: number;
  pitch: number;
  voiceURI: string;
}

export interface SpeechChunk {
  text: string;
  startOffset: number;
}

export interface SpeechQueueSegment {
  blockIndex: number;
  text: string;
  startOffset: number;
  blockStartOffset: number;
}

export interface SpeechQueueItem {
  text: string;
  spokenText: string;
  blockIndex: number;
  startOffset: number;
  segments: SpeechQueueSegment[];
}

export interface SpeechBlock {
  element: HTMLElement;
  text: string;
}
