import type { PronunciationRule } from "@/utils/api";
import { SPEECH_BLOCK_SELECTOR, isSpeechLeafBlock } from "@/lib/reader-utils";
import { buildWholeWordPattern, escapeRegExp } from "@/lib/reader-utils";
import type { SpeechBlock, SpeechChunk, SpeechQueueItem } from "./speechTypes";

export function findSpeechBlocks(root: HTMLElement | null): SpeechBlock[] {
	if (!root) return [];

	const found: SpeechBlock[] = [];
	const nodes = root.querySelectorAll(SPEECH_BLOCK_SELECTOR);

	for (const node of nodes) {
		if (node instanceof HTMLElement && isSpeechLeafBlock(node)) {
			const text = node.textContent?.trim() || "";
			if (text) {
				found.push({ element: node, text });
			}
		}
	}

	return found;
}

export function splitSpeechTextWithOffsets(text: string, maxLength = 1800): SpeechChunk[] {
	const normalized = text.replace(/\s+/g, " ").trim();
	if (!normalized) return [];

	const chunks: SpeechChunk[] = [];
	let remaining = normalized;
	let consumed = 0;

	while (remaining.length > maxLength) {
		const punctuationBreak = Math.max(
			remaining.lastIndexOf(".", maxLength),
			remaining.lastIndexOf("!", maxLength),
			remaining.lastIndexOf("?", maxLength),
			remaining.lastIndexOf(";", maxLength),
			remaining.lastIndexOf(",", maxLength),
		);
		const wordBreak = remaining.lastIndexOf(" ", maxLength);
		const breakAt =
			punctuationBreak > maxLength * 0.45
				? punctuationBreak + 1
				: wordBreak > maxLength * 0.45
					? wordBreak
					: maxLength;
		const chunk = remaining.slice(0, breakAt).trim();
		if (chunk) {
			const exactStart = normalized.indexOf(chunk, consumed);
			chunks.push({
				text: chunk,
				startOffset: exactStart !== -1 ? exactStart : consumed,
			});
		}
		consumed += breakAt;
		remaining = remaining.slice(breakAt).trim();
	}

	if (remaining) {
		const exactStart = normalized.indexOf(remaining, consumed);
		chunks.push({
			text: remaining,
			startOffset: exactStart !== -1 ? exactStart : consumed,
		});
	}

	return chunks;
}

/**
 * Rewrites text to speak using the user's pronunciation rules for this book (or their
 * "all books" global rules). Rules with an empty replacement mute/skip the matched text.
 */
export function applyPronunciationRules(text: string, rules: PronunciationRule[]): string {
	if (!rules.length) return text;

	let result = text;
	for (const rule of rules) {
		if (!rule.enabled || !rule.pattern) continue;

		const pattern = rule.wholeWord ? buildWholeWordPattern(rule.pattern) : escapeRegExp(rule.pattern);
		const flags = rule.caseSensitive ? "gu" : "giu";
		try {
			const regex = new RegExp(pattern, flags);
			result = result.replace(regex, rule.replacement);
		} catch {
			// Ignore malformed patterns rather than breaking speech playback.
		}
	}

	return result.replace(/\s+/g, " ").trim();
}

export function createSpeechQueue(
	blocks: SpeechBlock[],
	startBlockIndex: number,
	rules: PronunciationRule[],
	maxChunkLength = 1800,
): SpeechQueueItem[] {
	const queue: SpeechQueueItem[] = [];

	for (let i = startBlockIndex; i < blocks.length; i++) {
		const block = blocks[i];
		const chunks = splitSpeechTextWithOffsets(block.text, maxChunkLength);

		for (const chunk of chunks) {
			queue.push({
				text: chunk.text,
				spokenText: applyPronunciationRules(chunk.text, rules),
				blockIndex: i,
				startOffset: chunk.startOffset,
			});
		}
	}

	return queue;
}
