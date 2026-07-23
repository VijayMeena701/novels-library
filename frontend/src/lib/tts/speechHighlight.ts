import { getContrastTextColor } from "@/lib/reader-utils";
import type { SpeechBlock } from "./speechTypes";

const PARAGRAPH_ACTIVE_ATTR = "data-tts-paragraph-active";
const WORD_HIGHLIGHT_CLASS = "rounded-sm";

function getTextNodes(root: Node): Text[] {
	const nodes: Text[] = [];
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
	let node = walker.nextNode();
	while (node) {
		nodes.push(node as Text);
		node = walker.nextNode();
	}
	return nodes;
}

function findRangeForRawOffsets(root: Node, startOffset: number, endOffset: number): Range | null {
	const nodes = getTextNodes(root);
	let pos = 0;
	let startContainer: Node | null = null;
	let startOffsetInNode = 0;
	let endContainer: Node | null = null;
	let endOffsetInNode = 0;

	for (const node of nodes) {
		const text = node.textContent ?? "";
		const nodeLength = text.length;

		if (startContainer === null && pos + nodeLength > startOffset) {
			startContainer = node;
			startOffsetInNode = startOffset - pos;
		}
		if (endContainer === null && pos + nodeLength >= endOffset) {
			endContainer = node;
			endOffsetInNode = endOffset - pos;
			break;
		}
		pos += nodeLength;
	}

	if (!startContainer || !endContainer) return null;

	const range = document.createRange();
	range.setStart(startContainer, startOffsetInNode);
	range.setEnd(endContainer, endOffsetInNode);
	return range;
}

export interface ParagraphHighlightOptions {
	color: string;
}

export function applyParagraphHighlight(element: HTMLElement, options: ParagraphHighlightOptions): void {
	element.style.backgroundColor = options.color;
	element.style.boxShadow = `0 0 0 4px ${options.color}`;
	element.classList.add("!rounded", "!duration-150");
	element.setAttribute(PARAGRAPH_ACTIVE_ATTR, "true");
}

export function clearParagraphHighlight(element: HTMLElement): void {
	element.style.backgroundColor = "";
	element.style.boxShadow = "";
	element.classList.remove("!rounded", "!duration-150");
	element.removeAttribute(PARAGRAPH_ACTIVE_ATTR);
}

export function updateParagraphHighlightColor(element: HTMLElement, color: string): void {
	if (element.getAttribute(PARAGRAPH_ACTIVE_ATTR) !== "true") return;
	element.style.backgroundColor = color;
	element.style.boxShadow = `0 0 0 4px ${color}`;
}

export function highlightWordInBlock(block: SpeechBlock, charIndex: number, color: string): HTMLElement | null {
	const { element, text } = block;
	if (charIndex < 0 || charIndex >= text.length) return null;

	let start = charIndex;
	while (start > 0 && /\w/.test(text[start - 1])) {
		start--;
	}
	let end = charIndex;
	while (end < text.length && /\w/.test(text[end])) {
		end++;
	}
	if (start === end) return null;

	const fullText = element.textContent ?? "";
	const leading = fullText.indexOf(text);
	if (leading === -1) return null;

	const rawStart = leading + start;
	const rawEnd = leading + end;
	const range = findRangeForRawOffsets(element, rawStart, rawEnd);
	if (!range) return null;

	const span = document.createElement("span");
	span.className = WORD_HIGHLIGHT_CLASS;
	span.style.backgroundColor = color;
	span.style.color = getContrastTextColor(color);
	try {
		range.surroundContents(span);
	} catch {
		const contents = range.extractContents();
		span.appendChild(contents);
		range.insertNode(span);
	}

	return span;
}

export function clearWordHighlight(wrapper: HTMLElement): void {
	const parent = wrapper.parentNode;
	if (!parent) return;

	while (wrapper.firstChild) {
		parent.insertBefore(wrapper.firstChild, wrapper);
	}
	parent.removeChild(wrapper);
	if (parent instanceof HTMLElement) {
		parent.normalize();
	}
}

export function updateWordHighlightColor(wrapper: HTMLElement, color: string): void {
	wrapper.style.backgroundColor = color;
	wrapper.style.color = getContrastTextColor(color);
}
