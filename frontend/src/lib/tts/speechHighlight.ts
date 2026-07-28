import {
  getContrastTextColor,
  DEFAULT_PARAGRAPH_HIGHLIGHT_COLOR,
  DEFAULT_WORD_HIGHLIGHT_COLOR,
} from '@/lib/reader-utils';
import type { SpeechBlock } from './speechTypes';

const PARAGRAPH_ACTIVE_ATTR = 'data-tts-paragraph-active';
const WORD_HIGHLIGHT_CLASS = 'rounded-sm';

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

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Maps an index in a whitespace-collapsed ("normalized") view of `rawText` back
 * to the corresponding raw text offset. This lets TTS boundary callbacks, which
 * operate on normalized chunk text, highlight the correct word in the actual DOM
 * even when the original HTML contains multiple spaces or newlines.
 */
function rawOffsetForNormalizedIndex(rawText: string, normalizedIndex: number): number {
  if (normalizedIndex <= 0) return 0;

  let rawIndex = 0;
  let normalizedCount = 0;
  while (rawIndex < rawText.length && normalizedCount < normalizedIndex) {
    const c = rawText[rawIndex];
    if (/\s/.test(c)) {
      // A run of whitespace collapses to a single normalized space.
      rawIndex++;
      while (rawIndex < rawText.length && /\s/.test(rawText[rawIndex])) {
        rawIndex++;
      }
    } else {
      rawIndex++;
    }
    normalizedCount++;
  }

  return rawIndex;
}

function findRangeForRawOffsets(root: Node, startOffset: number, endOffset: number): Range | null {
  const nodes = getTextNodes(root);
  let pos = 0;
  let startContainer: Node | null = null;
  let startOffsetInNode = 0;
  let endContainer: Node | null = null;
  let endOffsetInNode = 0;

  for (const node of nodes) {
    const text = node.textContent ?? '';
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
  const color = options.color || DEFAULT_PARAGRAPH_HIGHLIGHT_COLOR;
  element.style.backgroundColor = color;
  element.style.boxShadow = `0 0 0 4px ${color}`;
  element.classList.add('!rounded', '!duration-150');
  element.setAttribute(PARAGRAPH_ACTIVE_ATTR, 'true');
}

export function clearParagraphHighlight(element: HTMLElement): void {
  element.style.backgroundColor = '';
  element.style.boxShadow = '';
  element.classList.remove('!rounded', '!duration-150');
  element.removeAttribute(PARAGRAPH_ACTIVE_ATTR);
}

export function updateParagraphHighlightColor(element: HTMLElement, color: string): void {
  if (element.getAttribute(PARAGRAPH_ACTIVE_ATTR) !== 'true') return;
  element.style.backgroundColor = color;
  element.style.boxShadow = `0 0 0 4px ${color}`;
}

export function highlightWordInBlock(block: SpeechBlock, charIndex: number, color: string): HTMLElement | null {
  const { element, text } = block;
  const safeColor = color || DEFAULT_WORD_HIGHLIGHT_COLOR;
  const normalizedText = normalizeText(text);
  if (charIndex < 0 || charIndex >= normalizedText.length) return null;

  let start = charIndex;
  while (start > 0 && /\w/.test(normalizedText[start - 1])) {
    start--;
  }
  let end = charIndex;
  while (end < normalizedText.length && /\w/.test(normalizedText[end])) {
    end++;
  }
  if (start === end) return null;

  const fullText = element.textContent ?? '';
  const leading = fullText.indexOf(text);
  if (leading === -1) return null;

  const rawStart = leading + rawOffsetForNormalizedIndex(text, start);
  const rawEnd = leading + rawOffsetForNormalizedIndex(text, end);
  const range = findRangeForRawOffsets(element, rawStart, rawEnd);
  if (!range) return null;

  const span = document.createElement('span');
  span.className = WORD_HIGHLIGHT_CLASS;
  span.style.backgroundColor = safeColor;
  span.style.color = getContrastTextColor(safeColor);
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
